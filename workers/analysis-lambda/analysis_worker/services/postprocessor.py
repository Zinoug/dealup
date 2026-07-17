from dataclasses import dataclass
from typing import Any

from analysis_worker.contracts import AnalysisContracts, get_contracts
from analysis_worker.schemas.result import (
    ActionType,
    AnalysisResult,
    FindingStatus,
    GeminiCandidateV2,
    Severity,
    VerdictType,
)


SENSITIVE_TERMS = {
    "musulman",
    "musulmane",
    "chrétien",
    "chrétienne",
    "juif",
    "juive",
    "maghrébin",
    "maghrébine",
    "africain",
    "africaine",
    "arabe",
    "origine ethnique",
    "religion",
}

SEVERITY_ORDER = {
    Severity.LOW: 1,
    Severity.MEDIUM: 2,
    Severity.HIGH: 3,
    Severity.CRITICAL: 4,
}

ACTION_LABELS = {
    ActionType.REQUEST_PROOFS: "Demander les preuves manquantes",
    ActionType.MAKE_OFFER: "Préparer une offre",
    ActionType.START_CHECKLIST: "Démarrer la checklist",
    ActionType.COMPARE_ANOTHER: "Analyser une autre annonce",
    ActionType.AVOID_LISTING: "Éviter cette annonce",
}


@dataclass(frozen=True)
class ProcessedReport:
    result: AnalysisResult
    metadata: dict[str, Any]


def sanitize_candidate(candidate: GeminiCandidateV2) -> tuple[GeminiCandidateV2, int]:
    """Remove sensitive-trait reasoning before either internal or public persistence."""
    payload = candidate.model_dump(mode="json")
    dropped = 0

    def replace(container: dict[str, Any], key: str, fallback: str | None) -> None:
        nonlocal dropped
        value = container.get(key)
        if isinstance(value, str) and _contains_sensitive_text(value):
            container[key] = fallback
            dropped += 1

    replace(payload, "headline", "Analyse de l’annonce à vérifier")
    replace(
        payload,
        "summary",
        "DealUp a écarté un commentaire non pertinent et conserve uniquement les éléments vérifiables de l’annonce.",
    )
    replace(payload, "expert_note", None)
    for value in payload.get("score_breakdown", {}).values():
        if isinstance(value, dict):
            replace(
                value,
                "rationale",
                "Sous-score fondé uniquement sur les éléments vérifiables du dossier.",
            )
    if isinstance(payload.get("pricing"), dict):
        replace(
            payload["pricing"],
            "commentary",
            "Estimation fondée sur la configuration et le marché observé.",
        )
    if isinstance(payload.get("primary_action_candidate"), dict):
        replace(
            payload["primary_action_candidate"],
            "reason",
            "Cette action dépend uniquement des preuves et risques vérifiables.",
        )
    if isinstance(payload.get("messages"), dict):
        fallbacks = {
            "request_proofs": "Bonjour, pouvez-vous transmettre les preuves demandées dans l’annonce ?",
            "make_offer": "Bonjour, je souhaite vous faire une offre sous réserve des vérifications.",
            "decline": "Merci pour votre réponse. Je préfère ne pas donner suite.",
        }
        for key, fallback in fallbacks.items():
            replace(payload["messages"], key, fallback)

    filtered_lists = {
        "observations": ("text",),
        "positive_signals": ("label",),
        "missing_information": ("label", "question"),
    }
    for key, fields in filtered_lists.items():
        retained = []
        for item in payload.get(key) or []:
            if isinstance(item, dict) and _contains_sensitive_text(
                *(str(item.get(field) or "") for field in fields)
            ):
                dropped += 1
            else:
                retained.append(item)
        payload[key] = retained

    retained_risks = []
    for item in payload.get("risks") or []:
        content = item.get("generated_content") if isinstance(item, dict) else None
        if isinstance(content, dict) and _contains_sensitive_text(
            str(content.get("display_title") or ""),
            str(content.get("commentary") or ""),
            str(content.get("recommended_check") or ""),
        ):
            dropped += 1
        else:
            retained_risks.append(item)
    payload["risks"] = retained_risks
    retained_changes = []
    for item in payload.get("change_summary") or []:
        if isinstance(item, str) and _contains_sensitive_text(item):
            dropped += 1
        else:
            retained_changes.append(item)
    payload["change_summary"] = retained_changes
    return GeminiCandidateV2.model_validate(payload), dropped


