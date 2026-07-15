"""Grounded RAG chat/query endpoints — replaces the temporary VLM-only chat (Sprint 3).

Thin HTTP layer over `RAGService`; retrieval + generation orchestration,
persistence, and structured logging all live there. Returns retrieval
metadata (timing, retrieved chunks, similarity scores, source metadata)
alongside every answer so the frontend can visualize what grounded a
response.
"""

import uuid

from fastapi import APIRouter

from app.api.deps import CurrentUserDep, RAGServiceDep
from app.schemas.rag import (
    ConversationMessageResponse,
    ConversationResponse,
    PersistedSourceResponse,
    RAGMessageResponse,
    RAGQueryRequest,
    RAGQueryResponse,
    RAGReindexedDocument,
    RAGReindexRequest,
    RAGReindexResponse,
    RAGStatusResponse,
    RetrievalMetadata,
    RetrievedChunkResponse,
)

router = APIRouter(prefix="/rag", tags=["RAG (Retrieval-Augmented Generation)"])


@router.post(
    "/query",
    response_model=RAGQueryResponse,
    summary="Ask a grounded question about medicinal plants",
    description="Retrieves the most relevant chunks from the indexed document "
    "knowledge base (ChromaDB) and generates an answer with Qwen2.5-VL, "
    "grounded in that context plus any predicted plant species and prior "
    "conversation history. Conversation turns are persisted the same way as "
    "the Sprint 3 chat feature it replaces.",
)
async def query(
    payload: RAGQueryRequest,
    current_user: CurrentUserDep,
    service: RAGServiceDep,
) -> RAGQueryResponse:
    conversation_id, assistant_message, retrieval = await service.send_message(
        user=current_user,
        message=payload.message,
        conversation_id=payload.conversation_id,
        image_id=payload.image_id,
        top_k=payload.top_k,
        similarity_threshold=payload.similarity_threshold,
        max_context_chars=payload.max_context_chars,
    )
    return RAGQueryResponse(
        conversation_id=conversation_id,
        message=RAGMessageResponse.model_validate(assistant_message),
        model_name=assistant_message.model_name or "unknown",
        inference_ms=assistant_message.inference_ms or 0.0,
        retrieval=RetrievalMetadata(
            retrieval_ms=retrieval.retrieval_ms,
            top_k=retrieval.top_k,
            similarity_threshold=retrieval.similarity_threshold,
            retrieved_chunks=[
                RetrievedChunkResponse(
                    chunk_id=c.chunk_id,
                    document_id=c.document_id,
                    document_name=c.document_name,
                    page_number=c.page_number,
                    chapter=c.chapter,
                    score=c.score,
                    text=c.text,
                )
                for c in retrieval.chunks
            ],
        ),
    )


@router.get(
    "/conversations/{prediction_id}",
    response_model=ConversationResponse,
    summary="Reopen a conversation by prediction",
    description="Returns every persisted chat turn tied to the given prediction, "
    "oldest first — lets a Chat History entry be reopened even if the "
    "browser's local copy was cleared. Only turns sent after this field was "
    "introduced have a recorded prediction_id, so older conversations return "
    "an empty list rather than an error.",
)
async def get_conversation(
    prediction_id: uuid.UUID,
    current_user: CurrentUserDep,
    service: RAGServiceDep,
) -> ConversationResponse:
    messages = await service.get_conversation_by_prediction(
        user=current_user, prediction_id=prediction_id
    )
    return ConversationResponse(
        prediction_id=prediction_id,
        messages=[
            ConversationMessageResponse(
                id=msg.id,
                role=msg.role.value,
                content=msg.content,
                created_at=msg.created_at,
                sources=[
                    PersistedSourceResponse(**source)
                    for source in (msg.retrieved_sources or [])
                ],
            )
            for msg in messages
        ],
    )


@router.post(
    "/reindex",
    response_model=RAGReindexResponse,
    summary="Re-run ingestion for one document or the entire knowledge base",
    description="Clears existing chunks/vectors and re-parses, re-chunks, and "
    "re-embeds the target document(s). Useful after changing chunking or "
    "embedding model configuration. Omit `document_id` to reindex everything.",
)
async def reindex(
    payload: RAGReindexRequest,
    current_user: CurrentUserDep,
    service: RAGServiceDep,
) -> RAGReindexResponse:
    documents = await service.reindex(document_id=payload.document_id)
    return RAGReindexResponse(
        reindexed=[
            RAGReindexedDocument(
                document_id=doc.id,
                original_filename=doc.original_filename,
                status=doc.status.value,
                chunk_count=doc.chunk_count,
                page_count=doc.page_count,
            )
            for doc in documents
        ]
    )


@router.get(
    "/status",
    response_model=RAGStatusResponse,
    summary="Get RAG pipeline health and knowledge-base statistics",
    description="Reports vector store readiness plus document/chunk counts, "
    "for dashboards and health checks.",
)
async def get_status(
    current_user: CurrentUserDep,
    service: RAGServiceDep,
) -> RAGStatusResponse:
    return RAGStatusResponse(**await service.get_status())
