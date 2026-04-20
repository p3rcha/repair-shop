from decimal import Decimal

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session as DBSession

from app.models import Category, Item


def _seed_one_item(db: DBSession) -> int:
    cat = Category(name="Oil Change", slug="oil-change", icon="OilIcon")
    db.add(cat)
    db.flush()
    item = Item(category_id=cat.id, name="Conventional Oil Change", base_price=Decimal("39.99"))
    db.add(item)
    db.commit()
    db.refresh(item)
    return item.id


def test_login_then_list_empty(client: TestClient) -> None:
    res = client.post(
        "/auth/register",
        json={"username": "alice", "password": "secret123"},
    )
    assert res.status_code == 201

    res = client.post("/auth/logout")
    assert res.status_code == 204

    res = client.post(
        "/auth/login",
        json={"username": "alice", "password": "secret123"},
    )
    assert res.status_code == 200
    assert res.json()["username"] == "alice"

    res = client.get("/estimates")
    assert res.status_code == 200
    body = res.json()
    assert body == {"items": [], "total": 0, "limit": 20, "offset": 0}


def test_create_then_filter_by_status(auth_client: TestClient, db: DBSession) -> None:
    item_id = _seed_one_item(db)

    res = auth_client.post(
        "/estimates",
        json={
            "customer_name": "Jane Doe",
            "vehicle_make": "Toyota",
            "vehicle_model": "Corolla",
            "vehicle_year": 2018,
            "license_plate": "ABC-123",
            "items": [{"item_id": item_id, "quantity": 2}],
        },
    )
    assert res.status_code == 201, res.text
    created = res.json()
    assert created["status"] == "pending"
    assert Decimal(created["total"]) == Decimal("79.98")

    res = auth_client.get("/estimates?status=pending")
    assert res.status_code == 200
    body = res.json()
    assert body["total"] == 1
    ids = [e["id"] for e in body["items"]]
    assert created["id"] in ids

    res = auth_client.get("/estimates?status=completed")
    assert res.status_code == 200
    body = res.json()
    assert body["total"] == 0
    assert body["items"] == []


def test_unauthenticated_returns_401(client: TestClient) -> None:
    res = client.get("/estimates")
    assert res.status_code == 401
