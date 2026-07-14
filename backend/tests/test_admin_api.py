"""End-to-end tests for the admin API layer (Sprint 6, wired up in Sprint 7)."""

import io

import numpy as np
from PIL import Image


def _make_jpeg_bytes() -> bytes:
    image = np.full((200, 300, 3), (60, 140, 50), dtype=np.uint8)
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


# --- Role-gating: every admin router rejects plain users and developers ---


async def test_admin_endpoints_reject_unauthenticated(client):
    response = await client.get("/api/v1/admin/users")
    assert response.status_code == 403


async def test_admin_endpoints_reject_plain_user(client, auth_headers):
    response = await client.get("/api/v1/admin/users", headers=auth_headers)
    assert response.status_code == 403


async def test_admin_endpoints_reject_developer_role(client, developer_headers):
    response = await client.get("/api/v1/admin/users", headers=developer_headers)
    assert response.status_code == 403


# --- User management ---


async def test_list_users(client, admin_headers):
    response = await client.get("/api/v1/admin/users", headers=admin_headers)
    assert response.status_code == 200
    body = response.json()
    assert body["total"] >= 1
    assert any(u["email"] == "admin_tester@example.com" for u in body["items"])


async def test_get_and_update_user(client, admin_headers, auth_headers):
    users = await client.get("/api/v1/admin/users", headers=admin_headers)
    target = next(u for u in users.json()["items"] if u["email"] == "leaf_tester@example.com")

    detail = await client.get(f"/api/v1/admin/users/{target['id']}", headers=admin_headers)
    assert detail.status_code == 200

    updated = await client.patch(
        f"/api/v1/admin/users/{target['id']}",
        headers=admin_headers,
        json={"full_name": "Updated Name"},
    )
    assert updated.status_code == 200
    assert updated.json()["full_name"] == "Updated Name"


async def test_deactivate_and_reactivate_user(client, admin_headers, auth_headers):
    users = await client.get("/api/v1/admin/users", headers=admin_headers)
    target = next(u for u in users.json()["items"] if u["email"] == "leaf_tester@example.com")

    deactivated = await client.patch(
        f"/api/v1/admin/users/{target['id']}/active",
        headers=admin_headers,
        json={"is_active": False},
    )
    assert deactivated.status_code == 200
    assert deactivated.json()["is_active"] is False

    reactivated = await client.patch(
        f"/api/v1/admin/users/{target['id']}/active",
        headers=admin_headers,
        json={"is_active": True},
    )
    assert reactivated.status_code == 200
    assert reactivated.json()["is_active"] is True


async def test_admin_cannot_deactivate_self(client, admin_headers):
    users = await client.get("/api/v1/admin/users", headers=admin_headers)
    self_user = next(u for u in users.json()["items"] if u["email"] == "admin_tester@example.com")

    response = await client.patch(
        f"/api/v1/admin/users/{self_user['id']}/active",
        headers=admin_headers,
        json={"is_active": False},
    )
    assert response.status_code == 400


async def test_reset_user_password(client, admin_headers, auth_headers):
    users = await client.get("/api/v1/admin/users", headers=admin_headers)
    target = next(u for u in users.json()["items"] if u["email"] == "leaf_tester@example.com")

    response = await client.post(
        f"/api/v1/admin/users/{target['id']}/reset-password",
        headers=admin_headers,
        json={"new_password": "NewStr0ng!Pass"},
    )
    assert response.status_code == 200


async def test_delete_user_is_soft_delete(client, admin_headers, auth_headers):
    users = await client.get("/api/v1/admin/users", headers=admin_headers)
    target = next(u for u in users.json()["items"] if u["email"] == "leaf_tester@example.com")

    response = await client.delete(f"/api/v1/admin/users/{target['id']}", headers=admin_headers)
    assert response.status_code == 200

    detail = await client.get(f"/api/v1/admin/users/{target['id']}", headers=admin_headers)
    assert detail.json()["is_active"] is False


# --- Dataset management ---


async def test_dataset_statistics_and_list(client, admin_headers):
    stats = await client.get("/api/v1/admin/datasets/statistics", headers=admin_headers)
    assert stats.status_code == 200
    assert "total_classes" in stats.json()

    listing = await client.get("/api/v1/admin/datasets", headers=admin_headers)
    assert listing.status_code == 200


