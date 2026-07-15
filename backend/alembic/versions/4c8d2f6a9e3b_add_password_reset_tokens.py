"""add password_reset_tokens

Revision ID: 4c8d2f6a9e3b
Revises: 9b1f3a7c5e2d
Create Date: 2026-07-15

Sprint 8: Forgot/reset password. Introduces a single-use, expiring token
table mirroring refresh_tokens' hashed-storage pattern, but with `is_used`/
`used_at` instead of `is_revoked`/`revoked_at` since a reset token is
consumed exactly once rather than rotated. Purely additive — no existing
tables are altered. Hand-written (matching app.models exactly) for the same
reason as prior migrations: no live PostgreSQL instance available in this
environment to run --autogenerate against.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "4c8d2f6a9e3b"
down_revision: Union[str, None] = "9b1f3a7c5e2d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "password_reset_tokens",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_used", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_password_reset_tokens_user_id", "password_reset_tokens", ["user_id"])
    op.create_index(
        "ix_password_reset_tokens_token_hash", "password_reset_tokens", ["token_hash"], unique=True
    )


def downgrade() -> None:
    op.drop_index("ix_password_reset_tokens_token_hash", table_name="password_reset_tokens")
    op.drop_index("ix_password_reset_tokens_user_id", table_name="password_reset_tokens")
    op.drop_table("password_reset_tokens")
