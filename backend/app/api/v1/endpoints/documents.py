"""Document (RAG source PDF) upload, listing, and deletion endpoints.

Thin HTTP layer over `RAGService`; parsing/chunking/embedding/indexing
orchestration lives there. Mirrors `app.api.v1.endpoints.images`'s
upload-endpoint conventions.
"""

import uuid

from fastapi import APIRouter, File, UploadFile, status

from app.api.deps import CurrentUserDep, RAGServiceDep
from app.schemas.documents import DocumentListItem, DocumentListResponse, DocumentUploadResponse

router = APIRouter(prefix="/documents", tags=["Documents (RAG knowledge base)"])


@router.post(
    "/upload",
    response_model=DocumentUploadResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload a PDF source document into the RAG knowledge base",
    description="Validates and persists an uploaded PDF, then immediately "
    "parses (PyMuPDF), chunks, embeds, and indexes it into ChromaDB. Returns "
    "the resulting ingestion status and chunk count.",
)
async def upload_document(
    current_user: CurrentUserDep,
    service: RAGServiceDep,
    file: UploadFile = File(..., description="PDF document to add to the knowledge base."),
) -> DocumentUploadResponse:
    raw_bytes = await file.read()
    document = await service.upload_document(
        user=current_user,
        raw_bytes=raw_bytes,
        original_filename=file.filename or "document.pdf",
        content_type=file.content_type or "application/octet-stream",
    )
    return DocumentUploadResponse(
        document_id=document.id,
        original_filename=document.original_filename,
        content_type=document.content_type,
        size_bytes=document.size_bytes,
        checksum_sha256=document.checksum_sha256,
        status=document.status.value,
        status_message=document.status_message,
        page_count=document.page_count,
        chunk_count=document.chunk_count,
        created_at=document.created_at,
    )


@router.get(
    "",
    response_model=DocumentListResponse,
    summary="List documents in the RAG knowledge base",
    description="Paginated list of all ingested source documents, most recent first.",
)
async def list_documents(
    current_user: CurrentUserDep,
    service: RAGServiceDep,
    limit: int = 50,
    offset: int = 0,
) -> DocumentListResponse:
    documents, total = await service.list_documents(limit=min(limit, 200), offset=max(offset, 0))
    return DocumentListResponse(
        items=[
            DocumentListItem(
                document_id=doc.id,
                original_filename=doc.original_filename,
                size_bytes=doc.size_bytes,
                status=doc.status.value,
                status_message=doc.status_message,
                page_count=doc.page_count,
                chunk_count=doc.chunk_count,
                created_at=doc.created_at,
            )
            for doc in documents
        ],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.delete(
    "/{document_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a document from the RAG knowledge base",
    description="Removes the document's stored file, relational chunk rows, "
    "and its vectors from ChromaDB.",
)
async def delete_document(
    document_id: uuid.UUID,
    current_user: CurrentUserDep,
    service: RAGServiceDep,
) -> None:
    await service.delete_document(document_id=document_id)
