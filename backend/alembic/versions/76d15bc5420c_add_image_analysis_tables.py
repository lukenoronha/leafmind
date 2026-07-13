"""add image analysis tables (uploaded_images, predictions, chat_messages)

Revision ID: 76d15bc5420c
Revises: 14f959a026f2
Create Date: 2026-07-13

Sprint 3: Image Analysis Pipeline. Introduces uploaded-image metadata,
structured classification predictions, and VLM-only chat message history.
Hand-written (matching app.models exactly) for the same reason as the
Sprint 2 migration: no live PostgreSQL instance available in this environment
to run --autogenerate against.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "76d15bc5420c"
down_revision: Union[str, None] = "14f959a026f2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "uploaded_images",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("original_filename", sa.String(length=255), nullable=False),
        sa.Column("stored_path", sa.String(length=500), nullable=False),
        sa.Column("content_type", sa.String(length=100), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("checksum_sha256", sa.String(length=64), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_uploaded_images_user_id", "uploaded_images", ["user_id"])
    op.create_index("ix_uploaded_images_checksum_sha256", "uploaded_images", ["checksum_sha256"])

    op.create_table(
        "predictions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("image_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("predicted_label", sa.String(length=150), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=False),
        sa.Column("candidates", sa.JSON(), nullable=False),
        sa.Column("model_name", sa.String(length=150), nullable=False),
        sa.Column("raw_response", sa.String(), nullable=False),
        sa.Column("preprocessing_ms", sa.Float(), nullable=False),
        sa.Column("inference_ms", sa.Float(), nullable=False),
        sa.Column("prompt_tokens", sa.Integer(), nullable=True),
        sa.Column("completion_tokens", sa.Integer(), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.ForeignKeyConstraint(["image_id"], ["uploaded_images.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_predictions_image_id", "predictions", ["image_id"])
    op.create_index("ix_predictions_user_id", "predictions", ["user_id"])

    op.create_table(
        "chat_messages",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("conversation_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("image_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("role", sa.String(length=20), nullable=False),
        sa.Column("content", sa.String(), nullable=False),
        sa.Column("model_name", sa.String(length=150), nullable=True),
        sa.Column("inference_ms", sa.Float(), nullable=True),
        sa.Column("prompt_tokens", sa.Integer(), nullable=True),
        sa.Column("completion_tokens", sa.Integer(), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["image_id"], ["uploaded_images.id"], ondelete="SET NULL"),
    )
    op.create_index("ix_chat_messages_conversation_id", "chat_messages", ["conversation_id"])
    op.create_index("ix_chat_messages_user_id", "chat_messages", ["user_id"])
    op.create_index("ix_chat_messages_image_id", "chat_messages", ["image_id"])


def downgrade() -> None:
    op.drop_index("ix_chat_messages_image_id", table_name="chat_messages")
    op.drop_index("ix_chat_messages_user_id", table_name="chat_messages")
    op.drop_index("ix_chat_messages_conversation_id", table_name="chat_messages")
    op.drop_table("chat_messages")

    op.drop_index("ix_predictions_user_id", table_name="predictions")
    op.drop_index("ix_predictions_image_id", table_name="predictions")
    op.drop_table("predictions")

    op.drop_index("ix_uploaded_images_checksum_sha256", table_name="uploaded_images")
    op.drop_index("ix_uploaded_images_user_id", table_name="uploaded_images")
    op.drop_table("uploaded_images")
