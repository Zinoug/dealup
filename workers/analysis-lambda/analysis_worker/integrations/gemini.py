import json
from dataclasses import dataclass
from typing import Any

from google import genai
from pydantic import ValidationError

from analysis_worker.config import Settings
from analysis_worker.contracts import get_contracts
from analysis_worker.schemas import GeminiCandidateV2


class GeminiError(RuntimeError):
    pass


@dataclass(frozen=True)
class GeminiAnalysis:
    candidate: GeminiCandidateV2
    metadata: dict[str, Any]


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


def _extract_metadata(interaction: Any, settings: Settings) -> dict[str, Any]:
    metadata: dict[str, Any] = {"interaction_id": getattr(interaction, "id", None)}
    usage = getattr(interaction, "usage", None) or getattr(
        interaction, "usage_metadata", None
    )
    usage_data: dict[str, Any] = {}
    if usage is not None:
        dumped = usage.model_dump(mode="json") if hasattr(usage, "model_dump") else {}
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
    raw = (
        interaction.model_dump(mode="json")
        if hasattr(interaction, "model_dump")
        else {}
    )
    sources: list[dict[str, str]] = []

    def visit(value: Any) -> None:
        if isinstance(value, dict):
            uri = value.get("uri") or value.get("url")
            title = value.get("title")
            if (
                isinstance(uri, str)
                and uri.startswith("http")
                and "X-Amz-" not in uri
                and "amazonaws.com" not in uri
            ):
                candidate = {"url": uri}
                if isinstance(title, str):
                    candidate["title"] = title[:300]
                if candidate not in sources:
                    sources.append(candidate)
            for child in value.values():
                visit(child)
        elif isinstance(value, list):
            for child in value:
                visit(child)

    visit(raw.get("outputs") or raw.get("steps") or [])
    metadata["sources"] = sources[:30]
    return metadata


class GeminiClient:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.client = genai.Client(api_key=settings.gemini_api_key)

    def analyze(
        self,
        *,
        normalized_listing: dict[str, Any],
        device_profile: dict[str, Any],
        purchase_mode: str,
        seller_reply_text: str | None,
        parent_result: dict[str, Any] | None,
        private_images: list[dict[str, str]],
        model_id: str | None = None,
    ) -> GeminiAnalysis:
        contracts = get_contracts()
        category = str(device_profile["category"])
        common_taxonomy, category_taxonomy = contracts.taxonomy(category)
        allowed_checklists = [
            item
            for item in contracts.checklists.get("items", [])
            if category in item.get("categories", [])
        ]
        prompt_payload = {
            "task": "REANALYZE" if parent_result else "INITIAL_ANALYSIS",
            "purchase_mode": purchase_mode,
            "authoritative_device_profile": device_profile,
            "listing": normalized_listing,
            "seller_reply": seller_reply_text,
            "previous_public_report": parent_result,
            "seller_media_refs": [
                {"source_type": "SELLER_MEDIA", "ref": f"seller_media_{index + 1:02d}"}
                for index in range(
                    len(private_images[: self.settings.max_private_images])
                )
            ],
            "risk_taxonomy": [common_taxonomy, category_taxonomy],
            "allowed_checklist_items": allowed_checklists,
            "scoring_dimensions": contracts.scoring["weights"],
        }
        prompt = (
            contracts.prompt("task")
            + "\n\nDossier JSON :\n"
            + json.dumps(prompt_payload, ensure_ascii=False, separators=(",", ":"))
        )
        inputs: list[dict[str, str]] = [{"type": "text", "text": prompt}]
        inputs.extend(
            public_image_inputs(normalized_listing, self.settings.max_listing_images)
        )
        inputs.extend(private_images[: self.settings.max_private_images])
        try:
            interaction = self.client.interactions.create(
                model=model_id or self.settings.gemini_model,
                input=inputs,
                system_instruction=contracts.prompt("system"),
                tools=[{"type": "google_search"}],
                response_format={
                    "type": "text",
                    "mime_type": "application/json",
                    "schema": GeminiCandidateV2.model_json_schema(),
                },
                generation_config={
                    "temperature": self.settings.gemini_temperature,
                    "thinking_level": self.settings.gemini_thinking_level,
                },
                store=self.settings.gemini_store_interactions,
            )
            candidate = GeminiCandidateV2.model_validate_json(interaction.output_text)
        except (ValidationError, ValueError, TypeError) as exc:
            raise GeminiError(
                "Gemini returned an invalid structured candidate"
            ) from exc
        except Exception as exc:
            raise GeminiError("Gemini analysis failed") from exc
        return GeminiAnalysis(
            candidate=candidate,
            metadata=_extract_metadata(interaction, self.settings),
        )
