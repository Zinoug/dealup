import enum
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


def new_id() -> str:
    return str(uuid.uuid4())


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def enum_type(enum_class: type[enum.Enum]) -> Enum:
    return Enum(
        enum_class,
        native_enum=False,
        values_callable=lambda members: [member.value for member in members],
    )


def json_type() -> JSON:
    return JSON().with_variant(JSONB(), "postgresql")


class AnalysisStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class AnalysisKind(str, enum.Enum):
    INITIAL = "initial"
    REANALYSIS = "reanalysis"
    REFRESH = "refresh"


class PurchaseMode(str, enum.Enum):
    FACE_TO_FACE = "face_to_face"
    DELIVERY = "delivery"
    UNKNOWN = "unknown"


class SubscriptionPlan(str, enum.Enum):
    NONE = "none"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    PROMOTIONAL = "promotional"


class SubscriptionStatus(str, enum.Enum):
    INACTIVE = "inactive"
    ACTIVE = "active"
    GRACE_PERIOD = "grace_period"
    BILLING_ISSUE = "billing_issue"


class UsageEventKind(str, enum.Enum):
    INCLUDED_CREDIT = "included_credit"
    INCLUDED_DEBIT = "included_debit"
    TOPUP_CREDIT = "topup_credit"
    TOPUP_DEBIT = "topup_debit"
    FAILURE_REVERSAL = "failure_reversal"
    MANUAL_ADJUSTMENT = "manual_adjustment"


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    clerk_user_id: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    email: Mapped[str | None] = mapped_column(String(320), index=True)
    display_name: Mapped[str | None] = mapped_column(String(255))
    auth_provider: Mapped[str | None] = mapped_column(String(32), index=True)
    clerk_created_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    clerk_synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    free_identification_claimed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True)
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Subscription(Base):
    __tablename__ = "subscriptions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), unique=True
    )
    plan: Mapped[SubscriptionPlan] = mapped_column(
        enum_type(SubscriptionPlan), default=SubscriptionPlan.NONE
    )
    status: Mapped[SubscriptionStatus] = mapped_column(
        enum_type(SubscriptionStatus), default=SubscriptionStatus.INACTIVE
    )
    product_id: Mapped[str | None] = mapped_column(String(255))
    current_period_started_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True)
    )
    current_period_ends_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True)
    )
    will_renew: Mapped[bool] = mapped_column(Boolean, default=False)
    environment: Mapped[str | None] = mapped_column(String(32))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )


