from dataclasses import dataclass
from typing import Any

import psycopg
from psycopg.rows import dict_row


SCALAR_METRIC_KEYS = {
    "input_tokens",
    "output_tokens",
    "thought_tokens",
    "search_count",
    "listing_image_count",
    "private_image_count",
    "piloterr_duration_ms",
    "gemini_duration_ms",
    "total_duration_ms",
    "theoretical_cost_microusd",
    "piloterr_cost_microeur",
}


def _metadata_details(metadata: dict[str, Any]) -> dict[str, Any]:
    return {
        key: value for key, value in metadata.items() if key not in SCALAR_METRIC_KEYS
    }


@dataclass(frozen=True)
class AnalysisJob:
    id: str
    user_id: str
    kind: str
    purchase_mode: str
    input_snapshot: dict[str, Any]
    seller_context: dict[str, Any]
    device_category: str
    parent_result: dict[str, Any] | None
    model_id: str | None
    engine_revision: str

    @property
    def source_url(self) -> str:
        return str(self.input_snapshot.get("source_url") or "")

    @property
    def seller_reply_text(self) -> str | None:
        value = self.seller_context.get("reply_text")
        return str(value) if value else None

    @property
    def seller_media(self) -> list[dict[str, Any]]:
        value = self.seller_context.get("media")
        return value if isinstance(value, list) else []

    @property
    def listing_payload(self) -> dict[str, Any] | None:
        value = self.input_snapshot.get("listing_payload")
        return value if isinstance(value, dict) else None

    @property
    def normalized_listing(self) -> dict[str, Any] | None:
        value = self.input_snapshot.get("normalized_listing")
        return value if isinstance(value, dict) else None

    @property
    def device_profile(self) -> dict[str, Any]:
        value = self.input_snapshot.get("device_profile")
        return value if isinstance(value, dict) else {}


class AnalysisRepository:
    def __init__(self, database_url: str) -> None:
        self.database_url = database_url.replace(
            "postgresql+psycopg://", "postgresql://", 1
        )

    def next_pending_id(self) -> str | None:
        with psycopg.connect(self.database_url) as connection:
            row = connection.execute(
                """
                SELECT id FROM analyses
                WHERE status = 'pending'
                ORDER BY created_at ASC
                LIMIT 1
                """
            ).fetchone()
        return str(row[0]) if row else None

    def reserve(self, analysis_id: str) -> AnalysisJob | None:
        reserve_query = """
            UPDATE analyses
            SET status = 'processing', started_at = NOW(), updated_at = NOW(),
                error_code = NULL, error_message = NULL
            WHERE id = %(analysis_id)s
              AND (
                status = 'pending'
                OR (status = 'processing' AND started_at < NOW() - INTERVAL '15 minutes')
              )
            RETURNING id
        """
        with psycopg.connect(self.database_url, row_factory=dict_row) as connection:
            reserved = connection.execute(
                reserve_query, {"analysis_id": analysis_id}
            ).fetchone()
            if reserved is None:
                connection.commit()
                return None
            row = connection.execute(
                """
                SELECT child.id, child.user_id, child.kind, child.purchase_mode,
                       child.input_snapshot, child.seller_context,
                       child.device_category, parent.result AS parent_result,
                       child.model_id, child.engine_revision
                FROM analyses child
                LEFT JOIN analyses parent ON parent.id = child.parent_analysis_id
                WHERE child.id = %(analysis_id)s
                """,
                {"analysis_id": analysis_id},
            ).fetchone()
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
                    run_metadata = %(run_metadata)s::jsonb, model_id = %(model_id)s,
                    input_snapshot = COALESCE(input_snapshot, '{}'::jsonb)
                        || jsonb_build_object(
                            'listing_payload', %(listing_payload)s::jsonb,
                            'normalized_listing', %(normalized_listing)s::jsonb
                        ),
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
                    piloterr_cost_microeur = %(piloterr_cost_microeur)s,
                    completed_at = NOW(), updated_at = NOW()
                WHERE id = %(analysis_id)s AND status = 'processing'
                """,
                {
                    "analysis_id": analysis_id,
                    "candidate": psycopg.types.json.Jsonb(candidate),
                    "result": psycopg.types.json.Jsonb(result),
                    "run_metadata": psycopg.types.json.Jsonb(
                        {**_metadata_details(metadata), "model_config": model_config}
                    ),
                    "model_id": model_id,
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
                    "piloterr_cost_microeur": metadata.get("piloterr_cost_microeur"),
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

    def fail(
        self,
        analysis_id: str,
        code: str,
        message: str,
        metadata: dict[str, Any] | None = None,
    ) -> None:
        metadata = metadata or {}
        with psycopg.connect(self.database_url, row_factory=dict_row) as connection:
            connection.execute(
                """
                UPDATE analyses SET status = 'failed', error_code = %(code)s,
                    error_message = %(message)s,
                    run_metadata = COALESCE(run_metadata, '{}'::jsonb)
                        || %(metadata)s::jsonb,
                    piloterr_duration_ms = %(piloterr_duration_ms)s,
                    gemini_duration_ms = %(gemini_duration_ms)s,
                    total_duration_ms = %(total_duration_ms)s,
                    completed_at = NOW(), updated_at = NOW()
                WHERE id = %(analysis_id)s AND status = 'processing'
                """,
                {
                    "analysis_id": analysis_id,
                    "code": code,
                    "message": message[:1000],
                    "metadata": psycopg.types.json.Jsonb(_metadata_details(metadata)),
                    "piloterr_duration_ms": metadata.get("piloterr_duration_ms"),
                    "gemini_duration_ms": metadata.get("gemini_duration_ms"),
                    "total_duration_ms": metadata.get("total_duration_ms"),
                },
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
