import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_analytics_summary():
    response = client.get("/analytics/summary")
    assert response.status_code == 200
    data = response.json()
    assert "total" in data
    assert "categories" in data
    assert "priorities" in data
    assert "zones" in data

def test_analytics_zones():
    response = client.get("/analytics/zones")
    assert response.status_code == 200
    assert isinstance(response.json(), dict)

def test_analytics_categories():
    response = client.get("/analytics/categories")
    assert response.status_code == 200
    assert isinstance(response.json(), dict)

def test_analytics_priorities():
    response = client.get("/analytics/priorities")
    assert response.status_code == 200
    assert isinstance(response.json(), dict)
