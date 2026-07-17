from dataclasses import dataclass
from typing import Any

import psycopg
from psycopg.rows import dict_row


@dataclass(frozen=True)
class AnalysisJob:
    id: str
    user_id: str
    kind: str
    source_url: str
    purchase_mode: str
    seller_reply_text: str | None
    seller_media: list[dict[str, Any]]
    listing_payload: dict[str, Any] | None
    normalized_listing: dict[str, Any] | None
    device_category: str
    device_profile: dict[str, Any]
    parent_result: dict[str, Any] | None
    model_id: str | None
    prompt_version: str
    schema_version: str
    taxonomy_version: str
    scoring_version: str
    checklist_version: str
    device_catalog_version: str


class AnalysisRepository:
    def __init__(self, database_url: str) -> None:
        self.database_url = database_url.replace(
            "postgresql+psycopg://", "postgresql://", 1
        )

    def reserve(self, analysis_id: str) -> AnalysisJob | None:
        query = """
            UPDATE analyses
            SET status = 'processing', started_at = NOW(), updated_at = NOW(),
                error_code = NULL, error_message = NULL
            WHERE id = %(analysis_id)s
              AND (
                status = 'pending'
                OR (status = 'processing' AND started_at < NOW() - INTERVAL '15 minutes')
              )
            RETURNING id, user_id, kind, source_url, purchase_mode,
                      seller_reply_text, seller_media, listing_payload,
                      normalized_listing, device_category, device_profile, parent_result,
                      model_id, prompt_version, schema_version, taxonomy_version,
                      scoring_version, checklist_version, device_catalog_version
        """
        with psycopg.connect(self.database_url, row_factory=dict_row) as connection:
            row = connection.execute(query, {"analysis_id": analysis_id}).fetchone()
            connection.commit()
        if row is None:
            return None
        return AnalysisJob(**row)

    def complete(
        self,
        analysis_id: str,
        candidate: dict[str, Any],
        result: dict[str, Any],
        model_id: str,
        model_config: dict[str, Any],
        metadata: dict[str, Any],
        listing_payload: dict[str, Any],
        normalized_listing: dict[str, Any],
    ) -> None:
        with psycopg.connect(self.database_url) as connection:
            connection.execute(
                """
                UPDATE analyses
                SET status = 'completed', candidate_result = %(candidate)s::jsonb,
                    result = %(result)s::jsonb,
                    provider_metadata = %(metadata)s::jsonb, model_id = %(model_id)s,
                    model_config = %(model_config)s::jsonb,
                    listing_payload = %(listing_payload)s::jsonb,
                    normalized_listing = %(normalized_listing)s::jsonb,
                    template_id = %(template_id)s,
                    input_tokens = %(input_tokens)s,
                    output_tokens = %(output_tokens)s,
                    thought_tokens = %(thought_tokens)s,
                    search_count = %(search_count)s,
                    listing_image_count = %(listing_image_count)s,
                    private_image_count = %(private_image_count)s,
                    piloterr_duration_ms = %(piloterr_duration_ms)s,
                    gemini_duration_ms = %(gemini_duration_ms)s,
                    total_duration_ms = %(total_duration_ms)s,
                    theoretical_cost_microusd = %(theoretical_cost_microusd)s,
                    billed_cost_microusd = %(billed_cost_microusd)s,
                    piloterr_cost_microeur = %(piloterr_cost_microeur)s,
                    provider_pricing_version = %(provider_pricing_version)s,
                    completed_at = NOW(), updated_at = NOW()
                WHERE id = %(analysis_id)s AND status = 'processing'
                """,
                {
                    "analysis_id": analysis_id,
                    "candidate": psycopg.types.json.Jsonb(candidate),
                    "result": psycopg.types.json.Jsonb(result),
                    "metadata": psycopg.types.json.Jsonb(metadata),
                    "model_id": model_id,
                    "model_config": psycopg.types.json.Jsonb(model_config),
                    "listing_payload": psycopg.types.json.Jsonb(listing_payload),
                    "normalized_listing": psycopg.types.json.Jsonb(normalized_listing),
                    "template_id": result.get("template_id"),
                    "input_tokens": metadata.get("input_tokens"),
                    "output_tokens": metadata.get("output_tokens"),
                    "thought_tokens": metadata.get("thought_tokens"),
                    "search_count": metadata.get("search_count"),
                    "listing_image_count": metadata.get("listing_image_count"),
                    "private_image_count": metadata.get("private_image_count"),
                    "piloterr_duration_ms": metadata.get("piloterr_duration_ms"),
                    "gemini_duration_ms": metadata.get("gemini_duration_ms"),
                    "total_duration_ms": metadata.get("total_duration_ms"),
                    "theoretical_cost_microusd": metadata.get(
                        "theoretical_cost_microusd"
                    ),
                    "billed_cost_microusd": metadata.get("billed_cost_microusd"),
                    "piloterr_cost_microeur": metadata.get("piloterr_cost_microeur"),
                    "provider_pricing_version": metadata.get(
                        "provider_pricing_version"
                    ),
                },
            )
            connection.commit()

    def record_listing_media(
        self,
        *,
        analysis_id: str,
        user_id: str,
        images: list[dict[str, Any]],
    ) -> None:
        if not images:
            return
        with psycopg.connect(self.database_url) as connection:
            for image in images:
                connection.execute(
                    """
                    INSERT INTO media
                        (id, user_id, analysis_id, object_key, content_type, size_bytes,
                         sha256, role, ordinal, status, created_at)
                    VALUES
                        (%(id)s, %(user_id)s, %(analysis_id)s, %(object_key)s,
                         %(content_type)s, %(size_bytes)s, %(sha256)s,
                         'listing_photo', %(ordinal)s, 'ready', NOW())
                    ON CONFLICT (object_key) DO UPDATE SET
                        analysis_id = EXCLUDED.analysis_id,
                        size_bytes = EXCLUDED.size_bytes,
                        sha256 = EXCLUDED.sha256,
                        status = 'ready'
                    """,
                    {
                        "id": image["media_id"],
                        "user_id": user_id,
                        "analysis_id": analysis_id,
                        "object_key": image["object_key"],
                        "content_type": image["content_type"],
                        "size_bytes": image["size_bytes"],
                        "sha256": image["sha256"],
                        "ordinal": image["ordinal"],
                    },
                )
            connection.commit()

    def fail(self, analysis_id: str, code: str, message: str) -> None:
        with psycopg.connect(self.database_url, row_factory=dict_row) as connection:
            connection.execute(
                """
                UPDATE analyses SET status = 'failed', error_code = %(code)s,
                    error_message = %(message)s, completed_at = NOW(), updated_at = NOW()
                WHERE id = %(analysis_id)s AND status = 'processing'
                """,
                {"analysis_id": analysis_id, "code": code, "message": message[:1000]},
            )
            debit = connection.execute(
                """
                SELECT user_id, period_started_at, period_ends_at
                FROM usage_events
                WHERE analysis_id = %(analysis_id)s
                  AND kind IN ('included_debit', 'topup_debit')
                LIMIT 1
                """,
                {"analysis_id": analysis_id},
            ).fetchone()
            reversal = connection.execute(
                """SELECT 1 FROM usage_events
                   WHERE analysis_id = %(analysis_id)s AND kind = 'failure_reversal'""",
                {"analysis_id": analysis_id},
            ).fetchone()
            if debit and not reversal:
                connection.execute(
                    """
                    INSERT INTO usage_events
                        (id, user_id, analysis_id, kind, amount, source_event_id,
                         period_started_at, period_ends_at, created_at)
                    VALUES
                        (%(id)s, %(user_id)s, %(analysis_id)s, 'failure_reversal', 1,
                         %(source)s, %(period_start)s, %(period_end)s, NOW())
                    """,
                    {
                        "id": str(__import__("uuid").uuid4()),
                        "user_id": debit["user_id"],
                        "analysis_id": analysis_id,
                        "source": f"analysis-failure:{analysis_id}",
                        "period_start": debit["period_started_at"],
                        "period_end": debit["period_ends_at"],
                    },
                )
            connection.commit()

    def push_tokens(self, user_id: str) -> list[str]:
        with psycopg.connect(self.database_url) as connection:
            rows = connection.execute(
                "SELECT push_token FROM devices WHERE user_id = %s", (user_id,)
            ).fetchall()
        return [row[0] for row in rows]
