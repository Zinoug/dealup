from typing import Any

from app.domain.devices import classify_listing, normalize_listing


SCORE_DIMENSIONS = (
    "PRICE_VALUE",
    "CONDITION",
    "PROOFS_OWNERSHIP",
    "LISTING_CONSISTENCY",
    "TRANSACTION_SAFETY",
)
ALLOWED_ACTIONS = {
    "REQUEST_PROOFS",
    "MAKE_OFFER",
    "START_CHECKLIST",
    "COMPARE_ANOTHER",
    "AVOID_LISTING",
}


def _status(evidence_type: object) -> str:
    return "UNVERIFIED" if str(evidence_type or "").upper() == "MISSING" else "LIKELY"


def _price(raw: dict[str, Any], asking: int | None) -> dict[str, Any]:
    required = (
        "market_low_cents",
        "market_median_cents",
        "fair_price_cents",
        "opening_offer_cents",
        "agreement_zone_low_cents",
        "agreement_zone_high_cents",
        "max_recommended_cents",
    )
    available = all(isinstance(raw.get(key), int) and raw[key] >= 0 for key in required)
    high = max(
        int(raw.get("market_median_cents") or 0),
        int(raw.get("fair_price_cents") or 0),
        int(raw.get("max_recommended_cents") or 0),
    )
    return {
        "status": "AVAILABLE" if available else "UNAVAILABLE",
        "currency": str(raw.get("currency") or "EUR"),
        "asking_price_cents": asking
        if asking is not None
        else raw.get("asking_price_cents"),
        "market_low_cents": raw.get("market_low_cents") if available else None,
        "market_median_cents": raw.get("market_median_cents") if available else None,
        "market_high_cents": high if available else None,
        "fair_price_cents": raw.get("fair_price_cents") if available else None,
        "opening_offer_cents": raw.get("opening_offer_cents") if available else None,
        "agreement_zone_low_cents": raw.get("agreement_zone_low_cents")
        if available
        else None,
        "agreement_zone_high_cents": raw.get("agreement_zone_high_cents")
        if available
        else None,
        "max_recommended_cents": raw.get("max_recommended_cents")
        if available
        else None,
        "potential_savings_cents": raw.get("potential_savings_cents")
        if available
        else None,
        "confidence": str(raw.get("confidence") or "LOW"),
        "commentary": "Estimation issue d’un rapport DealUp antérieur.",
    }


