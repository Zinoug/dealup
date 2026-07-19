from enum import StrEnum

from pydantic import BaseModel, Field


class VerdictType(StrEnum):
    BUY = "BUY"
    NEGOTIATE = "NEGOTIATE"
    VERIFY_FIRST = "VERIFY_FIRST"
    PASS = "PASS"


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


class AnalysisResult(BaseModel):
    """Public report shape persisted by the worker and revalidated by FastAPI."""

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
