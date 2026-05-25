from datetime import date
from typing import Annotated, Literal

from pydantic import BaseModel, Field, field_validator, model_validator

SubletType = Literal["one_bedroom", "entire_house"]

Amenity = Literal[
    "wifi",
    "air_conditioning",
    "heating",
    "washer",
    "dryer",
    "dishwasher",
    "parking",
    "gym",
    "pool",
    "pets_allowed",
    "balcony",
    "elevator",
    "doorman",
    "storage",
]

MAX_IMAGES = 10
MAX_AMENITIES = 14


class ListingCreate(BaseModel):
    """Payload from the frontend Create Listing form."""

    description: Annotated[str, Field(min_length=1, max_length=5000)]
    sublet_type: SubletType
    bedrooms: Annotated[float, Field(ge=0, le=50)]
    bathrooms: Annotated[float, Field(ge=0, le=50)]
    sqft: Annotated[int | None, Field(ge=0, le=1_000_000)] = None
    monthly_rent: Annotated[float, Field(ge=0, le=10_000_000)]
    utilities_included: bool = False
    additional_fees: Annotated[float, Field(ge=0, le=10_000_000)] = 0
    furnished: bool = False
    location: Annotated[str, Field(min_length=1, max_length=200)]
    address: Annotated[str, Field(min_length=1, max_length=500)]
    start_date: date
    end_date: date
    amenities: Annotated[list[Amenity], Field(max_length=MAX_AMENITIES)] = []
    image_paths: Annotated[list[str], Field(min_length=1, max_length=MAX_IMAGES)]

    @field_validator("image_paths")
    @classmethod
    def _no_blank_paths(cls, v: list[str]) -> list[str]:
        cleaned = [p.strip() for p in v if p and p.strip()]
        if not cleaned:
            raise ValueError("image_paths must contain at least one non-empty path")
        return cleaned

    @field_validator("amenities")
    @classmethod
    def _unique_amenities(cls, v: list[Amenity]) -> list[Amenity]:
        seen: set[Amenity] = set()
        result: list[Amenity] = []
        for a in v:
            if a not in seen:
                seen.add(a)
                result.append(a)
        return result

    @model_validator(mode="after")
    def _dates_in_order(self) -> "ListingCreate":
        if self.end_date <= self.start_date:
            raise ValueError("end_date must be after start_date")
        return self


class ListingResponse(BaseModel):
    id: str
    owner_id: str
    status: str
    created_at: str


class ListingDetail(BaseModel):
    """Full listing details for display."""

    id: str
    owner_id: str
    description: str
    sublet_type: SubletType
    bedrooms: float
    bathrooms: float
    sqft: int | None
    monthly_rent_cents: int
    utilities_included: bool
    additional_fees_cents: int
    furnished: bool
    location: str
    address: str
    start_date: date
    end_date: date
    status: str
    created_at: str
    updated_at: str
    amenities: list[Amenity]
    images: list[str]
