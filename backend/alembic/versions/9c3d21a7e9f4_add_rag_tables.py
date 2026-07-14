"""add RAG tables (documents, document_chunks) and chat retrieval metadata

Revision ID: 9c3d21a7e9f4
Revises: 76d15bc5420c
Create Date: 2026-07-14

Sprint 4: Retrieval-Augmented Generation. Introduces document ingestion
metadata and per-chunk relational records; the corresponding vector
embeddings are stored in a separate ChromaDB persistent collection (see
app/rag/vectorstore.py), keyed by document_chunks.id. Also adds additive,
nullable retrieval-metadata columns to chat_messages so grounded assistant
turns can record retrieval_ms/retrieved_chunk_count/retrieved_sources without
a backfill. Hand-written (matching app.models exactly) for the same reason as
prior migrations: no live PostgreSQL instance available in this environment
to run --autogenerate against.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "9c3d21a7e9f4"
down_revision: Union[str, None] = "76d15bc5420c"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "documents",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("uploaded_by_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("original_filename", sa.String(length=255), nullable=False),
        sa.Column("stored_path", sa.String(length=500), nullable=False),
        sa.Column("content_type", sa.String(length=100), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("checksum_sha256", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="pending"),
        sa.Column("status_message", sa.String(length=500), nullable=True),
        sa.Column("page_count", sa.Integer(), nullable=True),
        sa.Column("chunk_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.ForeignKeyConstraint(["uploaded_by_id"], ["users.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_documents_uploaded_by_id", "documents", ["uploaded_by_id"])
    op.create_index("ix_documents_checksum_sha256", "documents", ["checksum_sha256"])

    op.create_table(
        "document_chunks",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("document_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("chunk_index", sa.Integer(), nullable=False),
        sa.Column("content", sa.String(), nullable=False),
        sa.Column("page_number", sa.Integer(), nullable=True),
        sa.Column("chapter", sa.String(length=255), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.ForeignKeyConstraint(["document_id"], ["documents.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_document_chunks_document_id", "document_chunks", ["document_id"])

    op.add_column("chat_messages", sa.Column("retrieval_ms", sa.Float(), nullable=True))
    op.add_column("chat_messages", sa.Column("retrieved_chunk_count", sa.Integer(), nullable=True))
    op.add_column("chat_messages", sa.Column("retrieved_sources", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("chat_messages", "retrieved_sources")
    op.drop_column("chat_messages", "retrieved_chunk_count")
    op.drop_column("chat_messages", "retrieval_ms")

    op.drop_index("ix_document_chunks_document_id", table_name="document_chunks")
    op.drop_table("document_chunks")

    op.drop_index("ix_documents_checksum_sha256", table_name="documents")
    op.drop_index("ix_documents_uploaded_by_id", table_name="documents")
    op.drop_table("documents")
