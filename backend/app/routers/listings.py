"""POST /listings — create a listing.

Defense-in-depth against double-submits / duplicate inserts:

1. The client sends a stable `Idempotency-Key` header (a UUID generated once
   per form mount). Re-posting the same key returns the original listing
   instead of creating another row.

2. A `UNIQUE(owner_id, idempotency_key)` partial index in Postgres is the
   real safety net: even if two requests slip past the pre-check at the
   same moment, only one INSERT can win — the other gets a 23505 error
   which we translate into "fetch and return the existing row".

3. Each storage path is verified to live under `<user_id>/...` before we
   write the DB rows, so we can't be tricked into linking another user's
   files.
"""

from __future__ import annotations

import logging
from datetime import date
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from postgrest.exceptions import APIError

from ..deps import AuthContext, get_auth_context, get_idempotency_key
from ..schemas import Amenity, ListingCreate, ListingDetail, ListingResponse, PaginatedResponse, SubletType
from ..supabase_client import supabase_anon

log = logging.getLogger(__name__)

router = APIRouter(prefix="/listings", tags=["listings"])

UNIQUE_VIOLATION = "23505"


def _to_cents(amount: float) -> int:
    return int(round(amount * 100))


def _verify_owned_paths(paths: list[str], user_id: str) -> None:
    prefix = f"{user_id}/"
    for p in paths:
        if not p.startswith(prefix):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Image path '{p}' is not owned by the authenticated user",
            )


def _fetch_listing_by_idem(
    ctx: AuthContext, idempotency_key: str
) -> dict[str, Any] | None:
    resp = (
        ctx.supabase.table("listings")
        .select("id, owner_id, status, created_at")
        .eq("owner_id", ctx.user_id)
        .eq("idempotency_key", idempotency_key)
        .limit(1)
        .execute()
    )
    rows = resp.data or []
    return rows[0] if rows else None


DEFAULT_PAGE_SIZE = 20
MAX_PAGE_SIZE = 100


def _build_listing_detail(supabase: Any, listing: dict[str, Any]) -> ListingDetail:
    """Build a ListingDetail from a listing row, fetching amenities and images."""
    listing_id = str(listing["id"])

    amenities_resp = (
        supabase.table("listing_amenities")
        .select("amenity")
        .eq("listing_id", listing_id)
        .execute()
    )
    amenities = [a["amenity"] for a in (amenities_resp.data or [])]

    images_resp = (
        supabase.table("listing_images")
        .select("storage_path")
        .eq("listing_id", listing_id)
        .order("position")
        .execute()
    )
    images = [img["storage_path"] for img in (images_resp.data or [])]

    return ListingDetail(
        id=listing_id,
        owner_id=str(listing["owner_id"]),
        description=listing["description"],
        sublet_type=listing["sublet_type"],
        bedrooms=float(listing["bedrooms"]),
        bathrooms=float(listing["bathrooms"]),
        sqft=listing.get("sqft"),
        monthly_rent_cents=listing["monthly_rent_cents"],
        utilities_included=listing["utilities_included"],
        additional_fees_cents=listing["additional_fees_cents"],
        furnished=listing["furnished"],
        location=listing["location"],
        address=listing["address"],
        start_date=listing["start_date"],
        end_date=listing["end_date"],
        status=listing["status"],
        created_at=str(listing["created_at"]),
        updated_at=str(listing["updated_at"]),
        amenities=amenities,
        images=images,
    )


