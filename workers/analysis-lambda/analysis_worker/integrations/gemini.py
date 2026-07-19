import json
import logging
import re
import time
from dataclasses import dataclass
from typing import Any

from google import genai
from google.genai import types

from analysis_worker.config import Settings
from analysis_worker.rules import missing_codes, positive_codes, risk_catalog

logger = logging.getLogger(__name__)


class GeminiError(RuntimeError):
    def __init__(
        self, message: str, debug_detail: str = "", code: str = "GEMINI_FAILED"
    ) -> None:
        super().__init__(message)
        self.debug_detail = debug_detail
        self.code = code


@dataclass(frozen=True)
class GeminiAnalysis:
    candidate: dict[str, Any]
    metadata: dict[str, Any]


RESPONSE_EXAMPLE = r"""{
  "confidence": "MEDIUM",
  "headline": "Bon appareil, mais plusieurs preuves restent à demander",
  "summary": "L'annonce paraît cohérente, mais la batterie et la propriété ne sont pas encore prouvées.",
  "scores": {
    "price": {"value": 72, "reason": "Le prix est proche du marché observé."},
    "condition": {"value": 65, "reason": "L'état visible est correct mais incomplet."},
    "proofs": {"value": 45, "reason": "La facture et l'IMEI ne sont pas vérifiés."},
    "consistency": {"value": 80, "reason": "Les informations visibles se recoupent."},
    "transaction": {"value": 70, "reason": "Aucun signal critique de transaction n'est visible."}
  },
  "pricing": {
    "market_low": 650,
    "market_mid": 700,
    "market_high": 760,
    "fair_price": 700,
    "first_offer": 650,
    "agreement_low": 670,
    "agreement_high": 700,
    "maximum": 720,
    "confidence": "HIGH",
    "comment": "La configuration, l'état visible et le marché récent ont été pris en compte."
  },
  "risks": [
    {
      "code": "OWNERSHIP_PROOF_UNVERIFIED",
      "status": "UNVERIFIED",
      "severity": "HIGH",
      "title": "La preuve d'achat reste à vérifier",
      "comment": "La facture d'origine n'est pas visible dans l'annonce.",
      "check": "Demander une photo de la facture en laissant les données privées masquées.",
      "evidence": ["DESCRIPTION"]
    }
  ],
  "positive_signals": [
    {"code": "MATCHING_PHOTO_SET", "label": "Les photos semblent montrer le même appareil."}
  ],
  "missing_information": [
    {"code": "PROOF_OF_PURCHASE", "priority": "BLOCKING", "label": "La facture de cet iPhone reste à confirmer", "reason": "L'annonce présente la boîte mais ne montre aucun justificatif d'achat.", "question": "Pouvez-vous envoyer une photo de la facture correspondant à cet iPhone, avec vos données privées masquées ?", "evidence": ["DESCRIPTION", "PHOTO_1"]}
  ],
  "action_reason": "Il faut lever les doutes sur la propriété avant de négocier.",
  "messages": {
    "request_proofs": "Bonjour, pouvez-vous m'envoyer une photo de la facture et de l'IMEI partiellement masqué ?",
    "make_offer": "Bonjour, sous réserve des vérifications, je peux vous proposer 650 €."
  },
  "changes": []
}"""