class ListingIdentification(Base):
    __tablename__ = "listing_identifications"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    source: Mapped[str] = mapped_column(String(32), default="leboncoin")
    source_url: Mapped[str] = mapped_column(Text)
    external_id: Mapped[str | None] = mapped_column(String(128), index=True)
    payload: Mapped[dict[str, Any]] = mapped_column(json_type())
    normalized_payload: Mapped[dict[str, Any]] = mapped_column(
        json_type(), default=dict
    )
    teaser: Mapped[dict[str, Any]] = mapped_column(json_type())
    compatibility_status: Mapped[str] = mapped_column(String(32), default="UNKNOWN")
    device_category: Mapped[str | None] = mapped_column(String(32), index=True)
    device_profile: Mapped[dict[str, Any] | None] = mapped_column(json_type())
    catalog_version: Mapped[str] = mapped_column(String(32), default="1.0")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow
    )
    consumed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Analysis(Base):
    __tablename__ = "analyses"
    __table_args__ = (
        UniqueConstraint(
            "user_id", "idempotency_key", name="uq_analysis_user_idempotency"
        ),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    identification_id: Mapped[str | None] = mapped_column(
        ForeignKey("listing_identifications.id", ondelete="SET NULL")
    )
    parent_analysis_id: Mapped[str | None] = mapped_column(
        ForeignKey("analyses.id", ondelete="SET NULL"), index=True
    )
    root_analysis_id: Mapped[str | None] = mapped_column(String(36), index=True)
    kind: Mapped[AnalysisKind] = mapped_column(enum_type(AnalysisKind))
    status: Mapped[AnalysisStatus] = mapped_column(
        enum_type(AnalysisStatus), default=AnalysisStatus.PENDING, index=True
    )
    idempotency_key: Mapped[str] = mapped_column(String(255))
    request_fingerprint: Mapped[str] = mapped_column(String(64))
    purchase_mode: Mapped[PurchaseMode] = mapped_column(enum_type(PurchaseMode))
    input_snapshot: Mapped[dict[str, Any]] = mapped_column(json_type(), default=dict)
    seller_context: Mapped[dict[str, Any]] = mapped_column(json_type(), default=dict)
    device_category: Mapped[str | None] = mapped_column(String(32), index=True)
    candidate_result: Mapped[dict[str, Any] | None] = mapped_column(json_type())
    result: Mapped[dict[str, Any] | None] = mapped_column(json_type())
    run_metadata: Mapped[dict[str, Any]] = mapped_column(json_type(), default=dict)
    template_id: Mapped[str | None] = mapped_column(String(32), index=True)
    model_id: Mapped[str | None] = mapped_column(String(128))
    engine_revision: Mapped[str] = mapped_column(String(64), default="current")
    input_tokens: Mapped[int | None] = mapped_column(Integer)
    output_tokens: Mapped[int | None] = mapped_column(Integer)
    thought_tokens: Mapped[int | None] = mapped_column(Integer)
    search_count: Mapped[int | None] = mapped_column(Integer)
    listing_image_count: Mapped[int | None] = mapped_column(Integer)
    private_image_count: Mapped[int | None] = mapped_column(Integer)
    piloterr_duration_ms: Mapped[int | None] = mapped_column(Integer)
    gemini_duration_ms: Mapped[int | None] = mapped_column(Integer)
    total_duration_ms: Mapped[int | None] = mapped_column(Integer)
    theoretical_cost_microusd: Mapped[int | None] = mapped_column(BigInteger)
    piloterr_cost_microeur: Mapped[int | None] = mapped_column(BigInteger)
    error_code: Mapped[str | None] = mapped_column(String(128))
    error_message: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, index=True
    )
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )


class UsageEvent(Base):
    __tablename__ = "usage_events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    analysis_id: Mapped[str | None] = mapped_column(
        ForeignKey("analyses.id", ondelete="SET NULL"), index=True
    )
    kind: Mapped[UsageEventKind] = mapped_column(enum_type(UsageEventKind))
    amount: Mapped[int] = mapped_column(Integer)
    source_event_id: Mapped[str | None] = mapped_column(String(255), unique=True)
    period_started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    period_ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, index=True
    )


class RevenueCatEvent(Base):
    __tablename__ = "revenuecat_events"

    id: Mapped[str] = mapped_column(String(255), primary_key=True)
    event_type: Mapped[str] = mapped_column(String(128))
    app_user_id: Mapped[str | None] = mapped_column(String(255), index=True)
    payload: Mapped[dict[str, Any]] = mapped_column(json_type())
    processed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow
    )


class Device(Base):
    __tablename__ = "devices"
    __table_args__ = (UniqueConstraint("push_token", name="uq_device_push_token"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    push_token: Mapped[str] = mapped_column(String(512))
    platform: Mapped[str] = mapped_column(String(32), default="ios")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )


class Media(Base):
    __tablename__ = "media"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    analysis_id: Mapped[str | None] = mapped_column(
        ForeignKey("analyses.id", ondelete="CASCADE"), index=True
    )
    object_key: Mapped[str] = mapped_column(String(1024), unique=True)
    content_type: Mapped[str] = mapped_column(String(128))
    size_bytes: Mapped[int] = mapped_column(Integer)
    sha256: Mapped[str | None] = mapped_column(String(64))
    role: Mapped[str] = mapped_column(String(32), default="seller_media")
    ordinal: Mapped[int | None] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(32), default="pending")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow
    )


class DeletionJob(Base):
    __tablename__ = "deletion_jobs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    user_id: Mapped[str | None] = mapped_column(String(36), index=True)
    kind: Mapped[str] = mapped_column(String(32))
    status: Mapped[str] = mapped_column(String(32), default="pending", index=True)
    object_keys: Mapped[list[str]] = mapped_column(json_type(), default=list)
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    error_message: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
