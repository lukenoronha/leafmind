"""End-to-end tests for /upload, /predict, /history."""

import io

import numpy as np
import pytest
from PIL import Image


def _make_jpeg_bytes(width=300, height=200) -> bytes:
    # Textured (not flat) so it clears the input-validation layer's blur
    # heuristic (app.images.preprocessing.content_validation) — a solid
    # color has near-zero edge variance and would be rejected as "too blurry"
    # despite not representing a real photo's sharpness at all.
    rng = np.random.default_rng(0)
    noise = rng.integers(-20, 20, (height, width, 3))
    image = np.clip(np.full((height, width, 3), (60, 140, 50)) + noise, 0, 255).astype(np.uint8)
    buffer = io.BytesIO()
    Image.fromarray(image, mode="RGB").save(buffer, format="JPEG")
    return buffer.getvalue()


async def _upload(client, auth_headers):
    files = {"file": ("leaf.jpg", _make_jpeg_bytes(), "image/jpeg")}
    return await client.post("/api/v1/upload", headers=auth_headers, files=files)


async def test_upload_persists_image_metadata(client, auth_headers):
    response = await _upload(client, auth_headers)
    assert response.status_code == 201
    body = response.json()
    assert body["original_filename"] == "leaf.jpg"
    assert body["content_type"] == "image/jpeg"
    assert body["size_bytes"] > 0
    assert body["checksum_sha256"]


async def test_upload_requires_authentication(client):
    files = {"file": ("leaf.jpg", _make_jpeg_bytes(), "image/jpeg")}
    response = await client.post("/api/v1/upload", files=files)
    assert response.status_code == 403


async def test_upload_rejects_unsupported_content_type(client, auth_headers):
    files = {"file": ("leaf.txt", b"not an image", "text/plain")}
    response = await client.post("/api/v1/upload", headers=auth_headers, files=files)
    assert response.status_code == 400


async def test_predict_returns_structured_classification(client, auth_headers):
    upload_response = await _upload(client, auth_headers)
    image_id = upload_response.json()["image_id"]

    response = await client.post(
        "/api/v1/predict", headers=auth_headers, json={"image_id": image_id, "top_k": 2}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["predicted_label"] == "Pongamia_pinnata"
    assert 0.0 <= body["confidence"] <= 1.0
    assert len(body["candidates"]) == 2
    assert body["preprocessing_ms"] > 0
    assert body["model_name"] == "fake-qwen2.5-vl"


async def test_predict_unknown_image_returns_404(client, auth_headers):
    response = await client.post(
        "/api/v1/predict",
        headers=auth_headers,
        json={"image_id": "00000000-0000-0000-0000-000000000000", "top_k": 1},
    )
    assert response.status_code == 404


async def test_predict_rejects_another_users_image(client, auth_headers):
    upload_response = await _upload(client, auth_headers)
    image_id = upload_response.json()["image_id"]

    # Second, distinct user.
    await client.post(
        "/api/v1/auth/register",
        json={"email": "other@example.com", "password": "Str0ng!Pass", "full_name": "Other User"},
    )
    login = await client.post(
        "/api/v1/auth/login", json={"email": "other@example.com", "password": "Str0ng!Pass"}
    )
    other_headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

    response = await client.post(
        "/api/v1/predict", headers=other_headers, json={"image_id": image_id, "top_k": 1}
    )
    assert response.status_code == 404


async def test_history_lists_predictions_most_recent_first(client, auth_headers):
    upload_response = await _upload(client, auth_headers)
    image_id = upload_response.json()["image_id"]

    await client.post(
        "/api/v1/predict", headers=auth_headers, json={"image_id": image_id, "top_k": 1}
    )
    await client.post(
        "/api/v1/predict", headers=auth_headers, json={"image_id": image_id, "top_k": 1}
    )

    response = await client.get("/api/v1/history", headers=auth_headers)
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 2
    assert len(body["items"]) == 2
    assert body["items"][0]["predicted_label"] == "Pongamia_pinnata"


async def test_history_is_scoped_per_user(client, auth_headers):
    upload_response = await _upload(client, auth_headers)
    image_id = upload_response.json()["image_id"]
    await client.post(
        "/api/v1/predict", headers=auth_headers, json={"image_id": image_id, "top_k": 1}
    )

    await client.post(
        "/api/v1/auth/register",
        json={"email": "watcher@example.com", "password": "Str0ng!Pass", "full_name": "Watcher"},
    )
    login = await client.post(
        "/api/v1/auth/login", json={"email": "watcher@example.com", "password": "Str0ng!Pass"}
    )
    other_headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

    response = await client.get("/api/v1/history", headers=other_headers)
    assert response.json()["total"] == 0
