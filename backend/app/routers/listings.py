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
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from postgrest.exceptions import APIError

from ..deps import AuthContext, get_auth_context, get_idempotency_key
from ..schemas import ListingCreate, ListingDetail, ListingResponse
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


@router.get("/mine", response_model=list[ListingDetail])
def get_my_listings(
    ctx: AuthContext = Depends(get_auth_context),
) -> list[ListingDetail]:
    """Return all listings owned by the current user."""
    resp = (
        ctx.supabase.table("listings")
        .select("*")
        .eq("owner_id", ctx.user_id)
        .order("created_at", desc=True)
        .execute()
    )
    listings = resp.data or []

    result: list[ListingDetail] = []
    for listing in listings:
        listing_id = str(listing["id"])

        amenities_resp = (
            ctx.supabase.table("listing_amenities")
            .select("amenity")
            .eq("listing_id", listing_id)
            .execute()
        )
        amenities = [a["amenity"] for a in (amenities_resp.data or [])]

        images_resp = (
            ctx.supabase.table("listing_images")
            .select("storage_path")
            .eq("listing_id", listing_id)
            .order("position")
            .execute()
        )
        images = [img["storage_path"] for img in (images_resp.data or [])]

        result.append(
            ListingDetail(
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
        )

    return result


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

    listing = listings[0]

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
        id=str(listing["id"]),
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
