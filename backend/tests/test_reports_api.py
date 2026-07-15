"""End-to-end tests for the Reports API (Sprint 7)."""

import io
import uuid

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


async def _create_prediction(client, auth_headers) -> str:
    files = {"file": ("leaf.jpg", _make_jpeg_bytes(), "image/jpeg")}
    upload = await client.post("/api/v1/upload", headers=auth_headers, files=files)
    image_id = upload.json()["image_id"]

    predict = await client.post(
        "/api/v1/predict", headers=auth_headers, json={"image_id": image_id, "top_k": 1}
    )
    return predict.json()["prediction_id"]


async def test_prediction_report_json_matches_prediction_data(client, auth_headers):
    prediction_id = await _create_prediction(client, auth_headers)

    response = await client.get(
        f"/api/v1/reports/prediction/{prediction_id}", headers=auth_headers
    )
    assert response.status_code == 200
    body = response.json()
    assert body["prediction_id"] == prediction_id
    assert body["predicted_label"]
    assert 0.0 <= body["confidence"] <= 1.0
    assert body["disclaimer"]
    assert isinstance(body["knowledge_available"], bool)
    assert isinstance(body["related_knowledge"], list)


async def test_prediction_report_pdf_returns_valid_pdf_bytes(client, auth_headers):
    prediction_id = await _create_prediction(client, auth_headers)

    response = await client.get(
        f"/api/v1/reports/prediction/{prediction_id}",
        headers=auth_headers,
        params={"format": "pdf"},
    )
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert response.content.startswith(b"%PDF")
    assert len(response.content) > 0


async def test_prediction_report_rejects_other_users_prediction(client, auth_headers):
    prediction_id = await _create_prediction(client, auth_headers)

    await client.post(
        "/api/v1/auth/register",
        json={"email": "report_intruder@example.com", "password": "Str0ng!Pass", "full_name": "Intruder"},
    )
    login = await client.post(
        "/api/v1/auth/login",
        json={"email": "report_intruder@example.com", "password": "Str0ng!Pass"},
    )
    other_headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

    response = await client.get(
        f"/api/v1/reports/prediction/{prediction_id}", headers=other_headers
    )
    assert response.status_code == 404


async def test_prediction_report_unknown_id_404s(client, auth_headers):
    response = await client.get(
        f"/api/v1/reports/prediction/{uuid.uuid4()}", headers=auth_headers
    )
    assert response.status_code == 404


async def test_evaluation_report_json_and_pdf(client, developer_headers, auth_headers):
    await client.post("/api/v1/rag/query", headers=auth_headers, json={"message": "hi"})
    run_response = await client.post("/api/v1/evaluation/rag", headers=developer_headers, json={})
    run_id = run_response.json()["run_id"]

    json_response = await client.get(
        f"/api/v1/reports/evaluation/{run_id}", headers=developer_headers
    )
    assert json_response.status_code == 200
    assert json_response.json()["run_id"] == run_id

    pdf_response = await client.get(
        f"/api/v1/reports/evaluation/{run_id}",
        headers=developer_headers,
        params={"format": "pdf"},
    )
    assert pdf_response.status_code == 200
    assert pdf_response.content.startswith(b"%PDF")


async def test_evaluation_report_rejects_plain_user(client, auth_headers, developer_headers):
    run_response = await client.post("/api/v1/evaluation/rag", headers=developer_headers, json={})
    run_id = run_response.json()["run_id"]

    response = await client.get(
        f"/api/v1/reports/evaluation/{run_id}", headers=auth_headers
    )
    assert response.status_code == 403
