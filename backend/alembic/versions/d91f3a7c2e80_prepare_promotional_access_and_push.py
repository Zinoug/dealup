"""Prepare promotional access and unique push-token ownership.

Revision ID: d91f3a7c2e80
Revises: b7e3d9a4c120
Create Date: 2026-07-22 19:00:00
"""

from typing import Sequence, Union

from alembic import op


revision: str = "d91f3a7c2e80"
down_revision: Union[str, None] = "b7e3d9a4c120"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # A push token belongs to the last authenticated account on that installation.
    op.drop_constraint("uq_device_user_token", "devices", type_="unique")
    op.create_unique_constraint("uq_device_push_token", "devices", ["push_token"])


def downgrade() -> None:
    op.drop_constraint("uq_device_push_token", "devices", type_="unique")
    op.create_unique_constraint(
        "uq_device_user_token", "devices", ["user_id", "push_token"]
    )
