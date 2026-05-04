import uuid as uuid_mod

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from sqlalchemy.types import CHAR, TypeDecorator

from app.core.database import Base, get_db

# Import ALL models to register them in Base.metadata


class SQLiteUUID(TypeDecorator):
    """Platform-independent UUID type for SQLite testing."""

    impl = CHAR(36)
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is not None:
            return str(value)
        return value

    def process_result_value(self, value, dialect):
        if value is not None:
            return uuid_mod.UUID(value)
        return value


def _patch_uuid_columns_for_sqlite():
    """Replace PostgreSQL UUID columns with SQLite-compatible CHAR(36)."""
    for table in Base.metadata.tables.values():
        for column in table.columns:
            if isinstance(column.type, PG_UUID):
                column.type = SQLiteUUID()
            elif isinstance(column.type, CHAR) and not isinstance(column.type, SQLiteUUID):
                if hasattr(column.type, "length") and column.type.length == 36:
                    column.type = SQLiteUUID()


# Patch BEFORE any create_all call
_patch_uuid_columns_for_sqlite()

from app.main import app  # noqa: E402

# Use StaticPool so all connections share the same in-memory database
test_engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)

Base.metadata.create_all(test_engine)

TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


def _override_get_db():
    db = TestSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = _override_get_db

client = TestClient(app)


# ── Helper to create a card and return its JSON ──


def _create_card(title="Test Card", content="Some content", card_type="note", **kwargs):
    payload = {"title": title, "content": content, "card_type": card_type, **kwargs}
    resp = client.post("/api/knowledge-cards/", json=payload)
    assert resp.status_code == 200, resp.text
    return resp.json()


# ── CRUD Tests ──


