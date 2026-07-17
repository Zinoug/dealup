from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models import AnalysisKind, AnalysisStatus, PurchaseMode


class VerdictType(StrEnum):
    BUY = "BUY"
    NEGOTIATE = "NEGOTIATE"
    VERIFY_FIRST = "VERIFY_FIRST"
    PASS = "PASS"


class ReportTemplate(StrEnum):
    BUY = "BUY"
    NEGOTIATE = "NEGOTIATE"
    VERIFY_FIRST = "VERIFY_FIRST"
    PASS = "PASS"


class DeviceCategory(StrEnum):
    IPHONE = "IPHONE"
    MACBOOK = "MACBOOK"


class ConfidenceLevel(StrEnum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"


class ActionType(StrEnum):
    REQUEST_PROOFS = "REQUEST_PROOFS"
    MAKE_OFFER = "MAKE_OFFER"
    START_CHECKLIST = "START_CHECKLIST"
    COMPARE_ANOTHER = "COMPARE_ANOTHER"
    AVOID_LISTING = "AVOID_LISTING"


class Severity(StrEnum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class FindingStatus(StrEnum):
    CONFIRMED = "CONFIRMED"
    LIKELY = "LIKELY"
    UNVERIFIED = "UNVERIFIED"
    RESOLVED = "RESOLVED"


class PricingStatus(StrEnum):
    AVAILABLE = "AVAILABLE"
    UNAVAILABLE = "UNAVAILABLE"


class DeviceProfile(BaseModel):
    category: DeviceCategory
    profile_code: str = Field(min_length=1, max_length=100)
    display_name: str = Field(min_length=1, max_length=140)
    specs: dict[str, str | int] = Field(default_factory=dict)
    catalog_version: str


class ReportListing(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    asking_price_cents: int | None = Field(default=None, ge=0)
    currency: str = Field(default="EUR", pattern="^[A-Z]{3}$")
    thumbnail_url: str | None = None
    thumbnail_media_id: str | None = None
    location: str | None = Field(default=None, max_length=200)
    photo_count: int = Field(default=0, ge=0)


class ScoreDimension(BaseModel):
    score: int = Field(ge=0, le=100)
    rationale: str = Field(min_length=1, max_length=320)


class Verdict(BaseModel):
    type: VerdictType
    deal_score: int = Field(ge=0, le=100)
    confidence: ConfidenceLevel
    headline: str = Field(min_length=1, max_length=90)
    explanation: str = Field(min_length=1, max_length=450)


class RecommendedAction(BaseModel):
    type: ActionType
    label: str = Field(min_length=1, max_length=120)
    reason: str = Field(min_length=1, max_length=300)


class Pricing(BaseModel):
    status: PricingStatus = PricingStatus.AVAILABLE
    currency: str = Field(default="EUR", pattern="^[A-Z]{3}$")
    asking_price_cents: int | None = Field(default=None, ge=0)
    market_low_cents: int | None = Field(default=None, ge=0)
    market_median_cents: int | None = Field(default=None, ge=0)
    market_high_cents: int | None = Field(default=None, ge=0)
    fair_price_cents: int | None = Field(default=None, ge=0)
    opening_offer_cents: int | None = Field(default=None, ge=0)
    agreement_zone_low_cents: int | None = Field(default=None, ge=0)
    agreement_zone_high_cents: int | None = Field(default=None, ge=0)
    max_recommended_cents: int | None = Field(default=None, ge=0)
    potential_savings_cents: int | None = Field(default=None, ge=0)
    confidence: ConfidenceLevel
    commentary: str = Field(min_length=1, max_length=300)


class RiskItem(BaseModel):
    code: str = Field(min_length=1, max_length=80)
    canonical_title: str = Field(min_length=1, max_length=140)
    status: FindingStatus
    severity: Severity
    display_title: str = Field(min_length=1, max_length=80)
    commentary: str = Field(min_length=1, max_length=320)
    recommended_check: str = Field(min_length=1, max_length=220)


class Risks(BaseModel):
    level: Severity
    items: list[RiskItem] = Field(default_factory=list, max_length=20)


class PositiveSignal(BaseModel):
    code: str = Field(min_length=1, max_length=80)
    label: str = Field(min_length=1, max_length=300)


class MissingInformation(BaseModel):
    code: str = Field(min_length=1, max_length=80)
    priority: str = Field(pattern="^(BLOCKING|USEFUL)$")
    label: str = Field(min_length=1, max_length=300)
    question: str = Field(min_length=1, max_length=500)


class SellerMessages(BaseModel):
    request_proofs: str = Field(min_length=1, max_length=700)
    make_offer: str = Field(min_length=1, max_length=700)
    decline: str = Field(min_length=1, max_length=700)


class ChecklistItem(BaseModel):
    code: str = Field(min_length=1, max_length=80)
    label: str = Field(min_length=1, max_length=400)
    critical: bool = False


class Checklist(BaseModel):
    before_meeting: list[ChecklistItem] = Field(default_factory=list, max_length=20)
    during_meeting: list[ChecklistItem] = Field(default_factory=list, max_length=30)
    before_payment: list[ChecklistItem] = Field(default_factory=list, max_length=20)


class AnalysisResult(BaseModel):
    schema_version: str = "2.0"
    template_id: ReportTemplate
    listing: ReportListing
    device: DeviceProfile
    verdict: Verdict
    score_breakdown: dict[str, ScoreDimension]
    primary_action: RecommendedAction
    pricing: Pricing
    risks: Risks
    positive_signals: list[PositiveSignal] = Field(default_factory=list, max_length=20)
    missing_information: list[MissingInformation] = Field(
        default_factory=list, max_length=20
    )
    messages: SellerMessages
    checklist: Checklist
    available_actions: list[ActionType] = Field(min_length=1, max_length=5)
    expert_note: str | None = Field(default=None, max_length=300)
    change_summary: list[str] = Field(default_factory=list, max_length=10)


class SellerContext(BaseModel):
    already_contacted: bool = False
    reply_text: str | None = Field(default=None, max_length=10_000)
    media_ids: list[str] = Field(default_factory=list, max_length=10)

    @model_validator(mode="after")
    def validate_context(self) -> "SellerContext":
        if not self.already_contacted and (self.reply_text or self.media_ids):
            raise ValueError("seller context requires already_contacted=true")
        return self


class AnalysisCreate(BaseModel):
    identification_id: str
    purchase_mode: PurchaseMode
    seller_context: SellerContext = Field(default_factory=SellerContext)


class ReanalysisCreate(BaseModel):
    reply_text: str | None = Field(default=None, max_length=10_000)
    media_ids: list[str] = Field(default_factory=list, max_length=10)
    purchase_mode: PurchaseMode | None = None

    @model_validator(mode="after")
    def require_new_context(self) -> "ReanalysisCreate":
        if not self.reply_text and not self.media_ids and self.purchase_mode is None:
            raise ValueError("at least one reanalysis input is required")
        return self


class AnalysisAccepted(BaseModel):
    analysis_id: str
    status: AnalysisStatus
    quota_source: str | None
    created_at: datetime


class AnalysisRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    kind: AnalysisKind
    parent_analysis_id: str | None
    status: AnalysisStatus
    purchase_mode: PurchaseMode
    result: AnalysisResult | None
    error_code: str | None
    error_message: str | None
    created_at: datetime
    started_at: datetime | None
    completed_at: datetime | None


class AnalysisSummary(BaseModel):
    id: str
    latest_analysis_id: str
    status: AnalysisStatus
    kind: AnalysisKind
    device: DeviceProfile | None = None
    listing: ReportListing | None = None
    verdict: Verdict | None = None
    template_id: ReportTemplate | None = None
    created_at: datetime
    completed_at: datetime | None


class AnalysisList(BaseModel):
    items: list[AnalysisSummary]
    next_cursor: str | None = None
