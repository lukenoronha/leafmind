"""add prediction status column

Revision ID: af2182701ffe
Revises: 2e6a4d8f0b1c
Create Date: 2026-07-15

Input Validation Layer: adds `predictions.status` (confident / low_confidence)
so a sub-threshold-confidence prediction can be flagged without discarding
the attempt — mirrors the existing `documents.status` pattern. Hand-written,
matching `app.models.prediction.PredictionStatus` exactly (same reason as
prior migrations: no live PostgreSQL instance available here to
--autogenerate against).
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "af2182701ffe"
down_revision: Union[str, None] = "2e6a4d8f0b1c"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "predictions",
        sa.Column(
            "status",
            sa.String(length=20),
            nullable=False,
            server_default="confident",
        ),
    )


def downgrade() -> None:
    op.drop_column("predictions", "status")
