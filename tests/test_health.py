from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_root_explains_api_entrypoints():
    response = client.get("/")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert response.json()["api_prefix"] == "/api"
    assert response.json()["health"] == "/health"


def test_health_returns_versioned_status():
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert "version" in response.json()
