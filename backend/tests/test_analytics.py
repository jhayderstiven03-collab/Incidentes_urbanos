import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
import sys, os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from main import app

client = TestClient(app)

mock_table = MagicMock()
mock_table.scan.return_value = {"Items": []}

def test_analytics_summary():
    with patch("routes.analytics.get_table", return_value=mock_table):
        response = client.get("/analytics/summary")
        assert response.status_code == 200
        data = response.json()
        assert "total" in data
        assert "categories" in data
        assert "priorities" in data
        assert "zones" in data

def test_analytics_zones():
    with patch("routes.analytics.get_table", return_value=mock_table):
        response = client.get("/analytics/zones")
        assert response.status_code == 200
        assert isinstance(response.json(), dict)

def test_analytics_categories():
    with patch("routes.analytics.get_table", return_value=mock_table):
        response = client.get("/analytics/categories")
        assert response.status_code == 200
        assert isinstance(response.json(), dict)

def test_analytics_priorities():
    with patch("routes.analytics.get_table", return_value=mock_table):
        response = client.get("/analytics/priorities")
        assert response.status_code == 200
        assert isinstance(response.json(), dict)