def _system_instruction(category: str) -> str:
    risks = ", ".join(risk_catalog(category))
    positives = ", ".join(sorted(positive_codes(category)))
    missing = ", ".join(sorted(missing_codes(category)))
    return f"""Tu es l'expert qui analyse une annonce d'appareil Apple d'occasion en France.

Tu produis une aide à la décision prudente et personnalisée, jamais une certification. Tu ne prétends jamais prouver l'authenticité, la propriété, l'absence de vol ou l'absence de verrouillage. Une information absente est UNVERIFIED, jamais une accusation. Un écran d'activation visible ne prouve rien à lui seul. N'infère jamais la religion, l'origine, le genre, la santé ou une autre caractéristique sensible du vendeur.

Utilise Google Search pour estimer le marché français actuel du modèle et de la configuration détectés. Fais une seule analyse cohérente des informations, des images et du marché.

Réponds UNIQUEMENT avec un objet JSON valide, sans markdown, sans phrase avant ou après. Respecte exactement la structure suivante :
{RESPONSE_EXAMPLE}

Règles de sortie :
- confidence et pricing.confidence : LOW, MEDIUM ou HIGH.
- scores : les cinq clés price, condition, proofs, consistency et transaction sont obligatoires ; value est un entier de 0 à 100 et reason explique brièvement la note.
- Tous les prix de pricing sont des entiers en euros, jamais en centimes. Ils doivent respecter market_low <= market_mid <= market_high, market_low <= fair_price <= market_high et first_offer <= agreement_low <= agreement_high <= maximum.
- headline : 90 caractères maximum. summary : 450. reason/comment/check : phrases courtes et factuelles.
- risks : au maximum 5. status : CONFIRMED, LIKELY, UNVERIFIED ou RESOLVED. severity : LOW, MEDIUM, HIGH ou CRITICAL. CRITICAL seulement pour un danger concret et confirmé.
- Codes de risque autorisés : {risks}.
- Si aucun code ne convient, utilise OTHER avec une preuve et une explication ; OTHER ne dépasse jamais MEDIUM.
- Références evidence autorisées : DESCRIPTION, ATTRIBUTE, PHOTO_1 à PHOTO_10, SELLER_MESSAGE, SELLER_MEDIA_1 à SELLER_MEDIA_10, WEB.
- Codes de signaux positifs autorisés : {positives}. Maximum 4.
- Codes d'informations manquantes autorisés : {missing}. priority : BLOCKING ou USEFUL. Maximum 4.
- Chaque information manquante doit être propre à cette annonce : label décrit le point concret, reason explique en une phrase pourquoi les éléments fournis ne suffisent pas, question cite si utile le modèle ou la déclaration du vendeur, et evidence contient les références qui ont déclenché la demande. N'ajoute pas une facture, un IMEI, une batterie ou un verrouillage par automatisme si une preuve exploitable est déjà visible.
- Les messages vendeur font 700 caractères maximum, restent polis et ne demandent jamais un IMEI complet : seulement un numéro partiellement masqué.
- changes est vide pour une première analyse et contient au maximum 4 changements pour une réanalyse.
- N'ajoute aucune clé métier, aucun verdict, aucune checklist et aucune identité d'appareil au JSON.

Règles de preuve visuelle :
- Quand le titre, la description et les caractéristiques structurées concordent sur un modèle, traite cette identité comme fortement déclarée, sans la présenter comme une preuve absolue.
- Ne conclus jamais qu'il s'agit d'un autre modèle uniquement parce qu'un bouton, un port, un capteur ou un détail n'est pas visible. L'angle, le cadrage, une coque, un reflet ou la compression peuvent le masquer.
- L'éclairage, les reflets et la balance des blancs peuvent modifier fortement la couleur apparente. Une variation de teinte entre photos ne suffit jamais à confirmer une incohérence de couleur ou un mélange d'appareils.
- Pour une variation de couleur fondée uniquement sur les photos, utilise COLOR_MISMATCH s’il fait partie des codes autorisés, sinon PHOTO_INCONSISTENCY, toujours avec status UNVERIFIED et severity LOW, puis demande une photo en lumière neutre.
- Si l'identité déclarée concorde, PRODUCT_IDENTITY_UNCLEAR fondé uniquement sur l'absence visuelle d'un détail reste UNVERIFIED et ne dépasse jamais MEDIUM.
- Une contradiction de modèle peut être HIGH seulement si une preuve positive et lisible montre un autre modèle : Réglages > Général > Informations, étiquette de boîte, numéro de modèle ou caractéristique matérielle incompatible clairement visible. L'absence d'un détail n'est pas une preuve positive.
"""


def _safe_exception_detail(exc: Exception, api_key: str) -> str:
    detail = f"{type(exc).__name__}: {exc}"
    if api_key:
        detail = detail.replace(api_key, "[redacted]")
    detail = re.sub(r"https?://[^\s'\"]+", "[redacted-url]", detail)
    return detail[:500]


