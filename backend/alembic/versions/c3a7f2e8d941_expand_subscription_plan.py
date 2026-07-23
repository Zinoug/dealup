"""Allow the internal promotional subscription plan.

Revision ID: c3a7f2e8d941
Revises: d91f3a7c2e80
Create Date: 2026-07-23 10:00:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c3a7f2e8d941"
down_revision: Union[str, None] = "d91f3a7c2e80"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "subscriptions",
        "plan",
        existing_type=sa.String(length=7),
        type_=sa.String(length=11),
        existing_nullable=False,
    )


def downgrade() -> None:
    op.execute(
        sa.text(
            "UPDATE subscriptions SET plan = 'none' WHERE plan = 'promotional'"
        )
    )
    op.alter_column(
        "subscriptions",
        "plan",
        existing_type=sa.String(length=11),
        type_=sa.String(length=7),
        existing_nullable=False,
    )