def adapt_legacy_result(
    raw: dict[str, Any],
    *,
    listing_payload: dict[str, Any] | None,
    normalized_listing: dict[str, Any] | None,
    device_profile: dict[str, Any] | None,
) -> dict[str, Any] | None:
    """Keep completed schema 1.0 reports readable without mutating stored history."""
    if str(raw.get("schema_version")) != "1.0":
        return None
    payload = listing_payload or {}
    normalized = normalized_listing or normalize_listing(payload)
    compatibility = classify_listing(payload)
    device = device_profile or compatibility.as_dict().get("device")
    if not device:
        return None
    verdict = raw.get("verdict") if isinstance(raw.get("verdict"), dict) else {}
    template = str(verdict.get("type") or "VERIFY_FIRST")
    if template not in {"BUY", "NEGOTIATE", "VERIFY_FIRST", "PASS"}:
        template = "VERIFY_FIRST"
    score = max(0, min(100, int(verdict.get("deal_score") or 0)))
    location = (
        normalized.get("location")
        if isinstance(normalized.get("location"), dict)
        else {}
    )
    photos = (
        normalized.get("photos") if isinstance(normalized.get("photos"), list) else []
    )
    raw_risks = raw.get("risks") if isinstance(raw.get("risks"), dict) else {}
    risk_items = []
    for item in raw_risks.get("items") or []:
        if not isinstance(item, dict):
            continue
        title = str(item.get("title") or item.get("code") or "Point à vérifier")[:80]
        risk_items.append(
            {
                "code": str(item.get("code") or "OTHER")[:80],
                "canonical_title": title,
                "status": _status(item.get("evidence_type")),
                "severity": str(item.get("severity") or "MEDIUM"),
                "display_title": title,
                "commentary": str(
                    item.get("explanation") or "Ce point reste à vérifier."
                )[:320],
                "recommended_check": str(
                    item.get("recommended_check")
                    or "Demander une preuve avant le paiement."
                )[:220],
            }
        )
    action = (
        raw.get("primary_action") if isinstance(raw.get("primary_action"), dict) else {}
    )
    action_type = str(action.get("type") or "REQUEST_PROOFS")
    if action_type not in ALLOWED_ACTIONS:
        action_type = "REQUEST_PROOFS"
    messages = raw.get("messages") if isinstance(raw.get("messages"), dict) else {}
    checklist = raw.get("checklist") if isinstance(raw.get("checklist"), dict) else {}
    available_actions = [
        str(value)
        for value in raw.get("available_actions") or []
        if str(value) in ALLOWED_ACTIONS
    ]
    return {
        "schema_version": "2.0",
        "template_id": template,
        "listing": {
            "title": str(normalized.get("title") or "Annonce Leboncoin")[:300],
            "asking_price_cents": normalized.get("asking_price_cents"),
            "currency": str(normalized.get("currency") or "EUR"),
            "thumbnail_url": None,
            "thumbnail_media_id": None,
            "location": ", ".join(
                str(value)
                for value in (location.get("city"), location.get("postal_code"))
                if value
            )
            or None,
            "photo_count": len(photos),
        },
        "device": device,
        "verdict": {
            "type": template,
            "deal_score": score,
            "confidence": str(verdict.get("confidence") or "LOW"),
            "headline": str(verdict.get("headline") or "Rapport DealUp historique")[
                :90
            ],
            "explanation": str(
                verdict.get("explanation")
                or "Ce rapport a été généré avec une version antérieure de DealUp."
            )[:450],
        },
        "score_breakdown": {
            key: {
                "score": score,
                "rationale": "Sous-score non disponible dans ce rapport historique.",
            }
            for key in SCORE_DIMENSIONS
        },
        "primary_action": {
            "type": action_type,
            "label": str(action.get("label") or "Demander les preuves manquantes")[
                :120
            ],
            "reason": str(
                action.get("reason") or "Cette action vient du rapport historique."
            )[:300],
        },
        "pricing": _price(
            raw.get("pricing") if isinstance(raw.get("pricing"), dict) else {},
            normalized.get("asking_price_cents"),
        ),
        "risks": {"level": str(raw_risks.get("level") or "LOW"), "items": risk_items},
        "positive_signals": [
            {
                "code": str(item.get("code") or "LEGACY_SIGNAL")[:80],
                "label": str(item.get("label") or "Signal historique")[:300],
            }
            for item in raw.get("positive_signals") or []
            if isinstance(item, dict)
        ],
        "missing_information": [
            {
                "code": str(item.get("code") or "LEGACY_MISSING")[:80],
                "priority": "BLOCKING",
                "label": str(item.get("label") or "Information manquante")[:300],
                "question": str(
                    item.get("question") or "Pouvez-vous préciser ce point ?"
                )[:500],
            }
            for item in raw.get("missing_information") or []
            if isinstance(item, dict)
        ],
        "messages": {
            "request_proofs": str(
                messages.get("request_proofs")
                or "Bonjour, pouvez-vous fournir les preuves demandées ?"
            )[:700],
            "make_offer": str(
                messages.get("make_offer")
                or "Bonjour, je souhaite vous faire une offre."
            )[:700],
            "decline": str(
                messages.get("decline") or "Merci, je préfère ne pas donner suite."
            )[:700],
        },
        "checklist": {
            "before_meeting": checklist.get("before_meeting") or [],
            "during_meeting": checklist.get("during_meeting") or [],
            "before_payment": checklist.get("before_payment") or [],
        },
        "available_actions": available_actions or [action_type],
        "expert_note": "Rapport historique adapté au nouveau format d’affichage.",
        "change_summary": raw.get("change_summary") or [],
    }
