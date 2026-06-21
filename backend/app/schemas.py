import json
import math
from datetime import date
from typing import Annotated, Generic, Literal, TypeVar

from pydantic import BaseModel, Field, field_validator, model_validator

T = TypeVar("T")


class PaginatedResponse(BaseModel, Generic[T]):
    """Envelope for paginated list endpoints."""

    items: list[T]
    page: int
    page_size: int
    total_count: int
    total_pages: int

    @classmethod
    def build(
        cls, *, items: list[T], page: int, page_size: int, total_count: int
    ) -> "PaginatedResponse[T]":
        return cls(
            items=items,
            page=page,
            page_size=page_size,
            total_count=total_count,
            total_pages=max(1, math.ceil(total_count / page_size)),
        )

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

REQUIRED_ADDRESS_FIELDS = {"street", "city", "state", "zip5"}


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

    @field_validator("address")
    @classmethod
    def _validate_address_json(cls, v: str) -> str:
        """Validate that address is a JSON object with required fields."""
        try:
            data = json.loads(v)
        except json.JSONDecodeError as e:
            raise ValueError(f"Address must be valid JSON: {e}")

        if not isinstance(data, dict):
            raise ValueError("Address must be a JSON object")

        missing = REQUIRED_ADDRESS_FIELDS - set(data.keys())
        if missing:
            raise ValueError(f"Address missing required fields: {sorted(missing)}")

        for field in REQUIRED_ADDRESS_FIELDS:
            if not isinstance(data[field], str) or not data[field].strip():
                raise ValueError(f"Address field '{field}' must be a non-empty string")

        if len(data.get("state", "")) != 2:
            raise ValueError("State must be a 2-letter abbreviation")

        zip5 = data.get("zip5", "")
        if len(zip5) != 5 or not zip5.isdigit():
            raise ValueError("zip5 must be a 5-digit string")

        return v

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


# ---------------------------------------------------------------------
# Chat & Messaging schemas
# ---------------------------------------------------------------------


class MessageCreate(BaseModel):
    """Create a new message in a chat."""

    content: Annotated[str, Field(min_length=1, max_length=5000)]


class MessageResponse(BaseModel):
    """A single message."""

    id: str
    chat_id: str
    sender_id: str
    content: str
    created_at: str


class ChatParticipant(BaseModel):
    """A participant in a chat."""

    user_id: str
    email: str | None
    full_name: str | None


class ChatResponse(BaseModel):
    """A chat conversation."""

    id: str
    participants: list[ChatParticipant]
    last_message: MessageResponse | None
    unread_count: int
    updated_at: str


class ChatDetailResponse(BaseModel):
    """Full chat details including paginated messages."""

    id: str
    participants: list[ChatParticipant]
    messages: list[MessageResponse]
    page: int
    page_size: int
    total_messages: int
    total_pages: int


class StartChatRequest(BaseModel):
    """Request to start a chat with another user."""

    other_user_id: str


class StartChatResponse(BaseModel):
    """Response from starting a chat."""

    chat_id: str


class UnreadCountResponse(BaseModel):
    """Total unread message count."""

    unread_count: int


# ---------------------------------------------------------------------
# Profile schemas
# ---------------------------------------------------------------------


class ProfileResponse(BaseModel):
    """Public profile information."""

    id: str
    email: str | None
    full_name: str | None
    created_at: str


class ProfileWithListingsResponse(BaseModel):
    """Profile with the user's active listings (paginated)."""

    profile: ProfileResponse
    listings: list[ListingDetail]
    page: int
    page_size: int
    total_count: int
    total_pages: int
