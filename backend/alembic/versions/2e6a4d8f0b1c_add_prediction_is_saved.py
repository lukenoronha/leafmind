"""add predictions.is_saved

Revision ID: 2e6a4d8f0b1c
Revises: af2182701ffe
Create Date: 2026-07-15

Sprint 8: Saved Reports. Adds a single additive, non-nullable boolean column
(`is_saved`, server-defaulted to `false`) to `predictions` so a user can
bookmark a prior identification for the Saved Reports page. No existing rows
require backfill — the server default applies retroactively. Hand-written
(matching app.models exactly) for the same reason as prior migrations: no
live PostgreSQL instance available in this environment to run --autogenerate
against.

Rebased onto af2182701ffe (predictions.status, added independently off the
same parent) to keep the migration history linear rather than forked.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "2e6a4d8f0b1c"
down_revision: Union[str, None] = "af2182701ffe"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "predictions",
        sa.Column("is_saved", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.create_index("ix_predictions_is_saved", "predictions", ["is_saved"])


def downgrade() -> None:
    op.drop_index("ix_predictions_is_saved", table_name="predictions")
    op.drop_column("predictions", "is_saved")
