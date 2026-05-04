import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
import sys, os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

mock_table = MagicMock()
mock_table.scan.return_value = {"Items": []}
mock_table.put_item.return_value = {}
mock_table.update_item.return_value = {}
mock_table.delete_item.return_value = {}

with patch("db.dynamo.create_all_tables", return_value=None), \
     patch("db.dynamo.get_table", return_value=mock_table):
    from main import app

client = TestClient(app)


def test_root():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_listar_incidentes_vacio():
    with patch("routes.incidents.get_table", return_value=mock_table):
        response = client.get("/incidents/")
        assert response.status_code == 200
        assert isinstance(response.json(), list)


def test_crear_incidente():
    with patch("routes.incidents.get_table", return_value=mock_table):
        payload = {
            "ciudad": "Bucaramanga",
            "zona": "Norte",
            "categoria": "alumbrado",
            "descripcion": "Poste caído en la calle 5",
            "latitud": 7.119349,
            "longitud": -73.122741,
            "prioridad": "alta",
            "usuario": "ciudadano01",
        }
        response = client.post("/incidents/", json=payload)
        assert response.status_code == 201
        assert "id" in response.json()


def test_actualizar_incidente():
    with patch("routes.incidents.get_table", return_value=mock_table):
        response = client.put(
            "/incidents/Bucaramanga%23Norte/2024-01-01T00:00:00%23test-id",
            json={"estado": "resuelto"},
        )
        assert response.status_code == 200


def test_eliminar_incidente():
    with patch("routes.incidents.get_table", return_value=mock_table):
        response = client.delete(
            "/incidents/Bucaramanga%23Norte/2024-01-01T00:00:00%23test-id"
        )
        assert response.status_code == 200