async def test_dataset_upload_and_delete_class(client, admin_headers):
    files = [("files", ("leaf1.jpg", _make_jpeg_bytes(), "image/jpeg"))]
    upload = await client.post(
        "/api/v1/admin/datasets/upload",
        headers=admin_headers,
        data={"training_label": "Test_species", "folder_name": "Test_species"},
        files=files,
    )
    assert upload.status_code == 200
    class_id = upload.json()["class_id"]

    response = await client.delete(f"/api/v1/admin/datasets/{class_id}", headers=admin_headers)
    assert response.status_code == 200


# --- Knowledge base admin ---


async def test_knowledge_base_upload_list_detail_delete(client, admin_headers):
    files = {"file": ("neem.pdf", _make_pdf_bytes(), "application/pdf")}
    upload = await client.post(
        "/api/v1/admin/knowledge-base/documents", headers=admin_headers, files=files
    )
    assert upload.status_code == 201
    document_id = upload.json()["document_id"]

    listing = await client.get("/api/v1/admin/knowledge-base/documents", headers=admin_headers)
    assert listing.status_code == 200
    assert listing.json()["total"] >= 1

    detail = await client.get(
        f"/api/v1/admin/knowledge-base/documents/{document_id}", headers=admin_headers
    )
    assert detail.status_code == 200
    assert detail.json()["document"]["document_id"] == document_id

    status_resp = await client.get("/api/v1/admin/knowledge-base/status", headers=admin_headers)
    assert status_resp.status_code == 200

    delete_resp = await client.delete(
        f"/api/v1/admin/knowledge-base/documents/{document_id}", headers=admin_headers
    )
    assert delete_resp.status_code == 204


async def test_knowledge_base_reindex(client, admin_headers):
    files = {"file": ("neem.pdf", _make_pdf_bytes(), "application/pdf")}
    upload = await client.post(
        "/api/v1/admin/knowledge-base/documents", headers=admin_headers, files=files
    )
    document_id = upload.json()["document_id"]

    response = await client.post(
        "/api/v1/admin/knowledge-base/reindex",
        headers=admin_headers,
        json={"document_id": document_id},
    )
    assert response.status_code == 200
    assert response.json()["reindexed_count"] == 1


# --- Embedding management ---


async def test_embedding_statistics_and_rebuild_and_clear(client, admin_headers):
    stats = await client.get("/api/v1/admin/embeddings/statistics", headers=admin_headers)
    assert stats.status_code == 200
    assert "vector_count" in stats.json()

    rebuild = await client.post("/api/v1/admin/embeddings/rebuild", headers=admin_headers)
    assert rebuild.status_code == 200

    clear = await client.post("/api/v1/admin/embeddings/clear", headers=admin_headers)
    assert clear.status_code == 200
    assert clear.json()["vector_count"] == 0


# --- Settings management ---


async def test_settings_list_update_reset(client, admin_headers):
    listing = await client.get("/api/v1/admin/settings", headers=admin_headers)
    assert listing.status_code == 200
    assert len(listing.json()["items"]) >= 1

    updated = await client.put(
        "/api/v1/admin/settings/rag_top_k", headers=admin_headers, json={"value": "10"}
    )
    assert updated.status_code == 200
    assert updated.json()["value"] == 10
    assert updated.json()["is_overridden"] is True

    reset = await client.delete("/api/v1/admin/settings/rag_top_k", headers=admin_headers)
    assert reset.status_code == 200
    assert reset.json()["is_overridden"] is False


async def test_settings_unknown_key_404s(client, admin_headers):
    response = await client.get("/api/v1/admin/settings/not_a_real_key", headers=admin_headers)
    assert response.status_code == 404


# --- System monitoring ---


async def test_monitoring_status(client, admin_headers):
    response = await client.get("/api/v1/admin/monitoring/status", headers=admin_headers)
    assert response.status_code == 200
    body = response.json()
    assert body["backend_healthy"] is True
    assert body["uptime_seconds"] >= 0
    assert "avg_request_latency_ms" in body
    assert "p95_request_latency_ms" in body


# --- Activity log ---


async def test_activity_log_lists_recorded_actions(client, admin_headers):
    await client.put(
        "/api/v1/admin/settings/rag_top_k", headers=admin_headers, json={"value": "7"}
    )

    response = await client.get("/api/v1/admin/activity-log", headers=admin_headers)
    assert response.status_code == 200
    body = response.json()
    assert body["total"] >= 1
    assert any(item["action"] == "settings.update" for item in body["items"])


async def test_activity_log_export_csv(client, admin_headers):
    response = await client.get("/api/v1/admin/activity-log/export", headers=admin_headers)
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/csv")
    assert "timestamp" in response.text
