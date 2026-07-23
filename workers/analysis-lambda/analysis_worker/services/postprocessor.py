from copy import deepcopy
from dataclasses import dataclass
import re
from typing import Any
import unicodedata

from analysis_worker.rules import (
    CHECKLISTS,
    REPORT_SCHEMA_VERSION,
    SCORE_CAPS,
    SCORE_WEIGHTS,
    missing_codes,
    positive_codes,
    risk_catalog,
)
from analysis_worker.schemas.result import (
    ActionType,
    AnalysisResult,
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
INTERNAL_CODE_RE = re.compile(
    r"\b(?!(?:PHOTO|SELLER_MEDIA)_\d+\b)[A-Z][A-Z0-9]{2,}(?:_[A-Z0-9]+)+\b"
)
PARENTHESIZED_INTERNAL_CODE_RE = re.compile(
    r"\s*\((?!(?:PHOTO|SELLER_MEDIA)_\d+\b)[A-Z][A-Z0-9]{2,}(?:_[A-Z0-9]+)+\)"
)

CONFIDENCES = {"LOW", "MEDIUM", "HIGH"}
STATUSES = {"CONFIRMED", "LIKELY", "UNVERIFIED", "RESOLVED"}
SEVERITIES = {"LOW", "MEDIUM", "HIGH", "CRITICAL"}
PRIORITIES = {"BLOCKING", "USEFUL"}
SCORE_KEYS = ("price", "condition", "proofs", "consistency", "transaction")
PUBLIC_SCORE_KEYS = {
    "price": "PRICE_VALUE",
    "condition": "CONDITION",
    "proofs": "PROOFS_OWNERSHIP",
    "consistency": "LISTING_CONSISTENCY",
    "transaction": "TRANSACTION_SAFETY",
}
SEVERITY_ORDER = {"LOW": 1, "MEDIUM": 2, "HIGH": 3, "CRITICAL": 4}
ACTION_LABELS = {
    ActionType.REQUEST_PROOFS: "Demander les preuves manquantes",
    ActionType.MAKE_OFFER: "Préparer une offre",
    ActionType.START_CHECKLIST: "Démarrer la checklist",
    ActionType.COMPARE_ANOTHER: "Analyser une autre annonce",
    ActionType.AVOID_LISTING: "Éviter cette annonce",
}

COLOR_TERMS = {
    "color",
    "couleur",
    "teinte",
    "bleu",
    "blue",
    "gris",
    "gray",
    "grey",
    "noir",
    "black",
    "blanc",
    "white",
    "argent",
    "silver",
    "dore",
    "gold",
    "titane",
    "titanium",
}
NEGATIVE_VISUAL_TERMS = (
    "absence",
    "absent",
    "non visible",
    "pas visible",
    "n est pas visible",
    "ne montre pas",
    "semble manquer",
    "parait manquer",
    "pas de bouton",
    "sans le bouton",
)
IDENTITY_CONTRADICTION_CODES = {
    "LISTING_INCONSISTENCY",
    "PHOTO_INCONSISTENCY",
    "PRODUCT_IDENTITY_UNCLEAR",
    "STORAGE_MISMATCH",
    "MODEL_REGION_MISMATCH",
    "SYSTEM_SPECS_MISMATCH",
    "SERIAL_MODEL_MISMATCH",
}


@dataclass(frozen=True)
class ProcessedReport:
    result: AnalysisResult
    metadata: dict[str, Any]


def _contains_sensitive_text(*values: Any) -> bool:
    text = " ".join(str(value or "") for value in values).lower()
    return any(term in text for term in SENSITIVE_TERMS)


def _text(value: Any, fallback: str, limit: int) -> str:
    result = value.strip() if isinstance(value, str) else ""
    return (result or fallback)[:limit]


def _public_text(value: Any, fallback: str, limit: int) -> str:
    """Return UI copy without leaking internal enum/taxonomy codes.

    This does not invent replacement copy. It only removes parenthesized codes
    and falls back when a standalone code remains.
    """
    result = _text(value, fallback, limit)
    result = PARENTHESIZED_INTERNAL_CODE_RE.sub("", result)
    result = re.sub(r"\s{2,}", " ", result).strip()
    if INTERNAL_CODE_RE.search(result):
        return fallback[:limit]
    return (result or fallback)[:limit]


def _change_text(value: Any, limit: int = 300) -> str | None:
    if not isinstance(value, str) or not value.strip():
        return None
    if _contains_sensitive_text(value):
        return None
    result = PARENTHESIZED_INTERNAL_CODE_RE.sub("", value.strip())
    result = re.sub(r"\s{2,}", " ", result).strip()
    if not result or INTERNAL_CODE_RE.search(result):
        return None
    return result[:limit]


def _integer(value: Any, default: int = 0) -> int:
    try:
        return int(round(float(value)))
    except (TypeError, ValueError):
        return default


def _score_value(value: Any) -> int:
    return max(0, min(_integer(value, 50), 100))


def _enum(value: Any, allowed: set[str], default: str) -> str:
    candidate = str(value or "").upper()
    return candidate if candidate in allowed else default


def _normalized_words(value: Any) -> str:
    text = unicodedata.normalize("NFKD", str(value or ""))
    text = "".join(
        character for character in text if not unicodedata.combining(character)
    )
    return " ".join(re.findall(r"[a-z0-9]+", text.lower()))


def _declared_identity_agrees(
    normalized_listing: dict[str, Any], device_profile: dict[str, Any]
) -> bool:
    identity = _normalized_words(device_profile.get("display_name"))
    if not identity:
        return False

    sources = [
        normalized_listing.get("title"),
        normalized_listing.get("description"),
    ]
    attributes = normalized_listing.get("attributes")
    if isinstance(attributes, list):
        model_attributes = [
            item.get("value")
            for item in attributes
            if isinstance(item, dict)
            and any(
                marker in _normalized_words(item.get("key"))
                for marker in ("model", "modele", "product")
            )
        ]
        sources.append(" ".join(str(value or "") for value in model_attributes))

    return sum(identity in _normalized_words(source) for source in sources) >= 2


def _declared_color(
    normalized_listing: dict[str, Any], device_profile: dict[str, Any]
) -> str | None:
    specs = device_profile.get("specs")
    if isinstance(specs, dict) and specs.get("color"):
        return str(specs["color"])
    for item in normalized_listing.get("attributes") or []:
        if not isinstance(item, dict):
            continue
        if "color" in _normalized_words(
            item.get("key")
        ) or "couleur" in _normalized_words(item.get("key")):
            value = str(item.get("value") or "").strip()
            if value:
                return value
    return None


def _photo_only(item: dict[str, Any]) -> bool:
    evidence = item.get("evidence")
    return bool(evidence) and all(
        isinstance(reference, str) and reference.startswith("PHOTO_")
        for reference in evidence
    )


def _mentions_color(*values: Any) -> bool:
    words = set(
        _normalized_words(" ".join(str(value or "") for value in values)).split()
    )
    return bool(words & COLOR_TERMS)


def _uses_negative_visual_evidence(*values: Any) -> bool:
    text = _normalized_words(" ".join(str(value or "") for value in values))
    return any(term in text for term in NEGATIVE_VISUAL_TERMS)


def _apply_visual_evidence_guardrails(
    candidate: dict[str, Any],
    *,
    normalized_listing: dict[str, Any],
    device_profile: dict[str, Any],
    catalog: dict[str, dict[str, Any]],
) -> int:
    """Neutralize photo-only claims that are not positive identification evidence."""
    declared_identity_agrees = _declared_identity_agrees(
        normalized_listing, device_profile
    )
    declared_color = _declared_color(normalized_listing, device_profile)
    changed = 0

    for item in candidate.get("risks") or []:
        if not isinstance(item, dict) or not _photo_only(item):
            continue

        if item.get("code") in {
            "PHOTO_INCONSISTENCY",
            "COLOR_MISMATCH",
        } and _mentions_color(
            item.get("title"), item.get("comment"), item.get("check")
        ):
            if "COLOR_MISMATCH" in catalog:
                item["code"] = "COLOR_MISMATCH"
            item["status"] = "UNVERIFIED"
            item["severity"] = "LOW"
            item["title"] = "Variation de couleur entre les photos"
            color_context = (
                f" Les données de l’annonce indiquent {declared_color}."
                if declared_color
                else ""
            )
            item["comment"] = (
                "L’éclairage, les reflets et la balance des blancs peuvent modifier "
                f"la teinte apparente.{color_context} La couleur reste à confirmer."
            )
            item["check"] = (
                "Demander une photo de l’arrière en lumière neutre, sans filtre."
            )
            item["visual_guardrail"] = True
            changed += 1
            continue

        if (
            item.get("code") == "PRODUCT_IDENTITY_UNCLEAR"
            and declared_identity_agrees
            and _uses_negative_visual_evidence(
                item.get("title"), item.get("comment"), item.get("check")
            )
        ):
            display_name = _text(
                device_profile.get("display_name"), "le modèle déclaré", 100
            )
            item["status"] = "UNVERIFIED"
            item["severity"] = "MEDIUM"
            item["title"] = "Modèle à confirmer"
            item["comment"] = (
                "Le titre, la description et les caractéristiques concordent sur "
                f"{display_name}. L’absence apparente d’un détail sur une photo ne "
                "permet pas d’identifier un autre modèle."
            )
            item["check"] = (
                "Demander une capture de Réglages > Général > Informations affichant "
                "le nom et le numéro de modèle."
            )
            item["visual_guardrail"] = True
            changed += 1

    if not changed:
        return 0

    unresolved_identity_contradiction = any(
        item.get("code") in IDENTITY_CONTRADICTION_CODES
        and item.get("status") != "RESOLVED"
        and not item.get("visual_guardrail")
        for item in candidate.get("risks") or []
        if isinstance(item, dict)
    )
    if declared_identity_agrees and not unresolved_identity_contradiction:
        consistency = candidate["scores"]["consistency"]
        consistency["value"] = max(int(consistency["value"]), 60)
        consistency["reason"] = (
            "Le titre, la description et les caractéristiques structurées concordent "
            "sur le modèle déclaré ; les variations visuelles restent à confirmer."
        )

    candidate["headline"] = "Offre intéressante, mais des preuves restent à demander"
    candidate["summary"] = (
        "Les informations de l’annonce concordent sur le modèle déclaré. Les variations "
        "visibles peuvent venir de l’éclairage ou de l’angle ; confirme le modèle et "
        "les preuves manquantes avant de payer."
    )
    candidate["action_reason"] = (
        "Confirmer le modèle déclaré et demander les preuves manquantes avant de poursuivre."
    )
    return changed


def sanitize_candidate(candidate: dict[str, Any]) -> tuple[dict[str, Any], int]:
    """Make Gemini output safe and tolerant before internal persistence."""
    raw = deepcopy(candidate)
    dropped = 0
    headline = _public_text(
        raw.get("headline"), "Analyse de l’annonce à vérifier", 90
    )
    summary = _public_text(
        raw.get("summary"),
        "Les éléments disponibles nécessitent encore quelques vérifications.",
        450,
    )
    if _contains_sensitive_text(headline):
        headline = "Analyse de l’annonce à vérifier"
        dropped += 1
    if _contains_sensitive_text(summary):
        summary = "DealUp conserve uniquement les éléments vérifiables de l’annonce."
        dropped += 1

    raw_scores = raw.get("scores") if isinstance(raw.get("scores"), dict) else {}
    scores: dict[str, dict[str, Any]] = {}
    for key in SCORE_KEYS:
        item = raw_scores.get(key)
        item = item if isinstance(item, dict) else {"value": item}
        reason = _public_text(
            item.get("reason"),
            "Sous-score fondé sur les éléments disponibles.",
            320,
        )
        if _contains_sensitive_text(reason):
            reason = "Sous-score fondé uniquement sur les éléments vérifiables."
            dropped += 1
        scores[key] = {"value": _score_value(item.get("value")), "reason": reason}

    risks: list[dict[str, Any]] = []
    for item in raw.get("risks") or []:
        if not isinstance(item, dict) or len(risks) >= 5:
            continue
        title = _public_text(item.get("title"), "Point à vérifier", 80)
        comment = _public_text(
            item.get("comment"),
            "Les éléments disponibles ne permettent pas encore de confirmer ce point.",
            320,
        )
        check = _public_text(
            item.get("check"), "Demander une preuve claire avant le paiement.", 220
        )
        if _contains_sensitive_text(title, comment, check):
            dropped += 1
            continue
        evidence = [
            value
            for value in item.get("evidence") or []
            if isinstance(value, str)
            and (
                value in {"DESCRIPTION", "ATTRIBUTE", "SELLER_MESSAGE", "WEB"}
                or value.startswith("PHOTO_")
                or value.startswith("SELLER_MEDIA_")
            )
        ][:10]
        risks.append(
            {
                "code": _text(item.get("code"), "OTHER", 80).upper(),
                "status": _enum(item.get("status"), STATUSES, "UNVERIFIED"),
                "severity": _enum(item.get("severity"), SEVERITIES, "MEDIUM"),
                "title": title,
                "comment": comment,
                "check": check,
                "evidence": evidence,
            }
        )

    positives: list[dict[str, str]] = []
    for item in raw.get("positive_signals") or []:
        if not isinstance(item, dict) or len(positives) >= 4:
            continue
        label = _public_text(item.get("label"), "Signal positif observé", 300)
        if _contains_sensitive_text(label):
            dropped += 1
            continue
        positives.append(
            {"code": _text(item.get("code"), "", 80).upper(), "label": label}
        )

    missing: list[dict[str, str]] = []
    for item in raw.get("missing_information") or []:
        if not isinstance(item, dict) or len(missing) >= 4:
            continue
        label = _public_text(item.get("label"), "Information manquante", 300)
        reason = _public_text(
            item.get("reason"),
            "Les éléments fournis ne permettent pas encore de confirmer ce point.",
            320,
        )
        question = _public_text(
            item.get("question"), "Pouvez-vous préciser ce point ?", 500
        )
        if _contains_sensitive_text(label, reason, question):
            dropped += 1
            continue
        evidence = [
            value
            for value in item.get("evidence") or []
            if isinstance(value, str)
            and (
                value in {"DESCRIPTION", "ATTRIBUTE", "SELLER_MESSAGE", "WEB"}
                or value.startswith("PHOTO_")
                or value.startswith("SELLER_MEDIA_")
            )
        ][:10]
        missing.append(
            {
                "code": _text(item.get("code"), "", 80).upper(),
                "priority": _enum(item.get("priority"), PRIORITIES, "USEFUL"),
                "label": label,
                "reason": reason,
                "question": question,
                "evidence": evidence,
            }
        )

    raw_pricing = raw.get("pricing") if isinstance(raw.get("pricing"), dict) else {}
    pricing_comment = _public_text(
        raw_pricing.get("comment"),
        "Estimation fondée sur la configuration et le marché observé.",
        300,
    )
    if _contains_sensitive_text(pricing_comment):
        pricing_comment = "Estimation fondée sur la configuration et le marché observé."
        dropped += 1
    pricing = {**raw_pricing, "comment": pricing_comment}

    raw_messages = raw.get("messages") if isinstance(raw.get("messages"), dict) else {}
    request_proofs = _public_text(
        raw_messages.get("request_proofs"),
        "Bonjour, pouvez-vous transmettre les preuves manquantes en masquant vos données privées ?",
        700,
    )
    make_offer = _public_text(
        raw_messages.get("make_offer"),
        "Bonjour, sous réserve des vérifications, je souhaite vous faire une offre.",
        700,
    )
    if _contains_sensitive_text(request_proofs):
        request_proofs = "Bonjour, pouvez-vous transmettre les preuves manquantes ?"
        dropped += 1
    if _contains_sensitive_text(make_offer):
        make_offer = (
            "Bonjour, je souhaite vous faire une offre sous réserve des vérifications."
        )
        dropped += 1

    changes = [
        item
        for item in (_change_text(item) for item in raw.get("changes") or [])
        if item
    ][:4]
    action_reason = _public_text(
        raw.get("action_reason"),
        "Cette action est la plus utile avant de poursuivre.",
        300,
    )
    if _contains_sensitive_text(action_reason):
        action_reason = "Cette action dépend uniquement des preuves vérifiables."
        dropped += 1
    return (
        {
            "confidence": _enum(raw.get("confidence"), CONFIDENCES, "MEDIUM"),
            "headline": headline,
            "summary": summary,
            "scores": scores,
            "pricing": pricing,
            "risks": risks,
            "positive_signals": positives,
            "missing_information": missing,
            "action_reason": action_reason,
            "messages": {
                "request_proofs": request_proofs,
                "make_offer": make_offer,
            },
            "changes": changes,
        },
        dropped,
    )


def _score(candidate: dict[str, Any]) -> int:
    scores = candidate["scores"]
    return round(
        sum(SCORE_WEIGHTS[key] * int(scores[key]["value"]) for key in SCORE_KEYS)
    )


def _candidate_price_cents(value: Any) -> int | None:
    integer = _integer(value, -1)
    if integer < 0:
        return None
    # The prompt asks for euros. This also tolerates a model accidentally returning cents.
    return integer if integer > 20_000 else integer * 100


def _pricing(
    candidate: dict[str, Any], normalized: dict[str, Any]
) -> tuple[dict[str, Any], bool]:
    value = (
        candidate.get("pricing") if isinstance(candidate.get("pricing"), dict) else {}
    )
    prices = {
        key: _candidate_price_cents(value.get(source))
        for key, source in {
            "market_low_cents": "market_low",
            "market_median_cents": "market_mid",
            "market_high_cents": "market_high",
            "fair_price_cents": "fair_price",
            "opening_offer_cents": "first_offer",
            "agreement_zone_low_cents": "agreement_low",
            "agreement_zone_high_cents": "agreement_high",
            "max_recommended_cents": "maximum",
        }.items()
    }
    asking = normalized.get("asking_price_cents")
    valid = all(item is not None for item in prices.values())
    if valid:
        valid = bool(
            prices["market_low_cents"]
            <= prices["market_median_cents"]
            <= prices["market_high_cents"]
            and prices["market_low_cents"]
            <= prices["fair_price_cents"]
            <= prices["market_high_cents"]
            and prices["opening_offer_cents"]
            <= prices["agreement_zone_low_cents"]
            <= prices["agreement_zone_high_cents"]
            <= prices["max_recommended_cents"]
        )
    if not valid:
        return (
            {
                "status": "UNAVAILABLE",
                "currency": "EUR",
                "asking_price_cents": asking,
                **{key: None for key in prices},
                "potential_savings_cents": None,
                "confidence": "LOW",
                "commentary": "L’estimation disponible n’est pas assez cohérente pour conseiller un montant fiable.",
            },
            False,
        )
    agreement_midpoint = round(
        (prices["agreement_zone_low_cents"] + prices["agreement_zone_high_cents"]) / 2
    )
    return (
        {
            "status": "AVAILABLE",
            "currency": "EUR",
            "asking_price_cents": asking,
            **prices,
            "potential_savings_cents": max(int(asking or 0) - agreement_midpoint, 0),
            "confidence": _enum(value.get("confidence"), CONFIDENCES, "MEDIUM"),
            "commentary": _public_text(
                value.get("comment"),
                "Estimation fondée sur la configuration et le marché observé.",
                300,
            ),
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
        "title": _text(normalized.get("title"), "Annonce Leboncoin", 300),
        "asking_price_cents": normalized.get("asking_price_cents"),
        "currency": "EUR",
        "thumbnail_url": None,
        "thumbnail_media_id": first_photo.get("media_id"),
        "location": location_label or None,
        "photo_count": len(photos),
    }


def build_report(
    candidate: dict[str, Any],
    *,
    normalized_listing: dict[str, Any],
    device_profile: dict[str, Any],
    purchase_mode: str,
    schema_version: str | None = None,
) -> ProcessedReport:
    del purchase_mode
    report_candidate = deepcopy(candidate)
    category = str(device_profile.get("category") or "IPHONE")
    catalog = risk_catalog(category)
    allowed_positive = positive_codes(category)
    allowed_missing = missing_codes(category)
    guarded_visual_risk_count = _apply_visual_evidence_guardrails(
        report_candidate,
        normalized_listing=normalized_listing,
        device_profile=device_profile,
        catalog=catalog,
    )

    risks: list[dict[str, Any]] = []
    unknown_codes = 0
    other_count = 0
    for item in report_candidate.get("risks") or []:
        code = item["code"] if item["code"] in catalog else "OTHER"
        if code == "OTHER" and not item.get("evidence"):
            continue
        if code == "OTHER":
            unknown_codes += int(item["code"] != "OTHER")
            other_count += 1
        severity = item["severity"]
        if code == "OTHER" and SEVERITY_ORDER[severity] > SEVERITY_ORDER["MEDIUM"]:
            severity = "MEDIUM"
        canonical = catalog[code]
        risks.append(
            {
                "code": code,
                "canonical_title": canonical["title"],
                "status": item["status"],
                "severity": severity,
                "display_title": item["title"],
                "commentary": item["comment"],
                "recommended_check": item["check"],
                "blocking": bool(canonical.get("blocking"))
                and not item.get("visual_guardrail"),
            }
        )

    missing = [
        item
        for item in report_candidate.get("missing_information") or []
        if item.get("code") in allowed_missing
    ]
    score = _score(report_candidate)
    confirmed_critical = any(
        item["status"] == "CONFIRMED" and item["severity"] == "CRITICAL"
        for item in risks
    )
    blocking_unresolved = any(
        item["blocking"] and item["status"] != "RESOLVED" for item in risks
    ) or any(item["priority"] == "BLOCKING" for item in missing)
    high_unresolved = sum(
        item["severity"] in {"HIGH", "CRITICAL"} and item["status"] != "RESOLVED"
        for item in risks
    )
    if confirmed_critical:
        score = min(score, SCORE_CAPS["confirmed_critical"])
    elif blocking_unresolved:
        score = min(score, SCORE_CAPS["blocking_unresolved"])
    elif high_unresolved >= 2:
        score = min(score, SCORE_CAPS["two_high_unresolved"])

    pricing, pricing_valid = _pricing(report_candidate, normalized_listing)
    if confirmed_critical or score < 40:
        verdict = VerdictType.PASS
    elif blocking_unresolved or not pricing_valid or score <= 64:
        verdict = VerdictType.VERIFY_FIRST
    elif score <= 79 or pricing["asking_price_cents"] > pricing["fair_price_cents"]:
        verdict = VerdictType.NEGOTIATE
    else:
        verdict = VerdictType.BUY

    action_type = {
        VerdictType.PASS: ActionType.AVOID_LISTING,
        VerdictType.VERIFY_FIRST: ActionType.REQUEST_PROOFS,
        VerdictType.NEGOTIATE: ActionType.MAKE_OFFER,
        VerdictType.BUY: ActionType.START_CHECKLIST,
    }[verdict]
    available_actions = {
        VerdictType.PASS: [ActionType.AVOID_LISTING, ActionType.COMPARE_ANOTHER],
        VerdictType.VERIFY_FIRST: [
            ActionType.REQUEST_PROOFS,
            ActionType.START_CHECKLIST,
            ActionType.COMPARE_ANOTHER,
        ],
        VerdictType.NEGOTIATE: [
            ActionType.MAKE_OFFER,
            ActionType.REQUEST_PROOFS,
            ActionType.START_CHECKLIST,
            ActionType.COMPARE_ANOTHER,
        ],
        VerdictType.BUY: [
            ActionType.START_CHECKLIST,
            ActionType.MAKE_OFFER,
            ActionType.COMPARE_ANOTHER,
        ],
    }[verdict]
    active_severities = [
        item["severity"] for item in risks if item["status"] != "RESOLVED"
    ]
    risk_level = max(active_severities, key=SEVERITY_ORDER.get, default="LOW")
    public_risks = [
        {key: value for key, value in item.items() if key != "blocking"}
        for item in risks
    ]
    breakdown = {
        PUBLIC_SCORE_KEYS[key]: {
            "score": report_candidate["scores"][key]["value"],
            "rationale": report_candidate["scores"][key]["reason"],
        }
        for key in SCORE_KEYS
    }
    positives = [
        item
        for item in report_candidate.get("positive_signals") or []
        if item.get("code") in allowed_positive
    ]
    messages = report_candidate["messages"]
    result = AnalysisResult.model_validate(
        {
            "schema_version": schema_version or REPORT_SCHEMA_VERSION,
            "template_id": verdict.value,
            "listing": _listing(normalized_listing),
            "device": device_profile,
            "verdict": {
                "type": verdict.value,
                "deal_score": score,
                "confidence": report_candidate["confidence"],
                "headline": report_candidate["headline"],
                "explanation": report_candidate["summary"],
            },
            "score_breakdown": breakdown,
            "primary_action": {
                "type": action_type.value,
                "label": ACTION_LABELS[action_type],
                "reason": report_candidate["action_reason"],
            },
            "pricing": pricing,
            "risks": {"level": risk_level, "items": public_risks},
            "positive_signals": positives,
            "missing_information": missing,
            "messages": {
                **messages,
                "decline": "Merci pour votre réponse. Je préfère ne pas donner suite.",
            },
            "checklist": CHECKLISTS[category],
            "available_actions": available_actions,
            "expert_note": None,
            "change_summary": report_candidate.get("changes") or [],
        }
    )
    return ProcessedReport(
        result=result,
        metadata={
            "unknown_taxonomy_code_count": unknown_codes,
            "other_risk_count": other_count,
            "guarded_visual_risk_count": guarded_visual_risk_count,
            "pricing_available": pricing_valid,
            "final_score": score,
            "final_verdict": verdict.value,
        },
    )
