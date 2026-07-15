"""add users.avatar_path

Revision ID: 9b1f3a7c5e2d
Revises: 2e6a4d8f0b1c
Create Date: 2026-07-15

Sprint 8: User Hub profile editing + avatar upload. Adds a single additive,
nullable column (`avatar_path`) to `users`, storing the relative on-disk
path of an uploaded avatar image (mirrors `uploaded_images.stored_path`).
No backfill needed — existing users simply have no avatar until they upload
one, same as any newly-registered user. Hand-written (matching app.models
exactly) for the same reason as prior migrations: no live PostgreSQL
instance available in this environment to run --autogenerate against.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "9b1f3a7c5e2d"
down_revision: Union[str, None] = "2e6a4d8f0b1c"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("avatar_path", sa.String(length=500), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "avatar_path")
