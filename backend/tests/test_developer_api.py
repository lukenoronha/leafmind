"""End-to-end tests for the developer observability API layer."""

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


async def _create_prediction(client, auth_headers) -> str:
    files = {"file": ("leaf.jpg", _make_jpeg_bytes(), "image/jpeg")}
    upload = await client.post("/api/v1/upload", headers=auth_headers, files=files)
    image_id = upload.json()["image_id"]

    predict = await client.post(
        "/api/v1/predict", headers=auth_headers, json={"image_id": image_id, "top_k": 1}
    )
    return predict.json()["prediction_id"], image_id


async def _create_chat_turn(client, auth_headers, *, image_id: str | None = None) -> str:
    payload = {"message": "What plants are toxic to dogs?"}
    if image_id:
        payload["image_id"] = image_id
    response = await client.post("/api/v1/rag/query", headers=auth_headers, json=payload)
    return response.json()["message"]["id"]


async def test_developer_endpoints_reject_plain_user(client, auth_headers):
    response = await client.get("/api/v1/developer/system-status", headers=auth_headers)
    assert response.status_code == 403


async def test_developer_endpoints_require_authentication(client):
    response = await client.get("/api/v1/developer/system-status")
    assert response.status_code == 403


async def test_get_prediction_metadata(client, auth_headers, developer_headers):
    prediction_id, image_id = await _create_prediction(client, auth_headers)

    response = await client.get(
        f"/api/v1/developer/predictions/{prediction_id}/metadata", headers=developer_headers
    )
    assert response.status_code == 200
    body = response.json()
    assert body["prediction_id"] == prediction_id
    assert body["plant_name"]
    assert body["scientific_name"] == body["plant_name"]
    assert body["model_version"]
    assert 0.0 <= body["confidence"] <= 1.0


async def test_list_prediction_metadata(client, auth_headers, developer_headers):
    await _create_prediction(client, auth_headers)

    response = await client.get("/api/v1/developer/predictions", headers=developer_headers)
    assert response.status_code == 200
    body = response.json()
    assert body["total"] >= 1
    assert len(body["items"]) >= 1


async def test_get_prediction_timing(client, auth_headers, developer_headers):
    prediction_id, _ = await _create_prediction(client, auth_headers)

    response = await client.get(
        f"/api/v1/developer/predictions/{prediction_id}/timing", headers=developer_headers
    )
    assert response.status_code == 200
    body = response.json()
    assert body["preprocessing_ms"] >= 0
    assert body["inference_ms"] >= 0
    assert body["total_ms"] == body["preprocessing_ms"] + body["inference_ms"]


async def test_prediction_timing_not_found(client, developer_headers):
    import uuid

    response = await client.get(
        f"/api/v1/developer/predictions/{uuid.uuid4()}/timing", headers=developer_headers
    )
    assert response.status_code == 404


async def test_get_chat_message_timing(client, auth_headers, developer_headers):
    chat_message_id = await _create_chat_turn(client, auth_headers)

    response = await client.get(
        f"/api/v1/developer/chat-messages/{chat_message_id}/timing", headers=developer_headers
    )
    assert response.status_code == 200
    body = response.json()
    assert body["response_generation_ms"] is not None


async def test_get_average_timings(client, auth_headers, developer_headers):
    await _create_prediction(client, auth_headers)
    await _create_chat_turn(client, auth_headers)

    response = await client.get("/api/v1/developer/metrics/timings", headers=developer_headers)
    assert response.status_code == 200
    body = response.json()
    assert body["prediction_count"] >= 1
    assert body["chat_turn_count"] >= 1
    assert body["avg_preprocessing_ms"] is not None
    assert body["avg_retrieval_ms"] is not None


async def test_get_rag_metadata(client, auth_headers, developer_headers):
    chat_message_id = await _create_chat_turn(client, auth_headers)

    response = await client.get(
        f"/api/v1/developer/chat-messages/{chat_message_id}/rag-metadata", headers=developer_headers
    )
    assert response.status_code == 200
    body = response.json()
    assert body["embedding_model"]
    assert isinstance(body["retrieved_sources"], list)


async def test_prompt_inspector_returns_sanitized_view(client, auth_headers, developer_headers):
    prediction_id, image_id = await _create_prediction(client, auth_headers)
    chat_message_id = await _create_chat_turn(client, auth_headers, image_id=image_id)

    response = await client.get(
        f"/api/v1/developer/chat-messages/{chat_message_id}/prompt-inspector",
        headers=developer_headers,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["user_question"] == "What plants are toxic to dogs?"
    assert body["predicted_plant"]
    assert body["generated_response"]
    assert isinstance(body["rendered_messages"], list)
    # No image/binary payloads should leak — every message's content is a plain string.
    assert all(isinstance(m["content"], str) for m in body["rendered_messages"])


async def test_prompt_inspector_not_found_for_unknown_message(client, developer_headers):
    import uuid

    response = await client.get(
        f"/api/v1/developer/chat-messages/{uuid.uuid4()}/prompt-inspector",
        headers=developer_headers,
    )
    assert response.status_code == 404


async def test_get_system_status(client, developer_headers):
    response = await client.get("/api/v1/developer/system-status", headers=developer_headers)
    assert response.status_code == 200
    body = response.json()
    assert body["backend_healthy"] is True
    assert isinstance(body["database_healthy"], bool)
    assert isinstance(body["gpu_available"], bool)
    assert body["cpu_percent"] >= 0
    assert body["memory_total_mb"] > 0
    assert body["disk_total_gb"] > 0


async def test_get_logs(client, developer_headers):
    response = await client.get("/api/v1/developer/logs", headers=developer_headers)
    assert response.status_code == 200
    body = response.json()
    assert "items" in body
    assert "total" in body
    assert body["limit"] == 50
    assert body["offset"] == 0


async def test_get_logs_with_filters(client, developer_headers):
    response = await client.get(
        "/api/v1/developer/logs",
        headers=developer_headers,
        params={"level": "INFO", "search": "test", "limit": 10, "offset": 0},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["limit"] == 10


async def test_get_analytics(client, auth_headers, developer_headers):
    await _create_prediction(client, auth_headers)

    response = await client.get("/api/v1/developer/analytics", headers=developer_headers)
    assert response.status_code == 200
    body = response.json()
    assert body["prediction_count"] >= 1
    assert body["avg_confidence"] is not None
    assert body["avg_inference_ms"] is not None
    assert "indexed_documents" in body
    assert "vector_count" in body
