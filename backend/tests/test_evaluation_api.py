"""End-to-end tests for the Evaluation API (Sprint 7)."""

import json
import uuid


def _seed_fixture_dataset(tmp_path) -> None:
    """Overrides `get_evaluation_service`'s `DATASET_ROOT` fixture, matching
    the `tmp_path / "eval_dataset"` root the `client` fixture's evaluation
    override points at (see conftest.py)."""
    import numpy as np
    from PIL import Image
    import io

    root = tmp_path / "eval_dataset"
    metadata_dir = root / "metadata"
    metadata_dir.mkdir(parents=True)
    (metadata_dir / "classes.json").write_text(
        json.dumps(
            {
                "classes": [
                    {"class_id": 0, "training_label": "Species_A", "folder_name": "Species_A", "status": "active"},
                ]
            }
        ),
        encoding="utf-8",
    )
    class_dir = root / "raw" / "medicinal_leaf_images" / "Species_A"
    class_dir.mkdir(parents=True)
    image = np.full((64, 64, 3), (10, 200, 10), dtype=np.uint8)
    buffer = io.BytesIO()
    Image.fromarray(image, mode="RGB").save(buffer, format="JPEG")
    (class_dir / "img1.jpg").write_bytes(buffer.getvalue())


async def test_evaluation_endpoints_reject_plain_user(client, auth_headers):
    response = await client.post(
        "/api/v1/evaluation/classification", headers=auth_headers, json={}
    )
    assert response.status_code == 403


async def test_run_classification_evaluation(client, developer_headers, tmp_path):
    _seed_fixture_dataset(tmp_path)

    response = await client.post(
        "/api/v1/evaluation/classification",
        headers=developer_headers,
        json={"sample_size_per_class": 1},
    )
    assert response.status_code == 200
    body = response.json()
    assert 0.0 <= body["accuracy"] <= 1.0
    assert body["sample_count"] == 1
    assert body["class_labels"] == ["Species_A"]
    assert len(body["confusion_matrix"]) == 1


async def test_run_rag_evaluation(client, auth_headers, developer_headers):
    await client.post(
        "/api/v1/rag/query", headers=auth_headers, json={"message": "hello"}
    )

    response = await client.post("/api/v1/evaluation/rag", headers=developer_headers, json={})
    assert response.status_code == 200
    body = response.json()
    assert body["sample_count"] >= 1
    assert "context_relevance" in body
    assert "citation_coverage" in body


async def test_list_and_get_run(client, developer_headers, auth_headers):
    await client.post("/api/v1/rag/query", headers=auth_headers, json={"message": "hi"})
    run_response = await client.post("/api/v1/evaluation/rag", headers=developer_headers, json={})
    run_id = run_response.json()["run_id"]

    listing = await client.get("/api/v1/evaluation/runs", headers=developer_headers)
    assert listing.status_code == 200
    assert listing.json()["total"] >= 1

    detail = await client.get(f"/api/v1/evaluation/runs/{run_id}", headers=developer_headers)
    assert detail.status_code == 200
    assert detail.json()["run_id"] == run_id
    assert detail.json()["run_type"] == "rag"


async def test_get_unknown_run_404s(client, developer_headers):
    response = await client.get(
        f"/api/v1/evaluation/runs/{uuid.uuid4()}", headers=developer_headers
    )
    assert response.status_code == 404