@router.get("/search", response_model=PaginatedResponse[ListingDetail])
def search_listings(
    q: Annotated[str | None, Query(description="Keyword search in description and location")] = None,
    location: Annotated[str | None, Query(description="Filter by city or neighborhood")] = None,
    zipcode: Annotated[str | None, Query(description="Filter by zipcode", min_length=5, max_length=5)] = None,
    min_price: Annotated[int | None, Query(description="Minimum monthly rent in dollars", ge=0)] = None,
    max_price: Annotated[int | None, Query(description="Maximum monthly rent in dollars", ge=0)] = None,
    min_bedrooms: Annotated[int | None, Query(description="Minimum number of bedrooms", ge=0)] = None,
    max_bedrooms: Annotated[int | None, Query(description="Maximum number of bedrooms", ge=0)] = None,
    min_bathrooms: Annotated[int | None, Query(description="Minimum number of bathrooms", ge=0)] = None,
    max_bathrooms: Annotated[int | None, Query(description="Maximum number of bathrooms", ge=0)] = None,
    sublet_type: Annotated[SubletType | None, Query(description="Property type filter")] = None,
    amenities: Annotated[str | None, Query(description="Comma-separated list of required amenities")] = None,
    start_date: Annotated[date | None, Query(description="Listings available on or after this date")] = None,
    end_date: Annotated[date | None, Query(description="Listings available on or before this date")] = None,
    furnished: Annotated[bool | None, Query(description="Filter by furnished status")] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=MAX_PAGE_SIZE)] = DEFAULT_PAGE_SIZE,
) -> PaginatedResponse[ListingDetail]:
    """Search listings with optional filters. Public endpoint - no auth required.

    All filters are optional and can be combined. Only active listings are returned.
    The search is designed to work with partial information - you can search by:
    - Just a keyword
    - Just a location/city
    - Just a zipcode
    - Just filters (price, bedrooms, etc.)
    - Any combination of the above
    """
    supabase = supabase_anon()
    offset = (page - 1) * page_size

    # Parse amenities if provided
    required_amenities: list[str] = []
    if amenities:
        required_amenities = [a.strip() for a in amenities.split(",") if a.strip()]

    # If amenities are required, we need to find listings that have ALL of them
    # This requires a subquery approach
    listing_ids_with_amenities: set[str] | None = None
    if required_amenities:
        # For each amenity, get the listing IDs that have it
        # Then intersect them to get listings that have ALL required amenities
        for amenity in required_amenities:
            amenity_resp = (
                supabase.table("listing_amenities")
                .select("listing_id")
                .eq("amenity", amenity)
                .execute()
            )
            amenity_listing_ids = {str(r["listing_id"]) for r in (amenity_resp.data or [])}

            if listing_ids_with_amenities is None:
                listing_ids_with_amenities = amenity_listing_ids
            else:
                listing_ids_with_amenities &= amenity_listing_ids

            # Early exit if no listings match
            if not listing_ids_with_amenities:
                return PaginatedResponse.build(
                    items=[], page=page, page_size=page_size, total_count=0
                )

    # Build the base query for counting
    count_query = supabase.table("listings").select("id", count="exact").eq("status", "active")

    # Build the base query for fetching
    fetch_query = supabase.table("listings").select("*").eq("status", "active")

    # Apply amenities filter if we have listing IDs to filter by
    if listing_ids_with_amenities is not None:
        listing_ids_list = list(listing_ids_with_amenities)
        count_query = count_query.in_("id", listing_ids_list)
        fetch_query = fetch_query.in_("id", listing_ids_list)

    # Keyword search (in description and location)
    if q:
        search_term = q.strip()
        if search_term:
            # Use ilike for case-insensitive partial matching
            # Search in both description and location
            count_query = count_query.or_(f"description.ilike.%{search_term}%,location.ilike.%{search_term}%")
            fetch_query = fetch_query.or_(f"description.ilike.%{search_term}%,location.ilike.%{search_term}%")

    # Location filter (city or neighborhood)
    if location:
        location_term = location.strip()
        if location_term:
            count_query = count_query.ilike("location", f"%{location_term}%")
            fetch_query = fetch_query.ilike("location", f"%{location_term}%")

    # Zipcode filter - address is stored as JSON, search within it
    if zipcode:
        zipcode_term = zipcode.strip()
        if zipcode_term:
            # The address field is a JSON string, we search for the zip5 value
            # Using ilike to search for the zipcode in the JSON string
            count_query = count_query.ilike("address", f'%"zip5":"{zipcode_term}"%')
            fetch_query = fetch_query.ilike("address", f'%"zip5":"{zipcode_term}"%')

    # Price filters (convert from dollars to cents)
    if min_price is not None:
        min_cents = min_price * 100
        count_query = count_query.gte("monthly_rent_cents", min_cents)
        fetch_query = fetch_query.gte("monthly_rent_cents", min_cents)

    if max_price is not None:
        max_cents = max_price * 100
        count_query = count_query.lte("monthly_rent_cents", max_cents)
        fetch_query = fetch_query.lte("monthly_rent_cents", max_cents)

    # Bedroom filters
    if min_bedrooms is not None:
        count_query = count_query.gte("bedrooms", min_bedrooms)
        fetch_query = fetch_query.gte("bedrooms", min_bedrooms)

    if max_bedrooms is not None:
        count_query = count_query.lte("bedrooms", max_bedrooms)
        fetch_query = fetch_query.lte("bedrooms", max_bedrooms)

    # Bathroom filters
    if min_bathrooms is not None:
        count_query = count_query.gte("bathrooms", min_bathrooms)
        fetch_query = fetch_query.gte("bathrooms", min_bathrooms)

    if max_bathrooms is not None:
        count_query = count_query.lte("bathrooms", max_bathrooms)
        fetch_query = fetch_query.lte("bathrooms", max_bathrooms)

    # Sublet type filter
    if sublet_type is not None:
        count_query = count_query.eq("sublet_type", sublet_type)
        fetch_query = fetch_query.eq("sublet_type", sublet_type)

    # Furnished filter
    if furnished is not None:
        count_query = count_query.eq("furnished", furnished)
        fetch_query = fetch_query.eq("furnished", furnished)

    # Date filters
    # start_date filter: listing should be available on or after this date
    # This means the listing's start_date should be <= the requested start_date
    # and the listing's end_date should be >= the requested start_date
    if start_date is not None:
        start_date_str = start_date.isoformat()
        count_query = count_query.lte("start_date", start_date_str).gte("end_date", start_date_str)
        fetch_query = fetch_query.lte("start_date", start_date_str).gte("end_date", start_date_str)

    # end_date filter: listing should be available until at least this date
    # This means the listing's end_date should be >= the requested end_date
    if end_date is not None:
        end_date_str = end_date.isoformat()
        count_query = count_query.gte("end_date", end_date_str)
        fetch_query = fetch_query.gte("end_date", end_date_str)

    # Execute count query
    count_resp = count_query.execute()
    total_count = count_resp.count or 0

    # Execute fetch query with ordering and pagination
    fetch_resp = (
        fetch_query
        .order("created_at", desc=True)
        .range(offset, offset + page_size - 1)
        .execute()
    )
    listings = fetch_resp.data or []

    # Build detailed listing responses
    result: list[ListingDetail] = []
    for listing in listings:
        result.append(_build_listing_detail(supabase, listing))

    return PaginatedResponse.build(
        items=result, page=page, page_size=page_size, total_count=total_count
    )