def _contains_sensitive_text(*values: str | None) -> bool:
    text = " ".join(value or "" for value in values).lower()
    return any(term in text for term in SENSITIVE_TERMS)


def _risk_catalog(
    contracts: AnalysisContracts, category: str
) -> dict[str, dict[str, Any]]:
    common, specific = contracts.taxonomy(category)
    return {
        str(item["code"]): item
        for taxonomy in (common, specific)
        for item in taxonomy.get("risks", [])
        if isinstance(item, dict) and item.get("code")
    }


def _allowed_codes(contracts: AnalysisContracts, category: str, key: str) -> set[str]:
    common, specific = contracts.taxonomy(category)
    return {
        str(code)
        for taxonomy in (common, specific)
        for code in taxonomy.get(key, [])
        if isinstance(code, str)
    }


def _score(candidate: GeminiCandidateV2, contracts: AnalysisContracts) -> int:
    dimensions = candidate.score_breakdown.model_dump()
    weights = contracts.scoring["weights"]
    return round(
        sum(float(weights[key]) * int(dimensions[key]["score"]) for key in weights)
    )


def _pricing(
    candidate: GeminiCandidateV2, normalized: dict[str, Any]
) -> tuple[dict[str, Any], bool]:
    value = candidate.pricing
    asking = normalized.get("asking_price_cents")
    asking = int(asking) if isinstance(asking, int) else value.asking_price_cents
    valid = (
        value.market_low_cents <= value.market_median_cents <= value.market_high_cents
        and value.market_low_cents <= value.fair_price_cents <= value.market_high_cents
        and value.opening_offer_cents
        <= value.agreement_zone_low_cents
        <= value.agreement_zone_high_cents
        <= value.max_recommended_cents
    )
    if not valid:
        return (
            {
                "status": "UNAVAILABLE",
                "currency": value.currency,
                "asking_price_cents": asking,
                "market_low_cents": None,
                "market_median_cents": None,
                "market_high_cents": None,
                "fair_price_cents": None,
                "opening_offer_cents": None,
                "agreement_zone_low_cents": None,
                "agreement_zone_high_cents": None,
                "max_recommended_cents": None,
                "potential_savings_cents": None,
                "confidence": "LOW",
                "commentary": "L’estimation disponible n’est pas assez cohérente pour conseiller un montant fiable.",
            },
            False,
        )
    agreement_midpoint = round(
        (value.agreement_zone_low_cents + value.agreement_zone_high_cents) / 2
    )
    return (
        {
            "status": "AVAILABLE",
            "currency": value.currency,
            "asking_price_cents": asking,
            "market_low_cents": value.market_low_cents,
            "market_median_cents": value.market_median_cents,
            "market_high_cents": value.market_high_cents,
            "fair_price_cents": value.fair_price_cents,
            "opening_offer_cents": value.opening_offer_cents,
            "agreement_zone_low_cents": value.agreement_zone_low_cents,
            "agreement_zone_high_cents": value.agreement_zone_high_cents,
            "max_recommended_cents": value.max_recommended_cents,
            "potential_savings_cents": max(asking - agreement_midpoint, 0),
            "confidence": value.confidence.value,
            "commentary": value.commentary,
        },
        True,
    )


def _listing(normalized: dict[str, Any]) -> dict[str, Any]:
    photos = (
        normalized.get("photos") if isinstance(normalized.get("photos"), list) else []
    )
    first_photo = photos[0] if photos and isinstance(photos[0], dict) else {}
    location = (
        normalized.get("location")
        if isinstance(normalized.get("location"), dict)
        else {}
    )
    location_label = ", ".join(
        str(value)
        for value in (location.get("city"), location.get("postal_code"))
        if value
    )
    return {
        "title": str(normalized.get("title") or "Annonce Leboncoin"),
        "asking_price_cents": normalized.get("asking_price_cents"),
        "currency": str(normalized.get("currency") or "EUR"),
        "thumbnail_url": None,
        "thumbnail_media_id": first_photo.get("media_id"),
        "location": location_label or None,
        "photo_count": len(photos),
    }


