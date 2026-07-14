"""add admin tables (admin_activity_log, app_settings)

Revision ID: 4b8e6f2d1a3c
Revises: 9c3d21a7e9f4
Create Date: 2026-07-14

Sprint 6: Administrative backend. Introduces an actor-scoped admin action
audit trail (`admin_activity_log`) and a DB-persisted admin-configurable
settings override table (`app_settings`) — both purely additive, no existing
tables are altered. Hand-written (matching app.models exactly) for the same
reason as prior migrations: no live PostgreSQL instance available in this
environment to run --autogenerate against.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "4b8e6f2d1a3c"
down_revision: Union[str, None] = "9c3d21a7e9f4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "admin_activity_log",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("actor_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("action", sa.String(length=100), nullable=False),
        sa.Column("target_type", sa.String(length=50), nullable=True),
        sa.Column("target_id", sa.String(length=150), nullable=True),
        sa.Column("details", sa.JSON(), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.ForeignKeyConstraint(["actor_user_id"], ["users.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_admin_activity_log_actor_user_id", "admin_activity_log", ["actor_user_id"])
    op.create_index("ix_admin_activity_log_action", "admin_activity_log", ["action"])

    op.create_table(
        "app_settings",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("key", sa.String(length=100), nullable=False),
        sa.Column("value", sa.String(length=500), nullable=False),
        sa.Column("value_type", sa.String(length=20), nullable=False, server_default="string"),
        sa.Column("updated_by", sa.String(length=320), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.UniqueConstraint("key", name="uq_app_settings_key"),
    )
    op.create_index("ix_app_settings_key", "app_settings", ["key"])


def downgrade() -> None:
    op.drop_index("ix_app_settings_key", table_name="app_settings")
    op.drop_table("app_settings")

    op.drop_index("ix_admin_activity_log_action", table_name="admin_activity_log")
    op.drop_index("ix_admin_activity_log_actor_user_id", table_name="admin_activity_log")
    op.drop_table("admin_activity_log")
