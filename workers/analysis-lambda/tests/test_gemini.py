from types import SimpleNamespace

from analysis_worker.integrations.gemini import GeminiClient, parse_candidate
from tests.factories import device_profile, normalized_listing


def test_parser_accepts_json_surrounded_by_markdown() -> None:
    candidate = parse_candidate(
        "Voici le résultat :\n```json\n"
        '{"headline":"Avis","summary":"Résumé","scores":'
        '{"price":1,"condition":2,"proofs":3,"consistency":4,"transaction":5}}'
        "\n```"
    )

    assert candidate["headline"] == "Avis"


def test_gemini_call_uses_system_json_example_without_response_schema() -> None:
    captured = {}

    class FakeInteractions:
        def create(self, **kwargs):
            captured.update(kwargs)
            return SimpleNamespace(
                id="interaction-test",
                output_text=(
                    '{"headline":"Avis","summary":"Résumé","scores":'
                    '{"price":70,"condition":70,"proofs":70,'
                    '"consistency":70,"transaction":70}}'
                ),
                usage=None,
                usage_metadata=None,
            )

    client = GeminiClient.__new__(GeminiClient)
    client.settings = SimpleNamespace(
        max_listing_images=10,
        max_private_images=10,
        gemini_model="gemini-test",
        gemini_thinking_level="low",
        gemini_store_interactions=False,
        gemini_timeout_seconds=60,
        gemini_input_usd_per_million=None,
        gemini_output_usd_per_million=None,
        gemini_thought_usd_per_million=None,
        gemini_search_usd_per_request=None,
    )
    client.client = SimpleNamespace(interactions=FakeInteractions())

    client.analyze(
        analysis_id="analysis-test",
        normalized_listing=normalized_listing(),
        device_profile=device_profile(),
        purchase_mode="delivery",
        seller_reply_text=None,
        parent_result=None,
        private_images=[],
    )

    assert "response_format" not in captured
    assert (
        "Réponds UNIQUEMENT avec un objet JSON valide" in captured["system_instruction"]
    )
    assert '"scores"' in captured["system_instruction"]
    assert "L'angle, le cadrage, une coque, un reflet" in captured["system_instruction"]
    assert "Une variation de teinte entre photos" in captured["system_instruction"]
    assert (
        "L'absence d'un détail n'est pas une preuve positive"
        in captured["system_instruction"]
    )
    assert captured["generation_config"] == {"thinking_level": "low"}