def _checklist(
    candidate: GeminiCandidateV2,
    contracts: AnalysisContracts,
    category: str,
) -> dict[str, list[dict[str, Any]]]:
    by_code = {
        str(item["code"]): item
        for item in contracts.checklists.get("items", [])
        if isinstance(item, dict)
        and category in item.get("categories", [])
        and item.get("code")
    }
    mandatory = {
        "BEFORE_MEETING": ["CONFIRM_SAFE_TRANSACTION", "NO_ADVANCE_PAYMENT"],
        "DURING_MEETING": [
            "IPHONE_CHECK_ACTIVATION_LOCK"
            if category == "IPHONE"
            else "MACBOOK_CHECK_ACTIVATION_LOCK"
        ],
        "BEFORE_PAYMENT": [
            "WITNESS_SIGN_OUT_AND_ERASE",
            "ACTIVATE_AS_BUYER",
            "KEEP_SALE_PROOF",
        ],
    }
    selected = {
        "BEFORE_MEETING": candidate.checklist_selection.before_meeting,
        "DURING_MEETING": candidate.checklist_selection.during_meeting,
        "BEFORE_PAYMENT": candidate.checklist_selection.before_payment,
    }
    result: dict[str, list[dict[str, Any]]] = {
        "before_meeting": [],
        "during_meeting": [],
        "before_payment": [],
    }
    key_map = {
        "BEFORE_MEETING": "before_meeting",
        "DURING_MEETING": "during_meeting",
        "BEFORE_PAYMENT": "before_payment",
    }
    for phase, codes in selected.items():
        ordered = list(dict.fromkeys([*mandatory[phase], *codes]))
        for code in ordered:
            item = by_code.get(code)
            if item and item.get("phase") == phase:
                result[key_map[phase]].append(
                    {
                        "code": code,
                        "label": str(item["label"]),
                        "critical": bool(item.get("critical")),
                    }
                )
    return result


