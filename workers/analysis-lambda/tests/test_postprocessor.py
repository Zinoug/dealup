import pytest

from analysis_worker.services.postprocessor import build_report, sanitize_candidate
from tests.factories import candidate_payload, device_profile, normalized_listing


@pytest.mark.parametrize("category", ["IPHONE", "MACBOOK"])
@pytest.mark.parametrize(
    ("expected", "score", "risk_code", "risk_status", "risk_severity", "asking"),
    [
        ("BUY", 88, None, "UNVERIFIED", "HIGH", 68000),
        ("NEGOTIATE", 75, None, "UNVERIFIED", "HIGH", 72000),
        ("VERIFY_FIRST", 88, "OWNERSHIP_PROOF_UNVERIFIED", "UNVERIFIED", "HIGH", 72000),
        ("PASS", 88, "ADVANCE_PAYMENT_REQUESTED", "CONFIRMED", "CRITICAL", 72000),
    ],
)
def test_eight_public_template_contracts(
    category, expected, score, risk_code, risk_status, risk_severity, asking
) -> None:
    listing = normalized_listing(category)
    listing["asking_price_cents"] = asking
    processed = build_report(
        candidate_payload(
            category=category,
            score=score,
            risk_code=risk_code,
            risk_status=risk_status,
            risk_severity=risk_severity,
        ),
        normalized_listing=listing,
        device_profile=device_profile(category),
        purchase_mode="face_to_face",
    )

    assert processed.result.template_id.value == expected
    assert processed.result.device["category"] == category
    assert processed.result.schema_version == "2.0"
    assert processed.result.checklist["during_meeting"]


def test_unknown_code_becomes_limited_other() -> None:
    processed = build_report(
        candidate_payload(risk_code="NEW_UNAPPROVED_RISK", risk_severity="CRITICAL"),
        normalized_listing=normalized_listing(),
        device_profile=device_profile(),
        purchase_mode="delivery",
    )

    risk = processed.result.risks["items"][0]
    assert risk["code"] == "OTHER"
    assert risk["severity"] == "MEDIUM"
    assert processed.metadata["other_risk_count"] == 1


def test_sensitive_inference_is_removed() -> None:
    processed = build_report(
        candidate_payload(
            risk_code="OTHER", risk_severity="MEDIUM", sensitive_commentary=True
        ),
        normalized_listing=normalized_listing(),
        device_profile=device_profile(),
        purchase_mode="delivery",
    )

    assert processed.result.risks["items"] == []
    assert processed.metadata["sensitive_finding_dropped_count"] == 1


def test_sensitive_inference_is_removed_from_internal_candidate_too() -> None:
    candidate = candidate_payload(
        risk_code="OTHER", risk_severity="MEDIUM", sensitive_commentary=True
    )
    candidate = candidate.model_copy(
        update={"expert_note": "Le vendeur est peut-être musulman."}
    )

    sanitized, count = sanitize_candidate(candidate)

    assert count == 2
    assert sanitized.risks == []
    assert sanitized.expert_note is None


def test_invalid_pricing_keeps_report_and_caps_verdict() -> None:
    processed = build_report(
        candidate_payload(score=95, invalid_pricing=True),
        normalized_listing=normalized_listing(),
        device_profile=device_profile(),
        purchase_mode="face_to_face",
    )

    assert processed.result.pricing["status"] == "UNAVAILABLE"
    assert processed.result.pricing["potential_savings_cents"] is None
    assert processed.result.template_id.value == "VERIFY_FIRST"


def test_savings_are_recomputed_locally() -> None:
    listing = normalized_listing()
    listing["asking_price_cents"] = 80000
    processed = build_report(
        candidate_payload(score=75),
        normalized_listing=listing,
        device_profile=device_profile(),
        purchase_mode="face_to_face",
    )

    assert processed.result.pricing["potential_savings_cents"] == 11500


def test_two_unresolved_high_risks_cap_score_and_prevent_buy() -> None:
    candidate = candidate_payload(
        score=92, risk_code="SELLER_HISTORY_LIMITED", risk_severity="HIGH"
    )
    first = candidate.risks[0]
    candidate = candidate.model_copy(
        update={
            "risks": [
                first,
                first.model_copy(update={"code": "CONDITION_NOT_VERIFIED"}),
            ]
        }
    )

    processed = build_report(
        candidate,
        normalized_listing=normalized_listing(),
        device_profile=device_profile(),
        purchase_mode="face_to_face",
    )

    assert processed.result.verdict["deal_score"] == 64
    assert processed.result.template_id.value == "VERIFY_FIRST"
