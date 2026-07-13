"""End-to-end tests for the temporary VLM-only /chat endpoint."""

import io

import numpy as np
from PIL import Image


def _make_jpeg_bytes() -> bytes:
    image = np.full((200, 300, 3), (60, 140, 50), dtype=np.uint8)
    buffer = io.BytesIO()
    Image.fromarray(image, mode="RGB").save(buffer, format="JPEG")
    return buffer.getvalue()


async def test_chat_without_image_starts_new_conversation(client, auth_headers):
    response = await client.post(
        "/api/v1/chat", headers=auth_headers, json={"message": "What plants are toxic to dogs?"}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["conversation_id"]
    assert body["message"]["role"] == "assistant"
    assert body["message"]["content"]


async def test_chat_requires_authentication(client):
    response = await client.post("/api/v1/chat", json={"message": "hello"})
    assert response.status_code == 403


async def test_chat_continues_existing_conversation(client, auth_headers):
    first = await client.post(
        "/api/v1/chat", headers=auth_headers, json={"message": "Hello"}
    )
    conversation_id = first.json()["conversation_id"]

    second = await client.post(
        "/api/v1/chat",
        headers=auth_headers,
        json={"message": "Tell me more", "conversation_id": conversation_id},
    )
    assert second.status_code == 200
    assert second.json()["conversation_id"] == conversation_id


async def test_chat_grounds_response_in_uploaded_image_and_prediction(client, auth_headers):
    files = {"file": ("leaf.jpg", _make_jpeg_bytes(), "image/jpeg")}
    upload = await client.post("/api/v1/upload", headers=auth_headers, files=files)
    image_id = upload.json()["image_id"]

    await client.post(
        "/api/v1/predict", headers=auth_headers, json={"image_id": image_id, "top_k": 1}
    )

    response = await client.post(
        "/api/v1/chat",
        headers=auth_headers,
        json={"message": "What can you tell me about this leaf?", "image_id": image_id},
    )
    assert response.status_code == 200


async def test_chat_rejects_image_owned_by_another_user(client, auth_headers):
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
        "/api/v1/chat",
        headers=other_headers,
        json={"message": "Describe this", "image_id": image_id},
    )
    assert response.status_code == 404