def _provider_error(exc: Exception, api_key: str) -> GeminiError:
    detail = _safe_exception_detail(exc, api_key)
    searchable = detail.lower()
    if "timeout" in searchable or "timed out" in searchable:
        return GeminiError("Gemini request timed out", detail, "GEMINI_TIMEOUT")
    if any(
        marker in searchable
        for marker in ("connection", "reset by peer", "network", "errno 54")
    ):
        return GeminiError(
            "Gemini connection was interrupted", detail, "GEMINI_CONNECTION_FAILED"
        )
    if any(
        marker in searchable
        for marker in (
            "badrequest",
            "bad request",
            "invalid_request",
            "invalid argument",
        )
    ):
        return GeminiError(
            "Gemini rejected the request", detail, "GEMINI_REQUEST_INVALID"
        )
    return GeminiError("Gemini analysis failed", detail)


def _image_mime(url: str) -> str:
    path = url.lower().split("?", 1)[0]
    if path.endswith(".png"):
        return "image/png"
    if path.endswith(".webp"):
        return "image/webp"
    if path.endswith(".heic"):
        return "image/heic"
    return "image/jpeg"


def public_image_inputs(normalized: dict[str, Any], limit: int) -> list[dict[str, str]]:
    photos = normalized.get("photos")
    if not isinstance(photos, list):
        return []
    inputs: list[dict[str, str]] = []
    for photo in photos[:limit]:
        if not isinstance(photo, dict):
            continue
        url = photo.get("url")
        if isinstance(url, str) and url.startswith("https://"):
            inputs.append({"type": "image", "uri": url, "mime_type": _image_mime(url)})
    return inputs


def _line(lines: list[str], label: str, value: Any) -> None:
    if value is None or value == "" or value == [] or value == {}:
        return
    lines.append(f"{label} : {value}")


def _euros(cents: Any) -> str | None:
    if not isinstance(cents, int):
        return None
    return f"{cents / 100:.2f}".replace(".00", "") + " €"


def _useful_attributes(normalized: dict[str, Any]) -> list[str]:
    values: list[str] = []
    for item in normalized.get("attributes") or []:
        if not isinstance(item, dict):
            continue
        key = str(item.get("key") or "").strip()
        value = str(item.get("value") or "").strip()
        if key and value:
            values.append(f"{key} = {value}")
    return values[:20]


