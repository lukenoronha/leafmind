"""End-to-end validation of the full LeafMind pipeline (Sprint 7):
image upload -> preprocessing -> Qwen2.5-VL inference -> ChromaDB retrieval
-> prompt construction -> grounded response generation -> history storage ->
report generation.

Built entirely on the existing fake VLM/embedding/vector-store doubles (see
tests/fakes.py, wired in conftest.py's `client` fixture), so this exercises
every real code path (routers, services, ORM persistence, retrieval ranking,
prompt building) without requiring real model weights or a GPU.
"""

import io

import numpy as np
from PIL import Image


def _make_jpeg_bytes() -> bytes:
    image = np.full((200, 300, 3), (60, 140, 50), dtype=np.uint8)
    buffer = io.BytesIO()
    Image.fromarray(image, mode="RGB").save(buffer, format="JPEG")
    return buffer.getvalue()


def _make_pdf_bytes(text: str) -> bytes:
    import fitz

    document = fitz.open()
    page = document.new_page()
    page.insert_text((72, 72), text)
    pdf_bytes = document.tobytes()
    document.close()
    return pdf_bytes


async def test_full_pipeline_upload_to_report(client, auth_headers, developer_headers):
    # 1. Upload a leaf image.
    files = {"file": ("leaf.jpg", _make_jpeg_bytes(), "image/jpeg")}
    upload = await client.post("/api/v1/upload", headers=auth_headers, files=files)
    assert upload.status_code == 201
    image_id = upload.json()["image_id"]

    # 2. Preprocess + classify (Qwen2.5-VL, faked).
    predict = await client.post(
        "/api/v1/predict", headers=auth_headers, json={"image_id": image_id, "top_k": 2}
    )
    assert predict.status_code == 200
    prediction_body = predict.json()
    prediction_id = prediction_body["prediction_id"]
    predicted_label = prediction_body["predicted_label"]
    assert prediction_body["preprocessing_ms"] >= 0
    assert prediction_body["inference_ms"] >= 0

    # 3. Upload a PDF document into the knowledge base (PyMuPDF extraction +
    # chunking + fake embedding + fake vector store upsert).
    pdf_text = f"{predicted_label} is used in traditional medicine for its antiseptic properties."
    doc_files = {"file": ("reference.pdf", _make_pdf_bytes(pdf_text), "application/pdf")}
    doc_upload = await client.post(
        "/api/v1/documents/upload", headers=auth_headers, files=doc_files
    )
    assert doc_upload.status_code == 201
    assert doc_upload.json()["status"] == "indexed"
    assert doc_upload.json()["chunk_count"] >= 1

    # 4. RAG query grounded in the uploaded image's prediction and the
    # uploaded document (retrieval -> prompt construction -> generation).
    query = await client.post(
        "/api/v1/rag/query",
        headers=auth_headers,
        json={
            "message": f"What is {predicted_label} used for?",
            "image_id": image_id,
            "similarity_threshold": 0.0,
        },
    )
    assert query.status_code == 200
    query_body = query.json()
    chat_message_id = query_body["message"]["id"]
    assert query_body["retrieval"]["retrieved_chunks"]
    assert query_body["message"]["content"]

    # 5. Verify retrieval metadata was actually persisted (history storage),
    # not just returned inline, via the Developer observability API.
    rag_metadata = await client.get(
        f"/api/v1/developer/chat-messages/{chat_message_id}/rag-metadata",
        headers=developer_headers,
    )
    assert rag_metadata.status_code == 200
    metadata_body = rag_metadata.json()
    assert metadata_body["retrieved_chunk_count"] >= 1
    assert metadata_body["retrieved_sources"]
    assert metadata_body["retrieved_sources"][0]["document_name"] == "reference.pdf"

    timing = await client.get(
        f"/api/v1/developer/chat-messages/{chat_message_id}/timing", headers=developer_headers
    )
    assert timing.status_code == 200
    assert timing.json()["retrieval_ms"] is not None

    # 6. Generate a prediction report (JSON) and confirm its content matches
    # what was persisted in steps 2-3.
    report = await client.get(
        f"/api/v1/reports/prediction/{prediction_id}", headers=auth_headers
    )
    assert report.status_code == 200
    report_body = report.json()
    assert report_body["prediction_id"] == prediction_id
    assert report_body["predicted_label"] == predicted_label
    assert report_body["confidence"] == prediction_body["confidence"]

    # 7. Confirm the PDF variant of the same report also renders.
    pdf_report = await client.get(
        f"/api/v1/reports/prediction/{prediction_id}",
        headers=auth_headers,
        params={"format": "pdf"},
    )
    assert pdf_report.status_code == 200
    assert pdf_report.content.startswith(b"%PDF")
