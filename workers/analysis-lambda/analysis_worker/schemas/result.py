from enum import StrEnum

from pydantic import BaseModel, Field


class VerdictType(StrEnum):
    BUY = "BUY"
    NEGOTIATE = "NEGOTIATE"
    VERIFY_FIRST = "VERIFY_FIRST"
    PASS = "PASS"


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


class ObservationKind(StrEnum):
    FACT = "FACT"
    INFERENCE = "INFERENCE"
    MISSING = "MISSING"


class EvidenceType(StrEnum):
    LISTING_ATTRIBUTE = "LISTING_ATTRIBUTE"
    LISTING_TEXT = "LISTING_TEXT"
    LISTING_PHOTO = "LISTING_PHOTO"
    SELLER_MESSAGE = "SELLER_MESSAGE"
    SELLER_MEDIA = "SELLER_MEDIA"
    WEB_MARKET = "WEB_MARKET"
    PRIOR_ANALYSIS = "PRIOR_ANALYSIS"


class EvidenceRef(BaseModel):
    source_type: EvidenceType
    ref: str = Field(min_length=1, max_length=120)


class DeviceIdentity(BaseModel):
    category: str = Field(pattern="^(IPHONE|MACBOOK)$")
    profile_code: str = Field(min_length=1, max_length=100)
    display_name: str = Field(min_length=1, max_length=140)
    specs: dict[str, str | int] = Field(default_factory=dict)
    confidence: ConfidenceLevel


class ScoreDimension(BaseModel):
    score: int = Field(ge=0, le=100)
    rationale: str = Field(min_length=1, max_length=320)
    evidence_refs: list[EvidenceRef] = Field(default_factory=list, max_length=10)


class ScoreBreakdown(BaseModel):
    PRICE_VALUE: ScoreDimension
    CONDITION: ScoreDimension
    PROOFS_OWNERSHIP: ScoreDimension
    LISTING_CONSISTENCY: ScoreDimension
    TRANSACTION_SAFETY: ScoreDimension


class Observation(BaseModel):
    id: str = Field(min_length=1, max_length=80)
    kind: ObservationKind
    text: str = Field(min_length=1, max_length=320)
    evidence_refs: list[EvidenceRef] = Field(default_factory=list, max_length=10)


class GeneratedFindingContent(BaseModel):
    display_title: str = Field(min_length=1, max_length=80)
    commentary: str = Field(min_length=1, max_length=320)
    recommended_check: str = Field(min_length=1, max_length=220)


class RiskCandidate(BaseModel):
    code: str = Field(min_length=1, max_length=80)
    status: FindingStatus
    severity: Severity
    evidence_refs: list[EvidenceRef] = Field(min_length=1, max_length=10)
    generated_content: GeneratedFindingContent


class PositiveSignalCandidate(BaseModel):
    code: str = Field(min_length=1, max_length=80)
    label: str = Field(min_length=1, max_length=300)
    evidence_refs: list[EvidenceRef] = Field(min_length=1, max_length=10)


class MissingInformationCandidate(BaseModel):
    code: str = Field(min_length=1, max_length=80)
    priority: str = Field(pattern="^(BLOCKING|USEFUL)$")
    label: str = Field(min_length=1, max_length=300)
    question: str = Field(min_length=1, max_length=500)


class PricingCandidate(BaseModel):
    currency: str = Field(default="EUR", pattern="^[A-Z]{3}$")
    asking_price_cents: int = Field(ge=0)
    market_low_cents: int = Field(ge=0)
    market_median_cents: int = Field(ge=0)
    market_high_cents: int = Field(ge=0)
    fair_price_cents: int = Field(ge=0)
    opening_offer_cents: int = Field(ge=0)
    agreement_zone_low_cents: int = Field(ge=0)
    agreement_zone_high_cents: int = Field(ge=0)
    max_recommended_cents: int = Field(ge=0)
    confidence: ConfidenceLevel
    commentary: str = Field(min_length=1, max_length=300)


class ActionCandidate(BaseModel):
    type: ActionType
    reason: str = Field(min_length=1, max_length=300)


class SellerMessages(BaseModel):
    request_proofs: str = Field(min_length=1, max_length=700)
    make_offer: str = Field(min_length=1, max_length=700)
    decline: str = Field(min_length=1, max_length=700)


class ChecklistSelection(BaseModel):
    before_meeting: list[str] = Field(default_factory=list, max_length=20)
    during_meeting: list[str] = Field(default_factory=list, max_length=30)
    before_payment: list[str] = Field(default_factory=list, max_length=20)


class GeminiCandidateV2(BaseModel):
    schema_version: str = "2.0"
    device_identity: DeviceIdentity
    verdict_candidate: VerdictType
    confidence: ConfidenceLevel
    headline: str = Field(min_length=1, max_length=90)
    summary: str = Field(min_length=1, max_length=450)
    score_breakdown: ScoreBreakdown
    observations: list[Observation] = Field(default_factory=list, max_length=30)
    pricing: PricingCandidate
    risks: list[RiskCandidate] = Field(default_factory=list, max_length=20)
    positive_signals: list[PositiveSignalCandidate] = Field(
        default_factory=list, max_length=20
    )
    missing_information: list[MissingInformationCandidate] = Field(
        default_factory=list, max_length=20
    )
    primary_action_candidate: ActionCandidate
    messages: SellerMessages
    checklist_selection: ChecklistSelection
    available_actions: list[ActionType] = Field(min_length=1, max_length=5)
    expert_note: str | None = Field(default=None, max_length=300)
    change_summary: list[str] = Field(default_factory=list, max_length=10)


class AnalysisResult(BaseModel):
    """Validated public report persisted by the worker."""

    schema_version: str = "2.0"
    template_id: VerdictType
    listing: dict
    device: dict
    verdict: dict
    score_breakdown: dict
    primary_action: dict
    pricing: dict
    risks: dict
    positive_signals: list[dict]
    missing_information: list[dict]
    messages: dict
    checklist: dict
    available_actions: list[ActionType]
    expert_note: str | None = None
    change_summary: list[str] = Field(default_factory=list)
