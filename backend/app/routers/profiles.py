import math
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, status

from ..schemas import (
    ListingDetail,
    ProfileResponse,
    ProfileWithListingsResponse,
)
from ..supabase_client import supabase_anon

router = APIRouter(prefix="/profiles", tags=["profiles"])

DEFAULT_PAGE_SIZE = 20
MAX_PAGE_SIZE = 100


@router.get("/{user_id}", response_model=ProfileWithListingsResponse)
async def get_profile(
    user_id: str,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=MAX_PAGE_SIZE)] = DEFAULT_PAGE_SIZE,
) -> ProfileWithListingsResponse:
    """Get a user's public profile with their active listings (paginated)."""
    supabase = supabase_anon()

    profile_resp = (
        supabase.table("profiles")
        .select("id, email, full_name, created_at")
        .eq("id", user_id)
        .execute()
    )

    if not profile_resp.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profile not found",
        )

    profile_data = profile_resp.data[0]
    profile = ProfileResponse(
        id=profile_data["id"],
        email=profile_data.get("email"),
        full_name=profile_data.get("full_name"),
        created_at=profile_data["created_at"],
    )

    offset = (page - 1) * page_size

    count_resp = (
        supabase.table("listings")
        .select("id", count="exact")
        .eq("owner_id", user_id)
        .eq("status", "active")
        .execute()
    )
    total_count = count_resp.count or 0

    listings_resp = (
        supabase.table("listings")
        .select("*")
        .eq("owner_id", user_id)
        .eq("status", "active")
        .order("created_at", desc=True)
        .range(offset, offset + page_size - 1)
        .execute()
    )

    listings = []
    for row in listings_resp.data or []:
        images_resp = (
            supabase.table("listing_images")
            .select("storage_path")
            .eq("listing_id", row["id"])
            .order("position")
            .execute()
        )
        images = [img["storage_path"] for img in images_resp.data]

        amenities_resp = (
            supabase.table("listing_amenities")
            .select("amenity")
            .eq("listing_id", row["id"])
            .execute()
        )
        amenities = [a["amenity"] for a in amenities_resp.data]

        listings.append(
            ListingDetail(
                id=row["id"],
                owner_id=row["owner_id"],
                description=row["description"],
                sublet_type=row["sublet_type"],
                bedrooms=float(row["bedrooms"]),
                bathrooms=float(row["bathrooms"]),
                sqft=row.get("sqft"),
                monthly_rent_cents=row["monthly_rent_cents"],
                utilities_included=row["utilities_included"],
                additional_fees_cents=row["additional_fees_cents"],
                furnished=row["furnished"],
                location=row["location"],
                address=row["address"],
                start_date=row["start_date"],
                end_date=row["end_date"],
                status=row["status"],
                created_at=row["created_at"],
                updated_at=row["updated_at"],
                amenities=amenities,
                images=images,
            )
        )

    return ProfileWithListingsResponse(
        profile=profile,
        listings=listings,
        page=page,
        page_size=page_size,
        total_count=total_count,
        total_pages=max(1, math.ceil(total_count / page_size)),
    )
