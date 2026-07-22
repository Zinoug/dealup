"""Limit free identification attempts per user.

Revision ID: b7e3d9a4c120
Revises: f3c8a2d1b704
Create Date: 2026-07-22 12:00:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b7e3d9a4c120"
down_revision: Union[str, None] = "f3c8a2d1b704"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("free_identification_claimed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.execute(
        sa.text(
            """
            UPDATE users
            SET free_identification_claimed_at = (
                SELECT MIN(listing_identifications.created_at)
                FROM listing_identifications
                WHERE listing_identifications.user_id = users.id
            )
            WHERE EXISTS (
                SELECT 1 FROM listing_identifications
                WHERE listing_identifications.user_id = users.id
            )
            """
        )
    )


def downgrade() -> None:
    op.drop_column("users", "free_identification_claimed_at")
