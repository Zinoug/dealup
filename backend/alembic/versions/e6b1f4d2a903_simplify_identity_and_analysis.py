"""Store user profiles and consolidate analysis snapshots.

Revision ID: e6b1f4d2a903
Revises: a91d6c3f2b74
Create Date: 2026-07-19 14:00:00
"""

from typing import Any, Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "e6b1f4d2a903"
down_revision: Union[str, None] = "a91d6c3f2b74"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _json_type() -> sa.types.TypeEngine:
    return (
        postgresql.JSONB() if op.get_bind().dialect.name == "postgresql" else sa.JSON()
    )


def _rows() -> list[dict[str, Any]]:
    result = op.get_bind().execute(
        sa.text(
            """
            SELECT id, source_url, external_listing_id, seller_contacted,
                   seller_reply_text, seller_media, listing_payload,
                   normalized_listing, device_profile, parent_result,
                   provider_metadata, model_config, prompt_version, schema_version,
                   taxonomy_version, scoring_version, checklist_version,
                   device_catalog_version, billed_cost_microusd,
                   provider_pricing_version
            FROM analyses
            """
        )
    ).mappings()
    return [dict(row) for row in result]


def upgrade() -> None:
    json_type = _json_type()
    for column in [
        sa.Column("email", sa.String(length=320), nullable=True),
        sa.Column("display_name", sa.String(length=255), nullable=True),
        sa.Column("auth_provider", sa.String(length=32), nullable=True),
        sa.Column("clerk_created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("clerk_synced_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=True),
    ]:
        op.add_column("users", column)
    op.create_index("ix_users_email", "users", ["email"])
    op.create_index("ix_users_auth_provider", "users", ["auth_provider"])

    op.add_column("analyses", sa.Column("input_snapshot", json_type, nullable=True))
    op.add_column("analyses", sa.Column("seller_context", json_type, nullable=True))
    op.add_column("analyses", sa.Column("run_metadata", json_type, nullable=True))
    op.add_column(
        "analyses", sa.Column("engine_revision", sa.String(length=64), nullable=True)
    )

    analyses = sa.table(
        "analyses",
        sa.column("id", sa.String()),
        sa.column("input_snapshot", json_type),
        sa.column("seller_context", json_type),
        sa.column("run_metadata", json_type),
        sa.column("engine_revision", sa.String()),
    )
    connection = op.get_bind()
    for row in _rows():
        input_snapshot = {
            "source_url": row["source_url"],
            "external_listing_id": row["external_listing_id"],
            "listing_payload": row["listing_payload"],
            "normalized_listing": row["normalized_listing"],
            "device_profile": row["device_profile"],
        }
        if row["parent_result"] is not None:
            input_snapshot["legacy_parent_result"] = row["parent_result"]
        run_metadata = dict(row["provider_metadata"] or {})
        if row["model_config"] is not None:
            run_metadata["model_config"] = row["model_config"]
        if row["provider_pricing_version"] is not None:
            run_metadata["provider_pricing_version"] = row["provider_pricing_version"]
        if row["billed_cost_microusd"] is not None:
            run_metadata["billed_cost_microusd"] = row["billed_cost_microusd"]
        run_metadata["legacy_contract"] = {
            "prompt": row["prompt_version"],
            "schema": row["schema_version"],
            "taxonomy": row["taxonomy_version"],
            "scoring": row["scoring_version"],
            "checklist": row["checklist_version"],
            "catalog": row["device_catalog_version"],
        }
        connection.execute(
            analyses.update()
            .where(analyses.c.id == row["id"])
            .values(
                input_snapshot=input_snapshot,
                seller_context={
                    "already_contacted": bool(row["seller_contacted"]),
                    "reply_text": row["seller_reply_text"],
                    "media": row["seller_media"] or [],
                },
                run_metadata=run_metadata,
                engine_revision=f"legacy-{row['prompt_version'] or 'unknown'}",
            )
        )

    if connection.dialect.name == "sqlite":
        with op.batch_alter_table("analyses") as batch_op:
            for name in ("input_snapshot", "seller_context", "run_metadata"):
                batch_op.alter_column(name, nullable=False, server_default="{}")
            batch_op.alter_column(
                "engine_revision", nullable=False, server_default="current"
            )
    else:
        for name in ("input_snapshot", "seller_context", "run_metadata"):
            op.alter_column(
                "analyses", name, nullable=False, server_default=sa.text("'{}'::jsonb")
            )
        op.alter_column(
            "analyses", "engine_revision", nullable=False, server_default="current"
        )

    op.drop_index("ix_analyses_external_listing_id", table_name="analyses")
    for column in [
        "source_url",
        "external_listing_id",
        "seller_contacted",
        "seller_reply_text",
        "seller_media",
        "listing_payload",
        "normalized_listing",
        "device_profile",
        "parent_result",
        "provider_metadata",
        "model_config",
        "prompt_version",
        "schema_version",
        "taxonomy_version",
        "scoring_version",
        "checklist_version",
        "device_catalog_version",
        "input_fingerprint",
        "billed_cost_microusd",
        "provider_pricing_version",
    ]:
        op.drop_column("analyses", column)