def test_create_knowledge_card():
    resp = client.post(
        "/api/knowledge-cards/",
        json={
            "title": "My Card",
            "content": "Card body here",
            "card_type": "concept",
            "tags": ["python", "fastapi"],
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["title"] == "My Card"
    assert data["content"] == "Card body here"
    assert data["card_type"] == "concept"
    assert data["tags"] == ["python", "fastapi"]
    assert "id" in data
    assert "created_at" in data
    assert "updated_at" in data


def test_create_card_defaults():
    resp = client.post(
        "/api/knowledge-cards/",
        json={
            "title": "Defaults",
            "content": "Body",
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["card_type"] == "note"
    assert data["tags"] is None


def test_get_knowledge_card():
    card = _create_card(title="Fetch Me", content="Hello")
    resp = client.get(f"/api/knowledge-cards/{card['id']}")
    assert resp.status_code == 200
    assert resp.json()["title"] == "Fetch Me"


def test_get_card_not_found():
    fake_id = str(uuid_mod.uuid4())
    resp = client.get(f"/api/knowledge-cards/{fake_id}")
    assert resp.status_code == 404


def test_list_knowledge_cards():
    _create_card(title="Card A", content="A")
    _create_card(title="Card B", content="B")
    resp = client.get("/api/knowledge-cards/")
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
    assert "total" in data
    assert "page" in data
    assert "page_size" in data
    assert data["total"] >= 2


def test_list_cards_pagination():
    # Create 5 cards
    for i in range(5):
        _create_card(title=f"Page Card {i}", content=f"Content {i}")
    # Get page 1 with page_size=2
    resp = client.get("/api/knowledge-cards/", params={"page": 1, "page_size": 2})
    data = resp.json()
    assert len(data["items"]) == 2
    assert data["page"] == 1
    assert data["page_size"] == 2
    assert data["total"] >= 5


def test_list_cards_filter_by_type():
    _create_card(title="Concept Card", content="C", card_type="concept")
    _create_card(title="Note Card", content="N", card_type="note")
    resp = client.get("/api/knowledge-cards/", params={"card_type": "concept"})
    data = resp.json()
    assert all(item["card_type"] == "concept" for item in data["items"])


def test_list_cards_search():
    _create_card(title="Quantum Physics", content="Wave-particle duality")
    _create_card(title="Cooking Recipe", content="Pasta carbonara")
    resp = client.get("/api/knowledge-cards/", params={"search": "Quantum"})
    data = resp.json()
    assert any("Quantum" in item["title"] for item in data["items"])


def test_update_knowledge_card():
    card = _create_card(title="Original", content="Original content")
    resp = client.put(
        f"/api/knowledge-cards/{card['id']}",
        json={
            "title": "Updated Title",
            "annotation": "New annotation",
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["title"] == "Updated Title"
    assert data["annotation"] == "New annotation"
    # Content should remain unchanged
    assert data["content"] == "Original content"


def test_update_card_not_found():
    fake_id = str(uuid_mod.uuid4())
    resp = client.put(f"/api/knowledge-cards/{fake_id}", json={"title": "Nope"})
    assert resp.status_code == 404


def test_delete_knowledge_card():
    card = _create_card(title="Delete Me", content="Bye")
    resp = client.delete(f"/api/knowledge-cards/{card['id']}")
    assert resp.status_code == 200
    assert resp.json()["status"] == "deleted"
    # Verify it's gone
    resp = client.get(f"/api/knowledge-cards/{card['id']}")
    assert resp.status_code == 404


def test_delete_card_not_found():
    fake_id = str(uuid_mod.uuid4())
    resp = client.delete(f"/api/knowledge-cards/{fake_id}")
    assert resp.status_code == 404


# ── Card Link Tests ──


def test_create_card_link():
    card_a = _create_card(title="Card A", content="A")
    card_b = _create_card(title="Card B", content="B")
    resp = client.post(
        f"/api/knowledge-cards/{card_a['id']}/links",
        json={
            "target_card_id": card_b["id"],
            "link_type": "related",
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["source_card_id"] == card_a["id"]
    assert data["target_card_id"] == card_b["id"]
    assert data["link_type"] == "related"


def test_create_link_default_type():
    card_a = _create_card(title="Src", content="S")
    card_b = _create_card(title="Tgt", content="T")
    resp = client.post(
        f"/api/knowledge-cards/{card_a['id']}/links",
        json={
            "target_card_id": card_b["id"],
        },
    )
    assert resp.status_code == 200
    assert resp.json()["link_type"] == "related"


def test_create_link_source_not_found():
    fake_id = str(uuid_mod.uuid4())
    card_b = _create_card(title="Real", content="R")
    resp = client.post(
        f"/api/knowledge-cards/{fake_id}/links",
        json={
            "target_card_id": card_b["id"],
        },
    )
    assert resp.status_code == 404


def test_create_link_target_not_found():
    card_a = _create_card(title="Real", content="R")
    fake_id = str(uuid_mod.uuid4())
    resp = client.post(
        f"/api/knowledge-cards/{card_a['id']}/links",
        json={
            "target_card_id": fake_id,
        },
    )
    assert resp.status_code == 404


def test_list_card_links():
    card_a = _create_card(title="A", content="A")
    card_b = _create_card(title="B", content="B")
    card_c = _create_card(title="C", content="C")
    # Create links: A->B, A->C
    client.post(
        f"/api/knowledge-cards/{card_a['id']}/links",
        json={
            "target_card_id": card_b["id"],
        },
    )
    client.post(
        f"/api/knowledge-cards/{card_a['id']}/links",
        json={
            "target_card_id": card_c["id"],
        },
    )
    resp = client.get(f"/api/knowledge-cards/{card_a['id']}/links")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 2


def test_list_links_not_found():
    fake_id = str(uuid_mod.uuid4())
    resp = client.get(f"/api/knowledge-cards/{fake_id}/links")
    assert resp.status_code == 404


def test_delete_card_link():
    card_a = _create_card(title="DA", content="DA")
    card_b = _create_card(title="DB", content="DB")
    link_resp = client.post(
        f"/api/knowledge-cards/{card_a['id']}/links",
        json={
            "target_card_id": card_b["id"],
        },
    )
    link_id = link_resp.json()["id"]
    resp = client.delete(f"/api/knowledge-cards/links/{link_id}")
    assert resp.status_code == 200
    assert resp.json()["status"] == "deleted"
    # Verify link is gone
    resp = client.get(f"/api/knowledge-cards/{card_a['id']}/links")
    assert len(resp.json()) == 0


def test_delete_link_not_found():
    fake_id = str(uuid_mod.uuid4())
    resp = client.delete(f"/api/knowledge-cards/links/{fake_id}")
    assert resp.status_code == 404


def test_delete_card_cascades_links():
    """Deleting a card should remove its associated links."""
    card_a = _create_card(title="Cascade A", content="A")
    card_b = _create_card(title="Cascade B", content="B")
    client.post(
        f"/api/knowledge-cards/{card_a['id']}/links",
        json={
            "target_card_id": card_b["id"],
        },
    )
    # Delete card_a — its links should be cleaned up
    client.delete(f"/api/knowledge-cards/{card_a['id']}")
    # card_b should still exist, but have no links
    resp = client.get(f"/api/knowledge-cards/{card_b['id']}/links")
    assert resp.status_code == 200
    assert len(resp.json()) == 0


def test_list_cards_ordered_by_updated_at():
    """Cards should be ordered by updated_at descending."""
    card1 = _create_card(title="First", content="1")
    _create_card(title="Second", content="2")
    # Update card1 so it becomes most recent
    client.put(f"/api/knowledge-cards/{card1['id']}", json={"title": "First Updated"})
    resp = client.get("/api/knowledge-cards/", params={"page_size": 10})
    items = resp.json()["items"]
    # The first item should be the most recently updated
    assert items[0]["title"] == "First Updated"