def build_natural_prompt(
    *,
    normalized_listing: dict[str, Any],
    device_profile: dict[str, Any],
    purchase_mode: str,
    seller_reply_text: str | None,
    parent_result: dict[str, Any] | None,
    listing_image_count: int,
    private_image_count: int,
) -> str:
    lines = [
        "Analyse cette annonce Leboncoin pour aider l'acheteur à décider avant de payer.",
        "",
        "APPAREIL",
    ]
    _line(
        lines,
        "Catégorie",
        "iPhone" if device_profile.get("category") == "IPHONE" else "MacBook",
    )
    _line(lines, "Modèle détecté", device_profile.get("display_name"))
    specs = (
        device_profile.get("specs")
        if isinstance(device_profile.get("specs"), dict)
        else {}
    )
    spec_labels = {
        "storage": "stockage",
        "memory": "mémoire",
        "color": "couleur",
        "chip": "puce",
    }
    _line(
        lines,
        "Configuration détectée",
        ", ".join(
            f"{spec_labels.get(key, key)} {value}" for key, value in specs.items()
        ),
    )

    lines.extend(["", "ANNONCE"])
    _line(lines, "Titre", normalized_listing.get("title"))
    _line(lines, "Prix demandé", _euros(normalized_listing.get("asking_price_cents")))
    _line(lines, "Description du vendeur", normalized_listing.get("description"))
    attributes = _useful_attributes(normalized_listing)
    _line(lines, "Caractéristiques déclarées", " ; ".join(attributes))
    if listing_image_count:
        _line(lines, "Nombre de photos jointes", listing_image_count)

    seller = normalized_listing.get("seller_public")
    if isinstance(seller, dict) and any(
        value not in (None, "") for value in seller.values()
    ):
        lines.extend(["", "VENDEUR"])
        _line(lines, "Type de compte", seller.get("account_type"))
        _line(lines, "Ancienneté du compte", seller.get("account_age"))
        rating = seller.get("rating_out_of_five")
        count = seller.get("rating_count")
        if rating is not None and count is not None:
            _line(
                lines,
                "Réputation vendeur",
                f"{str(rating).replace('.', ',')}/5 sur {count} avis",
            )
        elif count is not None:
            _line(lines, "Nombre d'avis", count)

    lines.extend(["", "CONTEXTE ACHETEUR"])
    purchase_labels = {
        "face_to_face": "remise en main propre",
        "delivery": "livraison",
        "unknown": "pas encore décidé",
    }
    _line(
        lines, "Mode d'achat prévu", purchase_labels.get(purchase_mode, purchase_mode)
    )
    _line(lines, "Réponse du vendeur", seller_reply_text)
    if private_image_count:
        _line(lines, "Médias privés du vendeur joints", private_image_count)

    if parent_result:
        lines.extend(["", "RAPPORT PRÉCÉDENT À METTRE À JOUR"])
        verdict = (
            parent_result.get("verdict")
            if isinstance(parent_result.get("verdict"), dict)
            else {}
        )
        _line(lines, "Score précédent", verdict.get("deal_score"))
        _line(lines, "Conclusion précédente", verdict.get("headline"))
        risks = (
            parent_result.get("risks")
            if isinstance(parent_result.get("risks"), dict)
            else {}
        )
        risk_items = risks.get("items") if isinstance(risks.get("items"), list) else []
        _line(
            lines,
            "Risques précédents",
            " ; ".join(
                str(item.get("code"))
                for item in risk_items[:5]
                if isinstance(item, dict)
            ),
        )

    if listing_image_count:
        lines.extend(
            [
                "",
                f"Les images d'annonce suivantes sont jointes dans l'ordre : PHOTO_1 à PHOTO_{listing_image_count}.",
            ]
        )
    if private_image_count:
        lines.append(
            f"Les médias vendeur suivants sont joints dans l'ordre : SELLER_MEDIA_1 à SELLER_MEDIA_{private_image_count}."
        )
    return "\n".join(lines)


def parse_candidate(text: str) -> dict[str, Any]:
    """Extract the first JSON object and validate only indispensable structure."""
    decoder = json.JSONDecoder()
    payload: Any = None
    for index, char in enumerate(text):
        if char != "{":
            continue
        try:
            payload, _ = decoder.raw_decode(text[index:])
            break
        except json.JSONDecodeError:
            continue
    if not isinstance(payload, dict):
        raise GeminiError(
            "Gemini returned unreadable JSON",
            "Response did not contain a JSON object",
            "GEMINI_RESPONSE_INVALID",
        )
    if not isinstance(payload.get("headline"), str) or not payload["headline"].strip():
        raise GeminiError(
            "Gemini response missed headline",
            "Missing headline",
            "GEMINI_RESPONSE_INVALID",
        )
    if not isinstance(payload.get("summary"), str) or not payload["summary"].strip():
        raise GeminiError(
            "Gemini response missed summary",
            "Missing summary",
            "GEMINI_RESPONSE_INVALID",
        )
    scores = payload.get("scores")
    if not isinstance(scores, dict) or any(
        key not in scores
        for key in ("price", "condition", "proofs", "consistency", "transaction")
    ):
        raise GeminiError(
            "Gemini response missed scores",
            "Missing score block",
            "GEMINI_RESPONSE_INVALID",
        )
    return payload


