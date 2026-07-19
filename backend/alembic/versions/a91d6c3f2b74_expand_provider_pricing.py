"""Allow descriptive provider pricing identifiers.

Revision ID: a91d6c3f2b74
Revises: c42f7a3b0f10
Create Date: 2026-07-18 19:35:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a91d6c3f2b74"
down_revision: Union[str, None] = "c42f7a3b0f10"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _resize(length: int, previous_length: int) -> None:
    if op.get_bind().dialect.name == "sqlite":
        with op.batch_alter_table("analyses") as batch_op:
            batch_op.alter_column(
                "provider_pricing_version",
                existing_type=sa.String(length=previous_length),
                type_=sa.String(length=length),
                existing_nullable=True,
            )
        return
    op.alter_column(
        "analyses",
        "provider_pricing_version",
        existing_type=sa.String(length=previous_length),
        type_=sa.String(length=length),
        existing_nullable=True,
    )


def upgrade() -> None:
    _resize(64, 32)


def downgrade() -> None:
    _resize(32, 64)
