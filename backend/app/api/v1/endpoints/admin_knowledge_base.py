"""Admin Knowledge Base endpoints (Sprint 6) — PDF upload, listing, deletion,
per-document chunk detail, and ChromaDB reindexing. Admin-only.

Thin wrapper over `RAGService` via `AdminKnowledgeBaseService`; adds audit
logging and per-document chunk detail on top of what `/documents/*` and
`/rag/*` already expose (see Sprint 4).
"""

import uuid

from fastapi import APIRouter, Depends, File, UploadFile, status

from app.api.deps import AdminKnowledgeBaseServiceDep, CurrentUserDep, require_role
from app.models.role import RoleName
from app.schemas.admin import (
    AdminDocumentDetailResponse,
    AdminDocumentListResponse,
    AdminDocumentResponse,
    AdminReindexRequest,
    AdminReindexResponse,
    DocumentChunkResponse,
    KnowledgeBaseStatusResponse,
)

router = APIRouter(
    prefix="/admin/knowledge-base",
    tags=["Admin: Knowledge Base"],
    dependencies=[Depends(require_role(RoleName.ADMIN))],
)


def _to_document_response(document) -> AdminDocumentResponse:
    return AdminDocumentResponse(
        document_id=document.id,
        original_filename=document.original_filename,
        size_bytes=document.size_bytes,
        status=document.status.value,
        status_message=document.status_message,
        page_count=document.page_count,
        chunk_count=document.chunk_count,
        created_at=document.created_at,
    )


@router.post(
    "/documents",
    response_model=AdminDocumentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload a PDF into the knowledge base",
)
async def upload_document(
    current_user: CurrentUserDep,
    service: AdminKnowledgeBaseServiceDep,
    file: UploadFile = File(...),
) -> AdminDocumentResponse:
    raw_bytes = await file.read()
    document = await service.upload_document(
        actor=current_user,
        raw_bytes=raw_bytes,
        original_filename=file.filename or "document.pdf",
        content_type=file.content_type or "application/octet-stream",
    )
    return _to_document_response(document)


@router.get(
    "/documents",
    response_model=AdminDocumentListResponse,
    summary="List knowledge base documents",
)
async def list_documents(
    current_user: CurrentUserDep,
    service: AdminKnowledgeBaseServiceDep,
    limit: int = 50,
    offset: int = 0,
) -> AdminDocumentListResponse:
    documents, total = await service.list_documents(limit=min(limit, 200), offset=max(offset, 0))
    return AdminDocumentListResponse(
        items=[_to_document_response(d) for d in documents], total=total, limit=limit, offset=offset
    )


@router.get(
    "/documents/{document_id}",
    response_model=AdminDocumentDetailResponse,
    summary="Get document metadata and its indexed chunks",
)
async def get_document_detail(
    document_id: uuid.UUID, current_user: CurrentUserDep, service: AdminKnowledgeBaseServiceDep
) -> AdminDocumentDetailResponse:
    document, chunks = await service.get_document_detail(document_id=document_id)
    return AdminDocumentDetailResponse(
        document=_to_document_response(document),
        chunks=[
            DocumentChunkResponse(
                chunk_id=c.id,
                chunk_index=c.chunk_index,
                content=c.content,
                page_number=c.page_number,
                chapter=c.chapter,
            )
            for c in chunks
        ],
    )


@router.delete(
    "/documents/{document_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a document from the knowledge base",
)
async def delete_document(
    document_id: uuid.UUID, current_user: CurrentUserDep, service: AdminKnowledgeBaseServiceDep
) -> None:
    await service.delete_document(actor=current_user, document_id=document_id)


@router.post(
    "/reindex",
    response_model=AdminReindexResponse,
    summary="Re-index one document or the entire knowledge base",
)
async def reindex(
    payload: AdminReindexRequest,
    current_user: CurrentUserDep,
    service: AdminKnowledgeBaseServiceDep,
) -> AdminReindexResponse:
    documents = await service.reindex(actor=current_user, document_id=payload.document_id)
    return AdminReindexResponse(
        reindexed_count=len(documents), documents=[_to_document_response(d) for d in documents]
    )


@router.get(
    "/status",
    response_model=KnowledgeBaseStatusResponse,
    summary="Get knowledge base status",
)
async def get_status(
    current_user: CurrentUserDep, service: AdminKnowledgeBaseServiceDep
) -> KnowledgeBaseStatusResponse:
    return KnowledgeBaseStatusResponse(**await service.get_status())