def downgrade() -> None:
    json_type = _json_type()
    legacy_columns = [
        sa.Column("source_url", sa.Text(), nullable=True),
        sa.Column("external_listing_id", sa.String(length=128), nullable=True),
        sa.Column("seller_contacted", sa.Boolean(), nullable=True),
        sa.Column("seller_reply_text", sa.Text(), nullable=True),
        sa.Column("seller_media", json_type, nullable=True),
        sa.Column("listing_payload", json_type, nullable=True),
        sa.Column("normalized_listing", json_type, nullable=True),
        sa.Column("device_profile", json_type, nullable=True),
        sa.Column("parent_result", json_type, nullable=True),
        sa.Column("provider_metadata", json_type, nullable=True),
        sa.Column("model_config", json_type, nullable=True),
        sa.Column("prompt_version", sa.String(length=32), nullable=True),
        sa.Column("schema_version", sa.String(length=32), nullable=True),
        sa.Column("taxonomy_version", sa.String(length=32), nullable=True),
        sa.Column("scoring_version", sa.String(length=32), nullable=True),
        sa.Column("checklist_version", sa.String(length=32), nullable=True),
        sa.Column("device_catalog_version", sa.String(length=32), nullable=True),
        sa.Column("input_fingerprint", sa.String(length=64), nullable=True),
        sa.Column("billed_cost_microusd", sa.BigInteger(), nullable=True),
        sa.Column("provider_pricing_version", sa.String(length=64), nullable=True),
    ]
    for column in legacy_columns:
        op.add_column("analyses", column)

    connection = op.get_bind()
    rows = connection.execute(
        sa.text(
            "SELECT id, request_fingerprint, input_snapshot, seller_context, run_metadata FROM analyses"
        )
    ).mappings()
    for row in rows:
        snapshot = row["input_snapshot"] or {}
        seller = row["seller_context"] or {}
        metadata = row["run_metadata"] or {}
        contract = metadata.get("legacy_contract") or {}
        connection.execute(
            sa.text(
                """
                UPDATE analyses SET source_url=:source_url,
                    external_listing_id=:external_listing_id,
                    seller_contacted=:seller_contacted,
                    seller_reply_text=:seller_reply_text,
                    seller_media=:seller_media,
                    listing_payload=:listing_payload,
                    normalized_listing=:normalized_listing,
                    device_profile=:device_profile,
                    parent_result=:parent_result,
                    provider_metadata=:provider_metadata,
                    model_config=:model_config,
                    prompt_version=:prompt_version,
                    schema_version=:schema_version,
                    taxonomy_version=:taxonomy_version,
                    scoring_version=:scoring_version,
                    checklist_version=:checklist_version,
                    device_catalog_version=:device_catalog_version,
                    input_fingerprint=:input_fingerprint,
                    billed_cost_microusd=:billed_cost_microusd,
                    provider_pricing_version=:provider_pricing_version
                WHERE id=:id
                """
            ),
            {
                "id": row["id"],
                "source_url": snapshot.get("source_url") or "",
                "external_listing_id": snapshot.get("external_listing_id"),
                "seller_contacted": bool(seller.get("already_contacted")),
                "seller_reply_text": seller.get("reply_text"),
                "seller_media": seller.get("media") or [],
                "listing_payload": snapshot.get("listing_payload"),
                "normalized_listing": snapshot.get("normalized_listing"),
                "device_profile": snapshot.get("device_profile"),
                "parent_result": snapshot.get("legacy_parent_result"),
                "provider_metadata": metadata,
                "model_config": metadata.get("model_config"),
                "prompt_version": contract.get("prompt") or "3.0",
                "schema_version": contract.get("schema") or "2.0",
                "taxonomy_version": contract.get("taxonomy") or "1.0",
                "scoring_version": contract.get("scoring") or "1.0",
                "checklist_version": contract.get("checklist") or "1.0",
                "device_catalog_version": contract.get("catalog") or "1.0",
                "input_fingerprint": row["request_fingerprint"],
                "billed_cost_microusd": metadata.get("billed_cost_microusd"),
                "provider_pricing_version": metadata.get("provider_pricing_version"),
            },
        )
    op.create_index(
        "ix_analyses_external_listing_id", "analyses", ["external_listing_id"]
    )
    for column in ["engine_revision", "run_metadata", "seller_context", "input_snapshot"]:
        op.drop_column("analyses", column)

    op.drop_index("ix_users_auth_provider", table_name="users")
    op.drop_index("ix_users_email", table_name="users")
    for column in [
        "last_seen_at",
        "clerk_synced_at",
        "clerk_created_at",
        "auth_provider",
        "display_name",
        "email",
    ]:
        op.drop_column("users", column)
