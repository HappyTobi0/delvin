import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.store import store

client = TestClient(app)


@pytest.fixture(autouse=True)
def _clear_store():
    store.clear()
    yield
    store.clear()


def test_list_empty():
    response = client.get("/vendors")
    assert response.status_code == 200
    assert response.json() == []


def test_create_vendor_defaults_to_pending():
    response = client.post(
        "/vendors",
        json={
            "name": "Acme Staffing",
            "category": "Staffing Agency",
            "contact_email": "hire@acme.com",
        },
    )
    assert response.status_code == 201
    body = response.json()
    assert body["id"] == 1
    assert body["status"] == "Pending Approval"

    assert client.get("/vendors").json() == [body]


def test_invalid_category_rejected():
    response = client.post(
        "/vendors",
        json={
            "name": "Acme",
            "category": "Bakery",
            "contact_email": "hire@acme.com",
        },
    )
    assert response.status_code == 422


def test_invalid_email_rejected():
    response = client.post(
        "/vendors",
        json={"name": "Acme", "category": "Consultant", "contact_email": "not-an-email"},
    )
    assert response.status_code == 422
