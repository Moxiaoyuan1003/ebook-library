import uuid as uuid_mod
import sqlite3
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from sqlalchemy.types import CHAR, TypeDecorator
from sqlalchemy.dialects.postgresql import UUID as PG_UUID

from app.core.database import get_db, Base

# Import models to register them in Base.metadata
from app.models.book import Book
from app.models.tag import Tag, book_tags
from app.models.bookshelf import Bookshelf, bookshelf_books
from app.models.passage import Passage
from app.models.annotation import Annotation
from app.models.knowledge_card import KnowledgeCard


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
                # Check if this looks like a UUID column (CHAR(36) already patched by another module)
                if hasattr(column.type, 'length') and column.type.length == 36:
                    column.type = SQLiteUUID()


# Patch BEFORE any create_all call
_patch_uuid_columns_for_sqlite()

from app.main import app

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


def test_create_tag():
    response = client.post("/api/tags/", json={"name": "Programming", "color": "#ff5722"})
    assert response.status_code == 200
    assert response.json()["name"] == "Programming"


def test_list_tags():
    response = client.get("/api/tags/")
    assert response.status_code == 200


def test_create_tag_default_color():
    response = client.post("/api/tags/", json={"name": "Science"})
    assert response.status_code == 200
    assert response.json()["color"] == "#1677ff"


def test_update_tag():
    # First create a tag
    create_response = client.post("/api/tags/", json={"name": "ToUpdate", "color": "#000000"})
    tag_id = create_response.json()["id"]

    # Update the tag
    response = client.put(f"/api/tags/{tag_id}", json={"name": "Updated", "color": "#ffffff"})
    assert response.status_code == 200
    assert response.json()["name"] == "Updated"
    assert response.json()["color"] == "#ffffff"


def test_delete_tag():
    # First create a tag
    create_response = client.post("/api/tags/", json={"name": "ToDelete", "color": "#111111"})
    tag_id = create_response.json()["id"]

    # Delete the tag
    response = client.delete(f"/api/tags/{tag_id}")
    assert response.status_code == 200
    assert response.json()["status"] == "deleted"


def test_update_tag_not_found():
    import uuid
    fake_id = str(uuid.uuid4())
    response = client.put(f"/api/tags/{fake_id}", json={"name": "NotFound"})
    assert response.status_code == 404


def test_delete_tag_not_found():
    import uuid
    fake_id = str(uuid.uuid4())
    response = client.delete(f"/api/tags/{fake_id}")
    assert response.status_code == 404
