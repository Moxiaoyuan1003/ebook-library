import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_ai_config_endpoint():
    response = client.get("/api/ai/config")
    assert response.status_code == 200
