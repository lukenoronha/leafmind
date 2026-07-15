"""End-to-end tests for the grounded RAG chat/query and document endpoints."""

import io

import numpy as np
from PIL import Image


def _make_jpeg_bytes() -> bytes:
    # Textured (not flat) so it clears the input-validation layer's blur
    # heuristic (app.images.preprocessing.content_validation) — a solid
    # color has near-zero edge variance and would be rejected as "too blurry"
    # despite not representing a real photo's sharpness at all.
    rng = np.random.default_rng(0)
    noise = rng.integers(-20, 20, (200, 300, 3))
    image = np.clip(np.full((200, 300, 3), (60, 140, 50)) + noise, 0, 255).astype(np.uint8)
    buffer = io.BytesIO()
    Image.fromarray(image, mode="RGB").save(buffer, format="JPEG")
    return buffer.getvalue()


def _make_pdf_bytes(text: str = "Neem (Azadirachta indica) is a medicinal plant.") -> bytes:
    import fitz

    document = fitz.open()
    page = document.new_page()
    page.insert_text((72, 72), text)
    pdf_bytes = document.tobytes()
    document.close()
    return pdf_bytes


async def test_rag_query_without_documents_starts_new_conversation(client, auth_headers):
    response = await client.post(
        "/api/v1/rag/query",
        headers=auth_headers,
        json={"message": "What plants are toxic to dogs?"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["conversation_id"]
    assert body["message"]["role"] == "assistant"
    assert body["message"]["content"]
    assert body["retrieval"]["retrieved_chunks"] == []


async def test_rag_query_requires_authentication(client):
    response = await client.post("/api/v1/rag/query", json={"message": "hello"})
    assert response.status_code == 403


async def test_rag_query_continues_existing_conversation(client, auth_headers):
    first = await client.post("/api/v1/rag/query", headers=auth_headers, json={"message": "Hello"})
    conversation_id = first.json()["conversation_id"]

    second = await client.post(
        "/api/v1/rag/query",
        headers=auth_headers,
        json={"message": "Tell me more", "conversation_id": conversation_id},
    )
    assert second.status_code == 200
    assert second.json()["conversation_id"] == conversation_id


async def test_rag_query_grounds_response_in_uploaded_image_and_prediction(client, auth_headers):
    files = {"file": ("leaf.jpg", _make_jpeg_bytes(), "image/jpeg")}
    upload = await client.post("/api/v1/upload", headers=auth_headers, files=files)
    image_id = upload.json()["image_id"]

    await client.post("/api/v1/predict", headers=auth_headers, json={"image_id": image_id, "top_k": 1})

    response = await client.post(
        "/api/v1/rag/query",
        headers=auth_headers,
        json={"message": "What can you tell me about this leaf?", "image_id": image_id},
    )
    assert response.status_code == 200


async def test_rag_query_rejects_image_owned_by_another_user(client, auth_headers):
    files = {"file": ("leaf.jpg", _make_jpeg_bytes(), "image/jpeg")}
    upload = await client.post("/api/v1/upload", headers=auth_headers, files=files)
    image_id = upload.json()["image_id"]

    await client.post(
        "/api/v1/auth/register",
        json={"email": "intruder@example.com", "password": "Str0ng!Pass", "full_name": "Intruder"},
    )
    login = await client.post(
        "/api/v1/auth/login", json={"email": "intruder@example.com", "password": "Str0ng!Pass"}
    )
    other_headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

    response = await client.post(
        "/api/v1/rag/query",
        headers=other_headers,
        json={"message": "Describe this", "image_id": image_id},
    )
    assert response.status_code == 404


async def test_document_upload_indexes_and_is_retrievable(client, auth_headers):
    files = {"file": ("neem.pdf", _make_pdf_bytes(), "application/pdf")}
    upload = await client.post("/api/v1/documents/upload", headers=auth_headers, files=files)
    assert upload.status_code == 201
    body = upload.json()
    assert body["status"] == "indexed"
    assert body["chunk_count"] >= 1

    query = await client.post(
        "/api/v1/rag/query",
        headers=auth_headers,
        json={"message": "neem indica medicinal", "similarity_threshold": 0.0},
    )
    assert query.status_code == 200
    assert query.json()["retrieval"]["retrieved_chunks"]


async def test_document_upload_rejects_non_pdf(client, auth_headers):
    files = {"file": ("leaf.jpg", _make_jpeg_bytes(), "image/jpeg")}
    response = await client.post("/api/v1/documents/upload", headers=auth_headers, files=files)
    assert response.status_code == 400


async def test_list_documents(client, auth_headers):
    files = {"file": ("neem.pdf", _make_pdf_bytes(), "application/pdf")}
    await client.post("/api/v1/documents/upload", headers=auth_headers, files=files)

    response = await client.get("/api/v1/documents", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["total"] >= 1


async def test_delete_document(client, auth_headers):
    files = {"file": ("neem.pdf", _make_pdf_bytes(), "application/pdf")}
    upload = await client.post("/api/v1/documents/upload", headers=auth_headers, files=files)
    document_id = upload.json()["document_id"]

    response = await client.delete(f"/api/v1/documents/{document_id}", headers=auth_headers)
    assert response.status_code == 204

    listing = await client.get("/api/v1/documents", headers=auth_headers)
    assert all(item["document_id"] != document_id for item in listing.json()["items"])


async def test_rag_status_reports_indexed_documents(client, auth_headers):
    files = {"file": ("neem.pdf", _make_pdf_bytes(), "application/pdf")}
    await client.post("/api/v1/documents/upload", headers=auth_headers, files=files)

    response = await client.get("/api/v1/rag/status", headers=auth_headers)
    assert response.status_code == 200
    body = response.json()
    assert body["indexed_documents"] >= 1
    assert body["total_chunks"] >= 1


async def test_rag_reindex_single_document(client, auth_headers):
    files = {"file": ("neem.pdf", _make_pdf_bytes(), "application/pdf")}
    upload = await client.post("/api/v1/documents/upload", headers=auth_headers, files=files)
    document_id = upload.json()["document_id"]

    response = await client.post(
        "/api/v1/rag/reindex", headers=auth_headers, json={"document_id": document_id}
    )
    assert response.status_code == 200
    body = response.json()
    assert len(body["reindexed"]) == 1
    assert body["reindexed"][0]["status"] == "indexed"
