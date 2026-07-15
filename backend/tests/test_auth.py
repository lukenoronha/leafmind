"""End-to-end tests for the Sprint 2 authentication API."""

import io

import numpy as np
import pytest
from PIL import Image

VALID_PASSWORD = "Str0ng!Pass"


def _make_jpeg_bytes(width=64, height=64) -> bytes:
    image = np.full((height, width, 3), (200, 120, 60), dtype=np.uint8)
    buffer = io.BytesIO()
    Image.fromarray(image, mode="RGB").save(buffer, format="JPEG")
    return buffer.getvalue()


async def _register(client, email="alice@example.com", password=VALID_PASSWORD):
    return await client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": password, "full_name": "Alice Example"},
    )


async def _login(client, email="alice@example.com", password=VALID_PASSWORD):
    return await client.post("/api/v1/auth/login", json={"email": email, "password": password})


async def test_register_creates_user_with_default_role(client):
    response = await _register(client)
    assert response.status_code == 201
    body = response.json()
    assert body["email"] == "alice@example.com"
    assert body["role"]["name"] == "user"
    assert "hashed_password" not in body


async def test_register_duplicate_email_rejected(client):
    await _register(client)
    response = await _register(client)
    assert response.status_code == 409


async def test_register_rejects_weak_password(client):
    response = await _register(client, password="weak")
    assert response.status_code == 422


async def test_login_success_returns_token_pair(client):
    await _register(client)
    response = await _login(client)
    assert response.status_code == 200
    body = response.json()
    assert body["access_token"]
    assert body["refresh_token"]
    assert body["token_type"] == "bearer"


async def test_login_wrong_password_rejected(client):
    await _register(client)
    response = await _login(client, password="WrongPass1!")
    assert response.status_code == 401


async def test_me_requires_valid_bearer_token(client):
    await _register(client)
    tokens = (await _login(client)).json()

    response = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {tokens['access_token']}"},
    )
    assert response.status_code == 200
    assert response.json()["email"] == "alice@example.com"


async def test_me_rejects_missing_token(client):
    response = await client.get("/api/v1/auth/me")
    assert response.status_code == 403  # HTTPBearer default rejection


async def test_me_rejects_garbage_token(client):
    response = await client.get(
        "/api/v1/auth/me", headers={"Authorization": "Bearer not-a-real-token"}
    )
    assert response.status_code == 401


async def test_refresh_rotates_token_and_old_one_is_invalid(client):
    await _register(client)
    tokens = (await _login(client)).json()

    refreshed = await client.post(
        "/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]}
    )
    assert refreshed.status_code == 200
    new_tokens = refreshed.json()
    assert new_tokens["refresh_token"] != tokens["refresh_token"]

    reuse_attempt = await client.post(
        "/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]}
    )
    assert reuse_attempt.status_code == 401


async def test_logout_revokes_refresh_token(client):
    await _register(client)
    tokens = (await _login(client)).json()

    logout_response = await client.post(
        "/api/v1/auth/logout", json={"refresh_token": tokens["refresh_token"]}
    )
    assert logout_response.status_code == 200

    refresh_attempt = await client.post(
        "/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]}
    )
    assert refresh_attempt.status_code == 401


async def test_change_password_then_old_password_login_fails(client):
    await _register(client)
    tokens = (await _login(client)).json()
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}

    change_response = await client.put(
        "/api/v1/auth/change-password",
        json={"current_password": VALID_PASSWORD, "password": "NewStr0ng!Pass"},
        headers=headers,
    )
    assert change_response.status_code == 200

    old_login = await _login(client)
    assert old_login.status_code == 401

    new_login = await _login(client, password="NewStr0ng!Pass")
    assert new_login.status_code == 200


async def test_change_password_revokes_existing_refresh_tokens(client):
    await _register(client)
    tokens = (await _login(client)).json()
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}

    await client.put(
        "/api/v1/auth/change-password",
        json={"current_password": VALID_PASSWORD, "password": "NewStr0ng!Pass"},
        headers=headers,
    )

    refresh_attempt = await client.post(
        "/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]}
    )
    assert refresh_attempt.status_code == 401


async def test_change_password_wrong_current_password_rejected(client):
    await _register(client)
    tokens = (await _login(client)).json()
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}

    response = await client.put(
        "/api/v1/auth/change-password",
        json={"current_password": "WrongOne1!", "password": "NewStr0ng!Pass"},
        headers=headers,
    )
    assert response.status_code == 401


async def test_me_has_no_avatar_by_default(client):
    await _register(client)
    tokens = (await _login(client)).json()
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}

    response = await client.get("/api/v1/auth/me", headers=headers)
    assert response.json()["avatar_url"] is None


async def test_update_profile_changes_full_name(client):
    await _register(client)
    tokens = (await _login(client)).json()
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}

    response = await client.patch(
        "/api/v1/auth/me", json={"full_name": "Alice Updated"}, headers=headers
    )
    assert response.status_code == 200
    assert response.json()["full_name"] == "Alice Updated"

    me_response = await client.get("/api/v1/auth/me", headers=headers)
    assert me_response.json()["full_name"] == "Alice Updated"


async def test_update_profile_requires_authentication(client):
    response = await client.patch("/api/v1/auth/me", json={"full_name": "Nobody"})
    assert response.status_code in (401, 403)


async def test_upload_avatar_sets_avatar_url(client):
    await _register(client)
    tokens = (await _login(client)).json()
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}

    files = {"file": ("avatar.jpg", _make_jpeg_bytes(), "image/jpeg")}
    response = await client.post("/api/v1/auth/me/avatar", headers=headers, files=files)
    assert response.status_code == 200
    body = response.json()
    assert body["avatar_url"] is not None
    assert "/static/avatars/" in body["avatar_url"]

    me_response = await client.get("/api/v1/auth/me", headers=headers)
    assert me_response.json()["avatar_url"] == body["avatar_url"]


async def test_upload_avatar_replaces_previous_one(client):
    await _register(client)
    tokens = (await _login(client)).json()
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}

    first = await client.post(
        "/api/v1/auth/me/avatar",
        headers=headers,
        files={"file": ("first.jpg", _make_jpeg_bytes(), "image/jpeg")},
    )
    second = await client.post(
        "/api/v1/auth/me/avatar",
        headers=headers,
        files={"file": ("second.jpg", _make_jpeg_bytes(), "image/jpeg")},
    )
    assert first.json()["avatar_url"] != second.json()["avatar_url"]


async def test_upload_avatar_rejects_unsupported_content_type(client):
    await _register(client)
    tokens = (await _login(client)).json()
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}

    response = await client.post(
        "/api/v1/auth/me/avatar",
        headers=headers,
        files={"file": ("avatar.txt", b"not an image", "text/plain")},
    )
    assert response.status_code == 400


async def test_upload_avatar_requires_authentication(client):
    files = {"file": ("avatar.jpg", _make_jpeg_bytes(), "image/jpeg")}
    response = await client.post("/api/v1/auth/me/avatar", files=files)
    assert response.status_code in (401, 403)