@router.get("/mine", response_model=PaginatedResponse[ListingDetail])
def get_my_listings(
    ctx: AuthContext = Depends(get_auth_context),
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=MAX_PAGE_SIZE)] = DEFAULT_PAGE_SIZE,
) -> PaginatedResponse[ListingDetail]:
    """Return paginated listings owned by the current user."""
    offset = (page - 1) * page_size

    count_resp = (
        ctx.supabase.table("listings")
        .select("id", count="exact")
        .eq("owner_id", ctx.user_id)
        .execute()
    )
    total_count = count_resp.count or 0

    resp = (
        ctx.supabase.table("listings")
        .select("*")
        .eq("owner_id", ctx.user_id)
        .order("created_at", desc=True)
        .range(offset, offset + page_size - 1)
        .execute()
    )
    listings = resp.data or []

    result: list[ListingDetail] = [
        _build_listing_detail(ctx.supabase, listing) for listing in listings
    ]

    return PaginatedResponse.build(
        items=result, page=page, page_size=page_size, total_count=total_count
    )


@router.get("/{listing_id}", response_model=ListingDetail)
def get_listing(listing_id: str) -> ListingDetail:
    """Return a single listing by ID. Public endpoint - no auth required.

    Only active listings are visible to anonymous users (enforced by RLS).
    """
    supabase = supabase_anon()

    resp = (
        supabase.table("listings")
        .select("*")
        .eq("id", listing_id)
        .limit(1)
        .execute()
    )
    listings = resp.data or []

    if not listings:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Listing not found",
        )

    return _build_listing_detail(supabase, listings[0])