def build_report(
    candidate: GeminiCandidateV2,
    *,
    normalized_listing: dict[str, Any],
    device_profile: dict[str, Any],
    purchase_mode: str,
    contracts: AnalysisContracts | None = None,
) -> ProcessedReport:
    contracts = contracts or get_contracts()
    category = str(device_profile["category"])
    risk_catalog = _risk_catalog(contracts, category)
    positive_codes = _allowed_codes(contracts, category, "positive_signals")
    missing_codes = _allowed_codes(contracts, category, "missing_information")

    risks: list[dict[str, Any]] = []
    unknown_codes = 0
    sensitive_dropped = 0
    other_count = 0
    for item in candidate.risks:
        content = item.generated_content
        if _contains_sensitive_text(
            content.display_title, content.commentary, content.recommended_check
        ):
            sensitive_dropped += 1
            continue
        code = item.code if item.code in risk_catalog else "OTHER"
        if code == "OTHER":
            unknown_codes += int(item.code != "OTHER")
            other_count += 1
        severity = item.severity
        if (
            code == "OTHER"
            and SEVERITY_ORDER[severity] > SEVERITY_ORDER[Severity.MEDIUM]
        ):
            severity = Severity.MEDIUM
        canonical = risk_catalog[code]
        risks.append(
            {
                "code": code,
                "canonical_title": canonical["canonical_title"],
                "status": item.status.value,
                "severity": severity.value,
                "display_title": content.display_title,
                "commentary": content.commentary,
                "recommended_check": content.recommended_check,
                "blocking": bool(canonical.get("blocking")),
            }
        )

    score = _score(candidate, contracts)
    caps = contracts.scoring["caps"]
    confirmed_critical = any(
        item["status"] == FindingStatus.CONFIRMED.value
        and item["severity"] == Severity.CRITICAL.value
        for item in risks
    )
    blocking_unresolved = any(
        item["blocking"] and item["status"] != FindingStatus.RESOLVED.value
        for item in risks
    )
    high_unresolved = sum(
        item["severity"] in {Severity.HIGH.value, Severity.CRITICAL.value}
        and item["status"] != FindingStatus.RESOLVED.value
        for item in risks
    )
    if confirmed_critical:
        score = min(score, int(caps["CONFIRMED_CRITICAL"]))
    elif blocking_unresolved:
        score = min(score, int(caps["BLOCKING_UNRESOLVED"]))
    elif high_unresolved >= 2:
        score = min(score, int(caps["TWO_HIGH_UNRESOLVED"]))

    pricing, pricing_valid = _pricing(candidate, normalized_listing)
    if confirmed_critical or score < 40:
        verdict = VerdictType.PASS
    elif blocking_unresolved or not pricing_valid or score <= 64:
        verdict = VerdictType.VERIFY_FIRST
    elif score <= 79 or (
        pricing["status"] == "AVAILABLE"
        and pricing["asking_price_cents"] > pricing["fair_price_cents"]
    ):
        verdict = VerdictType.NEGOTIATE
    else:
        verdict = VerdictType.BUY

    if verdict == VerdictType.PASS:
        action_type = ActionType.AVOID_LISTING
    elif verdict == VerdictType.VERIFY_FIRST:
        action_type = ActionType.REQUEST_PROOFS
    elif verdict == VerdictType.NEGOTIATE:
        action_type = ActionType.MAKE_OFFER
    else:
        action_type = (
            ActionType.START_CHECKLIST
            if purchase_mode == "face_to_face"
            else candidate.primary_action_candidate.type
        )
    if (
        action_type not in {ActionType.START_CHECKLIST, ActionType.MAKE_OFFER}
        and verdict == VerdictType.BUY
    ):
        action_type = ActionType.START_CHECKLIST

    public_risks = [
        {key: value for key, value in item.items() if key != "blocking"}
        for item in risks
    ]
    active_severities = [
        Severity(item["severity"])
        for item in risks
        if item["status"] != FindingStatus.RESOLVED.value
    ]
    risk_level = max(
        active_severities, key=lambda value: SEVERITY_ORDER[value], default=Severity.LOW
    )
    positives = [
        {"code": item.code, "label": item.label}
        for item in candidate.positive_signals
        if item.code in positive_codes and not _contains_sensitive_text(item.label)
    ]
    missing = [
        item.model_dump(mode="json")
        for item in candidate.missing_information
        if item.code in missing_codes
        and not _contains_sensitive_text(item.label, item.question)
    ]
    breakdown = {
        key: {"score": value["score"], "rationale": value["rationale"]}
        for key, value in candidate.score_breakdown.model_dump(mode="json").items()
    }
    result = AnalysisResult.model_validate(
        {
            "schema_version": contracts.manifest["schema_version"],
            "template_id": verdict.value,
            "listing": _listing(normalized_listing),
            "device": device_profile,
            "verdict": {
                "type": verdict.value,
                "deal_score": score,
                "confidence": candidate.confidence.value,
                "headline": candidate.headline,
                "explanation": candidate.summary,
            },
            "score_breakdown": breakdown,
            "primary_action": {
                "type": action_type.value,
                "label": ACTION_LABELS[action_type],
                "reason": candidate.primary_action_candidate.reason,
            },
            "pricing": pricing,
            "risks": {"level": risk_level.value, "items": public_risks},
            "positive_signals": positives,
            "missing_information": missing,
            "messages": candidate.messages.model_dump(mode="json"),
            "checklist": _checklist(candidate, contracts, category),
            "available_actions": list(
                dict.fromkeys([action_type, *candidate.available_actions])
            )[:5],
            "expert_note": candidate.expert_note,
            "change_summary": candidate.change_summary,
        }
    )
    return ProcessedReport(
        result=result,
        metadata={
            "unknown_taxonomy_code_count": unknown_codes,
            "other_risk_count": other_count,
            "sensitive_finding_dropped_count": sensitive_dropped,
            "pricing_available": pricing_valid,
            "final_score": score,
            "final_verdict": verdict.value,
        },
    )
