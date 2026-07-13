"""End-to-end tests for the Sprint 2 authentication API."""

import pytest

VALID_PASSWORD = "Str0ng!Pass"


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
