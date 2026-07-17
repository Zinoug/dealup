"""analysis v2 contracts, devices and metrics

Revision ID: c42f7a3b0f10
Revises: 7d24a924d115
Create Date: 2026-07-16 18:00:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "c42f7a3b0f10"
down_revision: Union[str, None] = "7d24a924d115"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _json_type() -> sa.types.TypeEngine:
    return (
        postgresql.JSONB() if op.get_bind().dialect.name == "postgresql" else sa.JSON()
    )


def upgrade() -> None:
    json_type = _json_type()

    op.add_column(
        "listing_identifications",
        sa.Column(
            "normalized_payload",
            json_type,
            nullable=False,
            server_default=sa.text("'{}'"),
        ),
    )
    op.add_column(
        "listing_identifications",
        sa.Column(
            "compatibility_status",
            sa.String(length=32),
            nullable=False,
            server_default="UNKNOWN",
        ),
    )
    op.add_column(
        "listing_identifications",
        sa.Column("device_category", sa.String(length=32), nullable=True),
    )
    op.add_column(
        "listing_identifications", sa.Column("device_profile", json_type, nullable=True)
    )
    op.add_column(
        "listing_identifications",
        sa.Column(
            "catalog_version",
            sa.String(length=32),
            nullable=False,
            server_default="1.0",
        ),
    )
    op.create_index(
        "ix_listing_identifications_device_category",
        "listing_identifications",
        ["device_category"],
    )

    analysis_columns = [
        sa.Column("root_analysis_id", sa.String(length=36), nullable=True),
        sa.Column("normalized_listing", json_type, nullable=True),
        sa.Column("device_category", sa.String(length=32), nullable=True),
        sa.Column("device_profile", json_type, nullable=True),
        sa.Column("candidate_result", json_type, nullable=True),
        sa.Column("template_id", sa.String(length=32), nullable=True),
        sa.Column("model_config", json_type, nullable=True),
        sa.Column(
            "taxonomy_version",
            sa.String(length=32),
            nullable=False,
            server_default="1.0",
        ),
        sa.Column(
            "scoring_version",
            sa.String(length=32),
            nullable=False,
            server_default="1.0",
        ),
        sa.Column(
            "checklist_version",
            sa.String(length=32),
            nullable=False,
            server_default="1.0",
        ),
        sa.Column(
            "device_catalog_version",
            sa.String(length=32),
            nullable=False,
            server_default="1.0",
        ),
        sa.Column("input_fingerprint", sa.String(length=64), nullable=True),
        sa.Column("input_tokens", sa.Integer(), nullable=True),
        sa.Column("output_tokens", sa.Integer(), nullable=True),
        sa.Column("thought_tokens", sa.Integer(), nullable=True),
        sa.Column("search_count", sa.Integer(), nullable=True),
        sa.Column("listing_image_count", sa.Integer(), nullable=True),
        sa.Column("private_image_count", sa.Integer(), nullable=True),
        sa.Column("piloterr_duration_ms", sa.Integer(), nullable=True),
        sa.Column("gemini_duration_ms", sa.Integer(), nullable=True),
        sa.Column("total_duration_ms", sa.Integer(), nullable=True),
        sa.Column("theoretical_cost_microusd", sa.BigInteger(), nullable=True),
        sa.Column("billed_cost_microusd", sa.BigInteger(), nullable=True),
        sa.Column("piloterr_cost_microeur", sa.BigInteger(), nullable=True),
        sa.Column("provider_pricing_version", sa.String(length=32), nullable=True),
    ]
    for column in analysis_columns:
        op.add_column("analyses", column)
    op.create_index("ix_analyses_device_category", "analyses", ["device_category"])
    op.create_index("ix_analyses_template_id", "analyses", ["template_id"])
    op.create_index("ix_analyses_root_analysis_id", "analyses", ["root_analysis_id"])
    op.execute(
        "UPDATE analyses SET root_analysis_id = id WHERE parent_analysis_id IS NULL"
    )
    op.alter_column("analyses", "prompt_version", server_default="2.0")
    op.alter_column("analyses", "schema_version", server_default="2.0")

    op.add_column(
        "media", sa.Column("analysis_id", sa.String(length=36), nullable=True)
    )
    op.add_column("media", sa.Column("sha256", sa.String(length=64), nullable=True))
    op.add_column(
        "media",
        sa.Column(
            "role", sa.String(length=32), nullable=False, server_default="seller_media"
        ),
    )
    op.add_column("media", sa.Column("ordinal", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_media_analysis_id",
        "media",
        "analyses",
        ["analysis_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_index("ix_media_analysis_id", "media", ["analysis_id"])

    op.create_table(
        "deletion_jobs",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=True),
        sa.Column("kind", sa.String(length=32), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("object_keys", json_type, nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_deletion_jobs_user_id", "deletion_jobs", ["user_id"])
    op.create_index("ix_deletion_jobs_status", "deletion_jobs", ["status"])

    if op.get_bind().dialect.name == "postgresql":
        for table, columns in {
            "listing_identifications": ["payload", "teaser"],
            "analyses": [
                "seller_media",
                "listing_payload",
                "parent_result",
                "result",
                "provider_metadata",
            ],
            "media": [],
            "revenuecat_events": ["payload"],
        }.items():
            for column in columns:
                op.alter_column(
                    table,
                    column,
                    type_=postgresql.JSONB(),
                    postgresql_using=f"{column}::jsonb",
                )


def downgrade() -> None:
    op.drop_index("ix_deletion_jobs_status", table_name="deletion_jobs")
    op.drop_index("ix_deletion_jobs_user_id", table_name="deletion_jobs")
    op.drop_table("deletion_jobs")

    op.drop_index("ix_media_analysis_id", table_name="media")
    op.drop_constraint("fk_media_analysis_id", "media", type_="foreignkey")
    for column in ["ordinal", "role", "sha256", "analysis_id"]:
        op.drop_column("media", column)

    op.drop_index("ix_analyses_template_id", table_name="analyses")
    op.drop_index("ix_analyses_device_category", table_name="analyses")
    op.drop_index("ix_analyses_root_analysis_id", table_name="analyses")
    for column in [
        "provider_pricing_version",
        "piloterr_cost_microeur",
        "billed_cost_microusd",
        "theoretical_cost_microusd",
        "total_duration_ms",
        "gemini_duration_ms",
        "piloterr_duration_ms",
        "private_image_count",
        "listing_image_count",
        "search_count",
        "thought_tokens",
        "output_tokens",
        "input_tokens",
        "input_fingerprint",
        "device_catalog_version",
        "checklist_version",
        "scoring_version",
        "taxonomy_version",
        "model_config",
        "template_id",
        "candidate_result",
        "device_profile",
        "device_category",
        "normalized_listing",
        "root_analysis_id",
    ]:
        op.drop_column("analyses", column)

    op.drop_index(
        "ix_listing_identifications_device_category",
        table_name="listing_identifications",
    )
    for column in [
        "catalog_version",
        "device_profile",
        "device_category",
        "compatibility_status",
        "normalized_payload",
    ]:
        op.drop_column("listing_identifications", column)
