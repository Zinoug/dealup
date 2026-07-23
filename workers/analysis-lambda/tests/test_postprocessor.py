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
    candidate, _ = sanitize_candidate(
        candidate_payload(
            risk_code="OTHER", risk_severity="MEDIUM", sensitive_commentary=True
        )
    )
    processed = build_report(
        candidate,
        normalized_listing=normalized_listing(),
        device_profile=device_profile(),
        purchase_mode="delivery",
    )

    assert processed.result.risks["items"] == []


def test_sensitive_inference_is_removed_from_internal_candidate_too() -> None:
    candidate = candidate_payload(
        risk_code="OTHER", risk_severity="MEDIUM", sensitive_commentary=True
    )
    candidate["summary"] = "Le vendeur est peut-être musulman."

    sanitized, count = sanitize_candidate(candidate)

    assert count == 2
    assert sanitized["risks"] == []
    assert "musulman" not in sanitized["summary"]


def test_internal_codes_do_not_leak_to_public_change_summary() -> None:
    candidate = candidate_payload()
    candidate["changes"] = [
        "Le risque d'absence de preuve d'achat (OWNERSHIP_PROOF_UNVERIFIED) a été marqué comme résolu.",
        "PAYMENT_OUTSIDE_PLATFORM est moins probable.",
        "La réponse du vendeur rend la facture plus crédible.",
    ]

    sanitized, _ = sanitize_candidate(candidate)
    processed = build_report(
        sanitized,
        normalized_listing=normalized_listing(),
        device_profile=device_profile(),
        purchase_mode="delivery",
    )

    changes = processed.result.change_summary
    assert changes == [
        "Le risque d'absence de preuve d'achat a été marqué comme résolu.",
        "La réponse du vendeur rend la facture plus crédible.",
    ]
    assert "OWNERSHIP_PROOF_UNVERIFIED" not in " ".join(changes)
    assert "PAYMENT_OUTSIDE_PLATFORM" not in " ".join(changes)


def test_internal_codes_do_not_leak_to_public_copy() -> None:
    candidate = candidate_payload(risk_code="OWNERSHIP_PROOF_UNVERIFIED")
    candidate["headline"] = "OWNERSHIP_PROOF_UNVERIFIED résolu"
    candidate["risks"][0]["comment"] = (
        "La preuve envoyée couvre ce point (OWNERSHIP_PROOF_UNVERIFIED)."
    )

    sanitized, _ = sanitize_candidate(candidate)
    processed = build_report(
        sanitized,
        normalized_listing=normalized_listing(),
        device_profile=device_profile(),
        purchase_mode="delivery",
    )

    assert processed.result.verdict["headline"] == "Analyse de l’annonce à vérifier"
    risk_commentary = processed.result.risks["items"][0]["commentary"]
    assert "OWNERSHIP_PROOF_UNVERIFIED" not in risk_commentary


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
    first = candidate["risks"][0]
    candidate["risks"] = [first, {**first, "code": "CONDITION_NOT_VERIFIED"}]

    processed = build_report(
        candidate,
        normalized_listing=normalized_listing(),
        device_profile=device_profile(),
        purchase_mode="face_to_face",
    )

    assert processed.result.verdict["deal_score"] == 64
    assert processed.result.template_id.value == "VERIFY_FIRST"