@router.post(
    "",
    response_model=ListingResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_listing(
    payload: ListingCreate,
    ctx: AuthContext = Depends(get_auth_context),
    idempotency_key: str | None = Depends(get_idempotency_key),
) -> ListingResponse:
    _verify_owned_paths(payload.image_paths, ctx.user_id)

    # Fast path: did the client already submit this form? Return the same row.
    if idempotency_key is not None:
        existing = _fetch_listing_by_idem(ctx, idempotency_key)
        if existing is not None:
            return ListingResponse(
                id=str(existing["id"]),
                owner_id=str(existing["owner_id"]),
                status=str(existing["status"]),
                created_at=str(existing["created_at"]),
            )

    listing_row = {
        "owner_id": ctx.user_id,
        "description": payload.description,
        "sublet_type": payload.sublet_type,
        "bedrooms": payload.bedrooms,
        "bathrooms": payload.bathrooms,
        "sqft": payload.sqft,
        "monthly_rent_cents": _to_cents(payload.monthly_rent),
        "utilities_included": payload.utilities_included,
        "additional_fees_cents": _to_cents(payload.additional_fees),
        "furnished": payload.furnished,
        "location": payload.location,
        "address": payload.address,
        "start_date": payload.start_date.isoformat(),
        "end_date": payload.end_date.isoformat(),
        "idempotency_key": idempotency_key,
    }

    try:
        insert_resp = (
            ctx.supabase.table("listings")
            .insert(listing_row, returning="representation")
            .execute()
        )
    except APIError as err:
        # Lost a race against ourselves: another request with the same
        # idempotency key already committed. Return that row.
        if getattr(err, "code", None) == UNIQUE_VIOLATION and idempotency_key:
            existing = _fetch_listing_by_idem(ctx, idempotency_key)
            if existing is not None:
                return ListingResponse(
                    id=str(existing["id"]),
                    owner_id=str(existing["owner_id"]),
                    status=str(existing["status"]),
                    created_at=str(existing["created_at"]),
                )
        log.exception("Failed to insert listing")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=getattr(err, "message", "Failed to create listing"),
        ) from err

    rows = insert_resp.data or []
    if not rows:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Listing insert returned no rows",
        )
    listing = rows[0]
    listing_id = str(listing["id"])

    # Children: amenities + images. Best-effort transactional cleanup on failure.
    try:
        if payload.amenities:
            ctx.supabase.table("listing_amenities").insert(
                [{"listing_id": listing_id, "amenity": a} for a in payload.amenities]
            ).execute()

        ctx.supabase.table("listing_images").insert(
            [
                {"listing_id": listing_id, "storage_path": path, "position": i}
                for i, path in enumerate(payload.image_paths)
            ]
        ).execute()
    except APIError as err:
        log.exception("Failed to insert listing children; rolling back listing")
        # ON DELETE CASCADE on the FKs cleans up any partially-written children.
        try:
            ctx.supabase.table("listings").delete().eq("id", listing_id).execute()
        except Exception:
            log.exception("Cleanup delete of listing %s failed", listing_id)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=getattr(err, "message", "Failed to attach listing details"),
        ) from err

    return ListingResponse(
        id=listing_id,
        owner_id=str(listing["owner_id"]),
        status=str(listing["status"]),
        created_at=str(listing["created_at"]),
    )
