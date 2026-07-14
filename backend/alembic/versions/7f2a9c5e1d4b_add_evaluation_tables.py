"""add evaluation tables (evaluation_runs)

Revision ID: 7f2a9c5e1d4b
Revises: 4b8e6f2d1a3c
Create Date: 2026-07-14

Sprint 7: Evaluation framework. Introduces a single `evaluation_runs` table
that persists both classification-evaluation and RAG-evaluation results
(discriminated by `run_type`), purely additive — no existing tables are
altered. Hand-written (matching app.models exactly) for the same reason as
prior migrations: no live PostgreSQL instance available in this environment
to run --autogenerate against.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "7f2a9c5e1d4b"
down_revision: Union[str, None] = "4b8e6f2d1a3c"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "evaluation_runs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("run_type", sa.String(length=20), nullable=False),
        sa.Column("triggered_by_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("sample_size_per_class", sa.Integer(), nullable=True),
        sa.Column("metrics", sa.JSON(), nullable=False),
        sa.Column("per_class_report", sa.JSON(), nullable=True),
        sa.Column("class_labels", sa.JSON(), nullable=True),
        sa.Column("sample_count", sa.Integer(), nullable=False),
        sa.Column("duration_ms", sa.Float(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.ForeignKeyConstraint(["triggered_by_id"], ["users.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_evaluation_runs_run_type", "evaluation_runs", ["run_type"])
    op.create_index("ix_evaluation_runs_triggered_by_id", "evaluation_runs", ["triggered_by_id"])


def downgrade() -> None:
    op.drop_index("ix_evaluation_runs_triggered_by_id", table_name="evaluation_runs")
    op.drop_index("ix_evaluation_runs_run_type", table_name="evaluation_runs")
    op.drop_table("evaluation_runs")