def test_photo_reflection_and_hidden_button_do_not_create_false_model_conflict() -> (
    None
):
    candidate = candidate_payload(score=75)
    candidate["headline"] = "Incohérences majeures : possible iPhone 15 Pro"
    candidate["summary"] = (
        "La couleur bleue d’une photo et l’absence du bouton Camera Control indiquent "
        "peut-être un iPhone 15 Pro."
    )
    candidate["scores"]["consistency"] = {
        "value": 30,
        "reason": "Les photos montreraient deux couleurs et un autre modèle.",
    }
    candidate["action_reason"] = "Écarter d’abord le mélange de modèles et de couleurs."
    candidate["risks"] = [
        {
            "code": "PHOTO_INCONSISTENCY",
            "status": "CONFIRMED",
            "severity": "HIGH",
            "title": "Mélange de photos ou couleur incohérente",
            "comment": (
                "PHOTO_3 paraît bleue ou grise alors que PHOTO_2 montre un téléphone noir."
            ),
            "check": "Demander quelle est la vraie couleur.",
            "evidence": ["PHOTO_3", "PHOTO_2"],
        },
        {
            "code": "PRODUCT_IDENTITY_UNCLEAR",
            "status": "LIKELY",
            "severity": "HIGH",
            "title": "Le modèle pourrait être un iPhone 15 Pro",
            "comment": (
                "Le bouton Camera Control n’est pas visible sur PHOTO_7 et semble absent."
            ),
            "check": "Demander le modèle exact.",
            "evidence": ["PHOTO_7"],
        },
    ]
    listing = normalized_listing()
    listing.update(
        {
            "title": "iPhone 16 Pro 128 Go",
            "description": "iPhone 16 Pro 128 Go, couleur noire.",
            "attributes": [
                {"key": "phone_model", "value": "iPhone 16 Pro"},
                {"key": "phone_color", "value": "Noir"},
            ],
        }
    )
    profile = device_profile()
    profile.update(
        {
            "profile_code": "IPHONE_16_PRO",
            "display_name": "iPhone 16 Pro",
            "specs": {"storage": "128 Go", "color": "Noir"},
        }
    )

    sanitized, _ = sanitize_candidate(candidate)
    processed = build_report(
        sanitized,
        normalized_listing=listing,
        device_profile=profile,
        purchase_mode="face_to_face",
    )

    risks = {risk["code"]: risk for risk in processed.result.risks["items"]}
    assert risks["COLOR_MISMATCH"]["status"] == "UNVERIFIED"
    assert risks["COLOR_MISMATCH"]["severity"] == "LOW"
    assert risks["PRODUCT_IDENTITY_UNCLEAR"]["status"] == "UNVERIFIED"
    assert risks["PRODUCT_IDENTITY_UNCLEAR"]["severity"] == "MEDIUM"
    assert "iPhone 15" not in processed.result.verdict["headline"]
    assert "iPhone 15" not in processed.result.verdict["explanation"]
    consistency = processed.result.score_breakdown["LISTING_CONSISTENCY"]
    assert consistency["score"] >= 60
    assert "concordent" in consistency["rationale"]
    assert processed.metadata["guarded_visual_risk_count"] == 2


def test_positive_readable_model_contradiction_remains_high() -> None:
    candidate = candidate_payload(score=88)
    candidate["risks"] = [
        {
            "code": "PRODUCT_IDENTITY_UNCLEAR",
            "status": "LIKELY",
            "severity": "HIGH",
            "title": "Le modèle affiché ne correspond pas",
            "comment": (
                "PHOTO_1 affiche dans Réglages > Général > Informations : iPhone 15 Pro."
            ),
            "check": "Comparer le numéro de modèle à la boîte et à la facture.",
            "evidence": ["PHOTO_1"],
        }
    ]
    listing = normalized_listing()
    listing.update(
        {
            "title": "iPhone 16 Pro 128 Go",
            "description": "iPhone 16 Pro noir.",
            "attributes": [{"key": "phone_model", "value": "iPhone 16 Pro"}],
        }
    )
    profile = device_profile()
    profile.update({"profile_code": "IPHONE_16_PRO", "display_name": "iPhone 16 Pro"})

    sanitized, _ = sanitize_candidate(candidate)
    processed = build_report(
        sanitized,
        normalized_listing=listing,
        device_profile=profile,
        purchase_mode="face_to_face",
    )

    risk = processed.result.risks["items"][0]
    assert risk["status"] == "LIKELY"
    assert risk["severity"] == "HIGH"
    assert processed.metadata["guarded_visual_risk_count"] == 0
    assert processed.result.template_id.value == "VERIFY_FIRST"


def test_macbook_photo_only_color_variation_is_not_blocking() -> None:
    candidate = candidate_payload(category="MACBOOK", score=80)
    candidate["risks"] = [
        {
            "code": "PHOTO_INCONSISTENCY",
            "status": "CONFIRMED",
            "severity": "HIGH",
            "title": "Couleur différente entre les photos",
            "comment": "PHOTO_1 paraît gris clair et PHOTO_2 paraît gris foncé.",
            "check": "Confirmer la couleur.",
            "evidence": ["PHOTO_1", "PHOTO_2"],
        }
    ]

    sanitized, _ = sanitize_candidate(candidate)
    processed = build_report(
        sanitized,
        normalized_listing=normalized_listing("MACBOOK"),
        device_profile=device_profile("MACBOOK"),
        purchase_mode="face_to_face",
    )

    risk = processed.result.risks["items"][0]
    assert risk["code"] == "PHOTO_INCONSISTENCY"
    assert risk["status"] == "UNVERIFIED"
    assert risk["severity"] == "LOW"
    assert processed.result.verdict["deal_score"] > 59
