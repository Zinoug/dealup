"""Remove legacy manual subscription access.

Revision ID: f3c8a2d1b704
Revises: e6b1f4d2a903
Create Date: 2026-07-21 16:20:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f3c8a2d1b704"
down_revision: Union[str, None] = "e6b1f4d2a903"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        sa.text(
            """
            UPDATE subscriptions
            SET plan = 'none',
                status = 'inactive',
                product_id = NULL,
                current_period_started_at = NULL,
                current_period_ends_at = NULL,
                will_renew = FALSE,
                environment = NULL
            WHERE environment = 'manual'
               OR product_id LIKE 'manual_%'
            """
        )
    )


def downgrade() -> None:
    # Legacy manual grants cannot be reconstructed safely.
    pass
