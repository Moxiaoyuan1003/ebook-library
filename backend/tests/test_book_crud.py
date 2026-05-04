"""Tests for the Books CRUD API endpoints."""

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


# ── Helper to insert a book directly via SQLAlchemy ──


def _create_test_book(
    title="Test Book",
    author="Test Author",
    file_path="/tmp/test.epub",
    file_format="epub",
    **kwargs,
):
    """Insert a book directly into the test database and return its id as string."""
    db = TestSessionLocal()
    try:
        book = Book(
            id=uuid_mod.uuid4(),
            title=title,
            author=author,
            file_path=file_path,
            file_format=file_format,
            **kwargs,
        )
        db.add(book)
        db.commit()
        db.refresh(book)
        return str(book.id)
    finally:
        db.close()


# ── GET /api/books/ — list books (with data) ──


def test_list_books_returns_data():
    _create_test_book(title="Book One", author="Alice")
    _create_test_book(title="Book Two", author="Bob")

    resp = client.get("/api/books/")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] >= 2
    assert len(data["items"]) >= 2
    assert "page" in data
    assert "page_size" in data

    titles = [b["title"] for b in data["items"]]
    assert "Book One" in titles
    assert "Book Two" in titles


def test_list_books_pagination():
    """Ensure page_size limits results."""
    for i in range(5):
        _create_test_book(title=f"PagBook {i}")

    resp = client.get("/api/books/", params={"page": 1, "page_size": 2})
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["items"]) == 2
    assert data["total"] >= 5
    assert data["page"] == 1
    assert data["page_size"] == 2


def test_list_books_filter_by_search():
    _create_test_book(title="UniqueAlpha")
    _create_test_book(title="DifferentBeta")

    resp = client.get("/api/books/", params={"search": "UniqueAlpha"})
    assert resp.status_code == 200
    data = resp.json()
    titles = [b["title"] for b in data["items"]]
    assert "UniqueAlpha" in titles


def test_list_books_filter_by_favorite():
    _create_test_book(title="Fav Book", is_favorite=True)
    _create_test_book(title="Normal Book", is_favorite=False)

    resp = client.get("/api/books/", params={"is_favorite": True})
    assert resp.status_code == 200
    titles = [b["title"] for b in resp.json()["items"]]
    assert "Fav Book" in titles


# ── POST /api/books/ — create book via API ──


def test_create_book():
    resp = client.post(
        "/api/books/",
        json={
            "title": "API Created Book",
            "author": "API Author",
            "file_path": "/tmp/api_created.epub",
            "file_format": "epub",
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["title"] == "API Created Book"
    assert data["author"] == "API Author"
    assert data["file_format"] == "epub"
    assert "id" in data
    assert "created_at" in data


def test_create_book_minimal():
    resp = client.post(
        "/api/books/",
        json={
            "title": "Minimal Book",
            "file_path": "/tmp/minimal.pdf",
            "file_format": "pdf",
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["title"] == "Minimal Book"
    assert data["author"] is None


# ── GET /api/books/{id} — get single book ──


def test_get_book():
    book_id = _create_test_book(title="Fetch Me", author="Fetcher")

    resp = client.get(f"/api/books/{book_id}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == book_id
    assert data["title"] == "Fetch Me"
    assert data["author"] == "Fetcher"


# ── GET /api/books/{id} — 404 for nonexistent ──


def test_get_book_not_found():
    fake_id = str(uuid_mod.uuid4())
    resp = client.get(f"/api/books/{fake_id}")
    assert resp.status_code == 404


# ── PUT /api/books/{id} — update book metadata ──


def test_update_book():
    book_id = _create_test_book(title="Original Title", author="Original Author")

    resp = client.put(
        f"/api/books/{book_id}",
        json={
            "title": "Updated Title",
            "author": "Updated Author",
            "reading_status": "reading",
            "rating": 4,
            "is_favorite": True,
            "summary": "A great book.",
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["title"] == "Updated Title"
    assert data["author"] == "Updated Author"
    assert data["reading_status"] == "reading"
    assert data["rating"] == 4
    assert data["is_favorite"] is True
    assert data["summary"] == "A great book."


def test_update_book_partial():
    book_id = _create_test_book(title="Partial Update", author="Keep Me")

    resp = client.put(
        f"/api/books/{book_id}",
        json={
            "title": "New Title Only",
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["title"] == "New Title Only"
    assert data["author"] == "Keep Me"


# ── PUT /api/books/{id} — 404 for nonexistent ──


def test_update_book_not_found():
    fake_id = str(uuid_mod.uuid4())
    resp = client.put(f"/api/books/{fake_id}", json={"title": "Nope"})
    assert resp.status_code == 404


# ── DELETE /api/books/{id} — delete book ──


def test_delete_book():
    book_id = _create_test_book(title="Delete Me")

    resp = client.delete(f"/api/books/{book_id}")
    assert resp.status_code == 200
    assert resp.json()["status"] == "deleted"

    # Verify it's gone
    resp = client.get(f"/api/books/{book_id}")
    assert resp.status_code == 404


# ── DELETE /api/books/{id} — 404 for nonexistent ──


def test_delete_book_not_found():
    fake_id = str(uuid_mod.uuid4())
    resp = client.delete(f"/api/books/{fake_id}")
    assert resp.status_code == 404
