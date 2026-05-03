import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from sqlalchemy.types import CHAR
from sqlalchemy.dialects.postgresql import UUID as PG_UUID

from app.core.database import get_db, Base

# Import models to register them in Base.metadata
from app.models.book import Book
from app.models.tag import Tag, book_tags
from app.models.bookshelf import Bookshelf, bookshelf_books
from app.models.passage import Passage
from app.models.annotation import Annotation
from app.models.knowledge_card import KnowledgeCard


def _patch_uuid_columns_for_sqlite():
    """Replace PostgreSQL UUID columns with SQLite-compatible CHAR(36)."""
    for table in Base.metadata.tables.values():
        for column in table.columns:
            if isinstance(column.type, PG_UUID):
                column.type = CHAR(36)


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


def test_health_endpoint():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_list_books_empty():
    response = client.get("/api/books/")
    assert response.status_code == 200
