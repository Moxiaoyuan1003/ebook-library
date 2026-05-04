import uuid as uuid_mod

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from sqlalchemy.types import CHAR, TypeDecorator

from app.core.database import Base, get_db

# Import ALL models to register them in Base.metadata
from app.models.book import Book


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


client = TestClient(app)


@pytest.fixture(autouse=True)
def _use_test_db():
    """Ensure this test file's DB override is active for each test."""
    previous = app.dependency_overrides.get(get_db)
    app.dependency_overrides[get_db] = _override_get_db
    yield
    if previous is not None:
        app.dependency_overrides[get_db] = previous
    else:
        app.dependency_overrides.pop(get_db, None)


# ── Helper to create a book for annotation FK ──


def _create_book(title="Test Book", author="Author"):
    """Create a book directly in the DB and return its id as string."""
    db = TestSessionLocal()
    try:
        book = Book(
            id=uuid_mod.uuid4(),
            title=title,
            author=author,
            file_path=f"/tmp/{title}.epub",
            file_format="epub",
        )
        db.add(book)
        db.commit()
        db.refresh(book)
        return str(book.id)
    finally:
        db.close()


# ── Helper to create an annotation ──


def _create_annotation(book_id, type="highlight", selected_text="Some text", **kwargs):
    payload = {
        "book_id": book_id,
        "type": type,
        "selected_text": selected_text,
        **kwargs,
    }
    resp = client.post("/api/annotations/", json=payload)
    assert resp.status_code == 200, resp.text
    return resp.json()


# ── CRUD Tests ──


def test_create_annotation():
    book_id = _create_book()
    resp = client.post(
        "/api/annotations/",
        json={
            "book_id": book_id,
            "type": "highlight",
            "selected_text": "Important passage here",
            "color": "#ffeb3b",
            "highlight_color": "yellow",
            "page_number": 42,
            "start_cfi": "epubcfi(/6/14[chap05]!/4/2/1:0)",
            "end_cfi": "epubcfi(/6/14[chap05]!/4/2/1:30)",
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["book_id"] == book_id
    assert data["type"] == "highlight"
    assert data["selected_text"] == "Important passage here"
    assert data["color"] == "#ffeb3b"
    assert data["highlight_color"] == "yellow"
    assert data["page_number"] == 42
    assert data["start_cfi"] == "epubcfi(/6/14[chap05]!/4/2/1:0)"
    assert data["end_cfi"] == "epubcfi(/6/14[chap05]!/4/2/1:30)"
    assert "id" in data
    assert "created_at" in data


def test_create_annotation_minimal():
    book_id = _create_book()
    resp = client.post(
        "/api/annotations/",
        json={
            "book_id": book_id,
            "type": "bookmark",
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["type"] == "bookmark"
    assert data["selected_text"] is None
    assert data["note_content"] is None


def test_create_annotation_with_rect_data():
    book_id = _create_book()
    rect_json = '[{"x":10,"y":20,"w":300,"h":20,"page":1}]'
    resp = client.post(
        "/api/annotations/",
        json={
            "book_id": book_id,
            "type": "highlight",
            "selected_text": "PDF text",
            "rect_data": rect_json,
        },
    )
    assert resp.status_code == 200
    assert resp.json()["rect_data"] == rect_json


def test_list_annotations_by_book_id():
    book_id = _create_book(title="List Book")
    _create_annotation(book_id, type="highlight", selected_text="First")
    _create_annotation(book_id, type="note", note_content="My note")
    _create_annotation(book_id, type="bookmark")

    resp = client.get("/api/annotations/", params={"book_id": book_id})
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 3
    # All should belong to the same book
    assert all(a["book_id"] == book_id for a in data)


def test_list_annotations_different_books():
    book_a = _create_book(title="Book A")
    book_b = _create_book(title="Book B")
    _create_annotation(book_a, selected_text="A's annotation")
    _create_annotation(book_b, selected_text="B's annotation")

    resp = client.get("/api/annotations/", params={"book_id": book_a})
    data = resp.json()
    assert len(data) == 1
    assert data[0]["selected_text"] == "A's annotation"


def test_update_annotation_note():
    book_id = _create_book()
    ann = _create_annotation(book_id, type="note", note_content="Original note")

    resp = client.put(
        f"/api/annotations/{ann['id']}",
        json={
            "note_content": "Updated note content",
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["note_content"] == "Updated note content"
    # Type and book_id should remain unchanged
    assert data["type"] == "note"
    assert data["book_id"] == book_id


def test_update_annotation_highlight_color():
    book_id = _create_book()
    ann = _create_annotation(book_id, type="highlight", highlight_color="yellow")

    resp = client.put(
        f"/api/annotations/{ann['id']}",
        json={
            "highlight_color": "blue",
        },
    )
    assert resp.status_code == 200
    assert resp.json()["highlight_color"] == "blue"


def test_update_annotation_color():
    book_id = _create_book()
    ann = _create_annotation(book_id, type="highlight", color="#ffeb3b")

    resp = client.put(
        f"/api/annotations/{ann['id']}",
        json={
            "color": "#4caf50",
        },
    )
    assert resp.status_code == 200
    assert resp.json()["color"] == "#4caf50"


def test_update_annotation_not_found():
    fake_id = str(uuid_mod.uuid4())
    resp = client.put(f"/api/annotations/{fake_id}", json={"note_content": "Nope"})
    assert resp.status_code == 404


def test_delete_annotation():
    book_id = _create_book()
    ann = _create_annotation(book_id, selected_text="Delete me")

    resp = client.delete(f"/api/annotations/{ann['id']}")
    assert resp.status_code == 200
    assert resp.json()["status"] == "deleted"

    # Verify it's gone — list should be empty
    resp = client.get("/api/annotations/", params={"book_id": book_id})
    assert len(resp.json()) == 0


def test_delete_annotation_not_found():
    fake_id = str(uuid_mod.uuid4())
    resp = client.delete(f"/api/annotations/{fake_id}")
    assert resp.status_code == 404


def test_list_annotations_empty():
    book_id = _create_book(title="Empty Book")
    resp = client.get("/api/annotations/", params={"book_id": book_id})
    assert resp.status_code == 200
    assert resp.json() == []