def _extract_metadata(interaction: Any, settings: Settings) -> dict[str, Any]:
    metadata: dict[str, Any] = {"interaction_id": getattr(interaction, "id", None)}
    usage = getattr(interaction, "usage", None) or getattr(
        interaction, "usage_metadata", None
    )
    usage_data: dict[str, Any] = {}
    if usage is not None and hasattr(usage, "model_dump"):
        dumped = usage.model_dump(mode="json")
        if isinstance(dumped, dict):
            usage_data = dumped
            metadata["usage"] = dumped
    input_tokens = int(usage_data.get("total_input_tokens") or 0)
    output_tokens = int(usage_data.get("total_output_tokens") or 0)
    thought_tokens = int(usage_data.get("total_thought_tokens") or 0)
    search_count = sum(
        int(item.get("count") or 0)
        for item in usage_data.get("grounding_tool_count") or []
        if isinstance(item, dict) and item.get("type") == "google_search"
    )
    metadata.update(
        {
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "thought_tokens": thought_tokens,
            "search_count": search_count,
        }
    )
    rates = [
        settings.gemini_input_usd_per_million,
        settings.gemini_output_usd_per_million,
        settings.gemini_thought_usd_per_million,
        settings.gemini_search_usd_per_request,
    ]
    if all(rate is not None for rate in rates):
        cost_usd = (
            input_tokens * float(rates[0]) / 1_000_000
            + output_tokens * float(rates[1]) / 1_000_000
            + thought_tokens * float(rates[2]) / 1_000_000
            + search_count * float(rates[3])
        )
        metadata["theoretical_cost_microusd"] = round(cost_usd * 1_000_000)
    return metadata


class GeminiClient:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.client = genai.Client(
            api_key=settings.gemini_api_key,
            http_options=types.HttpOptions(
                timeout=max(1, round(settings.gemini_timeout_seconds * 1000)),
                retry_options=types.HttpRetryOptions(attempts=1),
            ),
        )

    def analyze(
        self,
        *,
        analysis_id: str,
        normalized_listing: dict[str, Any],
        device_profile: dict[str, Any],
        purchase_mode: str,
        seller_reply_text: str | None,
        parent_result: dict[str, Any] | None,
        private_images: list[dict[str, str]],
        model_id: str | None = None,
    ) -> GeminiAnalysis:
        listing_images = public_image_inputs(
            normalized_listing, self.settings.max_listing_images
        )
        seller_images = private_images[: self.settings.max_private_images]
        prompt = build_natural_prompt(
            normalized_listing=normalized_listing,
            device_profile=device_profile,
            purchase_mode=purchase_mode,
            seller_reply_text=seller_reply_text,
            parent_result=parent_result,
            listing_image_count=len(listing_images),
            private_image_count=len(seller_images),
        )
        inputs: list[dict[str, str]] = [
            {"type": "text", "text": prompt},
            *listing_images,
            *seller_images,
        ]
        category = str(device_profile.get("category") or "IPHONE")
        system_instruction = _system_instruction(category)
        selected_model = model_id or self.settings.gemini_model
        logger.info(
            "analysis=%s stage=gemini_request model=%s prompt_chars=%s listing_images=%s private_images=%s search=enabled thinking=%s timeout_s=%s",
            analysis_id,
            selected_model,
            len(system_instruction) + len(prompt),
            len(listing_images),
            len(seller_images),
            self.settings.gemini_thinking_level,
            self.settings.gemini_timeout_seconds,
        )
        try:
            started = time.monotonic()
            interaction = self.client.interactions.create(
                model=selected_model,
                input=inputs,
                system_instruction=system_instruction,
                tools=[{"type": "google_search"}],
                generation_config={
                    "thinking_level": self.settings.gemini_thinking_level
                },
                store=self.settings.gemini_store_interactions,
            )
            output_text = interaction.output_text or ""
            logger.info(
                "analysis=%s stage=gemini_response elapsed_ms=%s output_chars=%s",
                analysis_id,
                round((time.monotonic() - started) * 1000),
                len(output_text),
            )
            candidate = parse_candidate(output_text)
        except GeminiError:
            raise
        except Exception as exc:
            raise _provider_error(exc, self.settings.gemini_api_key) from exc
        return GeminiAnalysis(
            candidate=candidate, metadata=_extract_metadata(interaction, self.settings)
        )
