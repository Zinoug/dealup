from datetime import datetime
from typing import Any, Literal

from pydantic import AnyHttpUrl, BaseModel, Field


class ListingIdentifyRequest(BaseModel):
    url: AnyHttpUrl


class ListingTeaser(BaseModel):
    title: str
    asking_price_cents: int | None = None
    currency: str = "EUR"
    thumbnail_url: str | None = None
    preview_photo_urls: list[str] = Field(default_factory=list, max_length=6)
    location: str | None = None
    photo_count: int = 0
    facts: list[str] = Field(default_factory=list)


class CompatibleDevice(BaseModel):
    category: Literal["IPHONE", "MACBOOK"]
    profile_code: str
    display_name: str
    specs: dict[str, str | int] = Field(default_factory=dict)
    catalog_version: str


class ListingCompatibility(BaseModel):
    status: Literal["SUPPORTED", "UNSUPPORTED", "UNKNOWN"]
    reason: str | None = None
    device: CompatibleDevice | None = None


class ListingIdentificationResponse(BaseModel):
    identification_id: str
    source: Literal["leboncoin"] = "leboncoin"
    external_id: str | None
    teaser: ListingTeaser
    compatibility: ListingCompatibility
    access: dict[str, bool]
    created_at: datetime


class CompatibleDeviceCategory(BaseModel):
    code: Literal["IPHONE", "MACBOOK"]
    label: str
    supported_range: str
    asset_key: str | None = None
    models: list[str]


class CompatibleDevicesResponse(BaseModel):
    version: str
    categories: list[CompatibleDeviceCategory]
    coming_later: list[str]


class UsageBucket(BaseModel):
    limit: int
    used: int
    remaining: int
    period_ends_at: datetime | None


class TopUpBucket(BaseModel):
    remaining: int
    expires_at: None = None


class UsageResponse(BaseModel):
    plan: str
    entitlement: str
    included: UsageBucket
    top_up: TopUpBucket
    available_upsells: list[str]


class MeResponse(BaseModel):
    id: str
    clerk_user_id: str
    created_at: datetime
    email: str | None = None
    display_name: str | None = None
    auth_provider: str | None = None
    usage: UsageResponse


class DeviceCreate(BaseModel):
    push_token: str = Field(min_length=8, max_length=512)
    platform: Literal["ios"] = "ios"


class DeviceResponse(BaseModel):
    id: str
    platform: str
    created_at: datetime


class UploadCreate(BaseModel):
    content_type: Literal["image/jpeg", "image/png", "image/heic", "image/webp"]
    size_bytes: int = Field(gt=0, le=10_000_000)


class UploadResponse(BaseModel):
    media_id: str
    object_key: str
    upload: dict[str, Any]
    expires_in_seconds: int


class BillingSyncResponse(BaseModel):
    synced: bool
    plan: str
    entitlement: str


class MessageResponse(BaseModel):
    message: str
