"""add chat_messages.prediction_id

Revision ID: 5f7e2a9c1d4b
Revises: 4c8d2f6a9e3b
Create Date: 2026-07-15

Sprint 8: Conversation reopening. Adds a single additive, nullable FK
(`prediction_id`, ON DELETE SET NULL) to `chat_messages`, so a conversation
can be grouped/reopened by prediction — matching how the frontend's Chat
History page already groups conversations client-side by prediction ID
(see frontend/src/lib/chat-storage.ts). Populated going forward by
RAGService.send_message (derived from image_id's most recent prediction,
never supplied by the client); existing rows are left NULL since the link
was never recorded and can't be reconstructed. Hand-written (matching
app.models exactly) for the same reason as prior migrations: no live
PostgreSQL instance available in this environment to run --autogenerate
against.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "5f7e2a9c1d4b"
down_revision: Union[str, None] = "4c8d2f6a9e3b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "chat_messages",
        sa.Column("prediction_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_index("ix_chat_messages_prediction_id", "chat_messages", ["prediction_id"])
    op.create_foreign_key(
        "fk_chat_messages_prediction_id_predictions",
        "chat_messages",
        "predictions",
        ["prediction_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_chat_messages_prediction_id_predictions", "chat_messages", type_="foreignkey"
    )
    op.drop_index("ix_chat_messages_prediction_id", table_name="chat_messages")
    op.drop_column("chat_messages", "prediction_id")
