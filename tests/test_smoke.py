"""
Smoke tests that don't require Ollama to be running — they check the
Flask app boots, pages render, and DB-backed routes work.

Run with:  python -m pytest tests/ -v
(from the project root, inside the venv)
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
from app import create_app


@pytest.fixture
def client(tmp_path, monkeypatch):
    from config import config
    monkeypatch.setattr(config, "DB_PATH", tmp_path / "test.db")
    monkeypatch.setattr(config, "INSTANCE_DIR", tmp_path)
    app = create_app()
    app.config["TESTING"] = True
    with app.test_client() as c:
        yield c


def test_landing_page(client):
    resp = client.get("/")
    assert resp.status_code == 200
    assert b"Deva AI" in resp.data


def test_chat_page(client):
    resp = client.get("/chat")
    assert resp.status_code == 200


def test_health_endpoint(client):
    resp = client.get("/api/health")
    assert resp.status_code == 200
    data = resp.get_json()
    assert "ollama" in data


def test_create_and_list_conversation(client):
    resp = client.post("/api/conversations")
    assert resp.status_code == 201
    conv = resp.get_json()
    assert conv["title"] == "New Chat"

    resp = client.get("/api/conversations")
    assert resp.status_code == 200
    assert len(resp.get_json()) == 1


def test_memory_crud(client):
    resp = client.post("/api/memories", json={"content": "Prefers Python"})
    assert resp.status_code == 201
    mem = resp.get_json()

    resp = client.get("/api/memories")
    assert len(resp.get_json()) == 1

    resp = client.patch(f"/api/memories/{mem['id']}", json={"content": "Prefers PHP"})
    assert resp.status_code == 200
    assert resp.get_json()["content"] == "Prefers PHP"

    resp = client.delete(f"/api/memories/{mem['id']}")
    assert resp.status_code == 200


def test_profile_get(client):
    resp = client.get("/api/profile")
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["ai_name"]
    assert data["creator"]


def test_settings_defaults(client):
    resp = client.get("/api/settings")
    assert resp.status_code == 200
    data = resp.get_json()
    assert "ollama_model" in data
