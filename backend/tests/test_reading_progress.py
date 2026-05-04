import uuid as uuid_mod
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from sqlalchemy.types import CHAR, TypeDecorator
from sqlalchemy.dialects.postgresql import UUID as PG_UUID

from app.core.database import get_db, Base

# Import ALL models to register them in Base.metadata
from app.models.book import Book
from app.models.tag import Tag, book_tags
from app.models.bookshelf import Bookshelf, bookshelf_books
from app.models.passage import Passage
from app.models.annotation import Annotation
from app.models.knowledge_card import KnowledgeCard
from app.models.card_link import CardLink
from app.models.reading_progress import ReadingProgress
from app.models.reading_session import ReadingSession


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


# -- Helper to create a test book --

def _create_test_book(title="Test Book", author="Author"):
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


# -- Reading Progress Tests --

def test_get_reading_progress_none_exists():
    """Getting progress for a book with no progress should return defaults."""
    book_id = _create_test_book()
    resp = client.get(f"/api/books/{book_id}/progress")
    assert resp.status_code == 200
    data = resp.json()
    assert data["current_page"] == 0
    assert data["current_cfi"] is None
    assert data["progress_percent"] == 0.0


def test_update_reading_progress_page():
    """Create and update reading progress with page number."""
    book_id = _create_test_book()
    resp = client.put(
        f"/api/books/{book_id}/progress",
        params={"current_page": 42, "progress_percent": 35.5},
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"

    # Verify the progress was saved
    resp = client.get(f"/api/books/{book_id}/progress")
    assert resp.status_code == 200
    data = resp.json()
    assert data["current_page"] == 42
    assert data["progress_percent"] == 35.5
    assert data["current_cfi"] is None


def test_update_reading_progress_epub_cfi():
    """Update progress with EPUB CFI string."""
    book_id = _create_test_book()
    cfi = "epubcfi(/6/14[chap05]!/4/2/1:0)"
    resp = client.put(
        f"/api/books/{book_id}/progress",
        params={"current_cfi": cfi, "progress_percent": 50.0},
    )
    assert resp.status_code == 200

    resp = client.get(f"/api/books/{book_id}/progress")
    data = resp.json()
    assert data["current_cfi"] == cfi
    assert data["progress_percent"] == 50.0


def test_update_reading_progress_incremental():
    """Update progress multiple times; latest values should win."""
    book_id = _create_test_book()

    # First update
    client.put(f"/api/books/{book_id}/progress", params={"current_page": 10, "progress_percent": 10.0})
    # Second update
    client.put(f"/api/books/{book_id}/progress", params={"current_page": 25, "progress_percent": 25.0})
    # Third update
    client.put(f"/api/books/{book_id}/progress", params={"current_page": 50, "progress_percent": 50.0})

    resp = client.get(f"/api/books/{book_id}/progress")
    data = resp.json()
    assert data["current_page"] == 50
    assert data["progress_percent"] == 50.0


def test_update_reading_progress_partial():
    """Updating only one field should leave others unchanged."""
    book_id = _create_test_book()

    # Set initial progress
    client.put(
        f"/api/books/{book_id}/progress",
        params={"current_page": 20, "current_cfi": "epubcfi(/6/1)", "progress_percent": 20.0},
    )

    # Update only progress_percent
    client.put(f"/api/books/{book_id}/progress", params={"progress_percent": 40.0})

    resp = client.get(f"/api/books/{book_id}/progress")
    data = resp.json()
    assert data["current_page"] == 20
    assert data["current_cfi"] == "epubcfi(/6/1)"
    assert data["progress_percent"] == 40.0


def test_reading_progress_different_books():
    """Progress for different books should be independent."""
    book_a = _create_test_book(title="Book A")
    book_b = _create_test_book(title="Book B")

    client.put(f"/api/books/{book_a}/progress", params={"current_page": 100, "progress_percent": 100.0})
    client.put(f"/api/books/{book_b}/progress", params={"current_page": 10, "progress_percent": 10.0})

    resp_a = client.get(f"/api/books/{book_a}/progress")
    resp_b = client.get(f"/api/books/{book_b}/progress")

    assert resp_a.json()["current_page"] == 100
    assert resp_b.json()["current_page"] == 10


def test_update_reading_progress_book_not_found():
    """Updating progress for a non-existent book should still succeed (creates progress record)."""
    fake_book_id = str(uuid_mod.uuid4())
    # The endpoint doesn't validate book existence, it just creates/updates progress
    resp = client.put(
        f"/api/books/{fake_book_id}/progress",
        params={"current_page": 1},
    )
    # The API doesn't check if the book exists; it just creates progress
    assert resp.status_code == 200
