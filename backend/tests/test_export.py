"""Tests for the export API and service."""

import uuid as uuid_mod
import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
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


app.dependency_overrides[get_db] = _override_get_db

client = TestClient(app)


# ── Helpers ──

def _create_book(title="Test Book", author="Test Author", file_format="epub", **kwargs):
    """Create a book directly in the database and return its id."""
    db = TestSessionLocal()
    try:
        book = Book(
            id=uuid_mod.uuid4(),
            title=title,
            author=author,
            file_format=file_format,
            file_path=f"/books/{title}.epub",
            reading_status="unread",
            **kwargs,
        )
        db.add(book)
        db.commit()
        db.refresh(book)
        return str(book.id)
    finally:
        db.close()


def _create_card(title="Test Card", content="Some content", card_type="note", **kwargs):
    """Create a knowledge card via API."""
    payload = {"title": title, "content": content, "card_type": card_type, **kwargs}
    resp = client.post("/api/knowledge-cards/", json=payload)
    assert resp.status_code == 200, resp.text
    return resp.json()


def _create_annotation(book_id, type="highlight", selected_text="some text", **kwargs):
    """Create an annotation via API."""
    payload = {"book_id": book_id, "type": type, "selected_text": selected_text, **kwargs}
    resp = client.post("/api/annotations/", json=payload)
    assert resp.status_code == 200, resp.text
    return resp.json()


def _export(data_type, fmt, filters=None):
    """Call the export endpoint."""
    payload = {"data_type": data_type, "format": fmt, "filters": filters or {}}
    return client.post("/api/export/", json=payload)


# ── Export Cards Tests ──

def test_export_cards_markdown():
    """Export knowledge cards as Markdown."""
    _create_card(title="MD Card 1", content="Content for card 1", card_type="concept")
    _create_card(title="MD Card 2", content="Content for card 2", card_type="note")

    resp = _export("cards", "markdown")
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "text/markdown; charset=utf-8"
    content = resp.text
    assert "# Knowledge Cards Export" in content
    assert "MD Card 1" in content
    assert "MD Card 2" in content
    assert "Content for card 1" in content


def test_export_cards_csv():
    """Export knowledge cards as CSV."""
    _create_card(title="CSV Card", content="CSV content", card_type="note", tags=["test", "export"])

    resp = _export("cards", "csv")
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "text/csv; charset=utf-8"
    content = resp.text
    assert "id,title,content" in content
    assert "CSV Card" in content
    assert "CSV content" in content
    assert "test,export" in content


def test_export_cards_markdown_with_filter():
    """Export cards filtered by book_id."""
    book_id = _create_book(title="Filter Book")
    _create_card(title="Filtered Card", content="Has book", source_book_id=book_id)
    _create_card(title="Other Card", content="No book")

    resp = _export("cards", "markdown", filters={"book_id": book_id})
    assert resp.status_code == 200
    content = resp.text
    assert "Filtered Card" in content
    # The other card should not be present (or at least the filter should work)
    assert "Total cards: 1" in content


def test_export_cards_csv_with_tag_filter():
    """Export cards filtered by tag."""
    _create_card(title="Tagged Card", content="Tagged", tags=["special"])
    _create_card(title="Untagged Card", content="Plain")

    resp = _export("cards", "csv", filters={"tags": ["special"]})
    assert resp.status_code == 200
    content = resp.text
    assert "Tagged Card" in content


# ── Export Annotations Tests ──

def test_export_annotations_markdown():
    """Export annotations as Markdown."""
    book_id = _create_book(title="Ann Book")
    _create_annotation(book_id, type="highlight", selected_text="Important passage")
    _create_annotation(book_id, type="note", note_content="My note")

    resp = _export("annotations", "markdown")
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "text/markdown; charset=utf-8"
    content = resp.text
    assert "# Annotations Export" in content
    assert "Important passage" in content
    assert "My note" in content


def test_export_annotations_csv():
    """Export annotations as CSV."""
    book_id = _create_book(title="CSV Ann Book")
    _create_annotation(book_id, type="highlight", selected_text="CSV highlight")

    resp = _export("annotations", "csv")
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "text/csv; charset=utf-8"
    content = resp.text
    assert "id,book_id,type" in content
    assert "CSV highlight" in content


def test_export_annotations_with_book_filter():
    """Export annotations filtered by book_id."""
    book_id = _create_book(title="Ann Filter Book")
    other_book_id = _create_book(title="Other Book")
    _create_annotation(book_id, type="highlight", selected_text="In book")
    _create_annotation(other_book_id, type="highlight", selected_text="In other book")

    resp = _export("annotations", "markdown", filters={"book_id": book_id})
    assert resp.status_code == 200
    content = resp.text
    assert "In book" in content
    assert "Total annotations: 1" in content


# ── Export Books Tests ──

def test_export_books_markdown():
    """Export books as Markdown."""
    _create_book(title="Book MD 1", author="Author A")
    _create_book(title="Book MD 2", author="Author B")

    resp = _export("books", "markdown")
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "text/markdown; charset=utf-8"
    content = resp.text
    assert "# Books Export" in content
    assert "Book MD 1" in content
    assert "Book MD 2" in content
    assert "Author A" in content


def test_export_books_csv():
    """Export books as CSV."""
    _create_book(title="Book CSV", author="CSV Author", isbn="1234567890")

    resp = _export("books", "csv")
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "text/csv; charset=utf-8"
    content = resp.text
    assert "id,title,author" in content
    assert "Book CSV" in content
    assert "CSV Author" in content


# ── PDF Tests ──

def test_export_cards_pdf_no_reportlab():
    """PDF export should return 501 when reportlab is not installed."""
    _create_card(title="PDF Card", content="PDF content")

    # Patch the import to simulate reportlab not being installed
    import builtins
    original_import = builtins.__import__

    def mock_import(name, *args, **kwargs):
        if name == "reportlab" or name.startswith("reportlab."):
            raise ImportError("No module named 'reportlab'")
        return original_import(name, *args, **kwargs)

    with patch("builtins.__import__", side_effect=mock_import):
        resp = _export("cards", "pdf")
        assert resp.status_code == 501
        assert "reportlab" in resp.json()["detail"]


def test_export_annotations_pdf_no_reportlab():
    """PDF export for annotations should return 501 when reportlab is not installed."""
    book_id = _create_book(title="PDF Ann Book")
    _create_annotation(book_id, type="highlight", selected_text="PDF text")

    import builtins
    original_import = builtins.__import__

    def mock_import(name, *args, **kwargs):
        if name == "reportlab" or name.startswith("reportlab."):
            raise ImportError("No module named 'reportlab'")
        return original_import(name, *args, **kwargs)

    with patch("builtins.__import__", side_effect=mock_import):
        resp = _export("annotations", "pdf")
        assert resp.status_code == 501
        assert "reportlab" in resp.json()["detail"]


def test_export_books_pdf_no_reportlab():
    """PDF export for books should return 501 when reportlab is not installed."""
    _create_book(title="PDF Book")

    import builtins
    original_import = builtins.__import__

    def mock_import(name, *args, **kwargs):
        if name == "reportlab" or name.startswith("reportlab."):
            raise ImportError("No module named 'reportlab'")
        return original_import(name, *args, **kwargs)

    with patch("builtins.__import__", side_effect=mock_import):
        resp = _export("books", "pdf")
        assert resp.status_code == 501
        assert "reportlab" in resp.json()["detail"]


def test_export_cards_pdf_with_reportlab():
    """PDF export should succeed when reportlab is installed."""
    pytest.importorskip("reportlab", reason="reportlab not installed")
    _create_card(title="PDF Card Real", content="Real PDF content")

    resp = _export("cards", "pdf")
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "application/pdf"
    # PDF files start with %PDF
    assert resp.content[:4] == b"%PDF"


# ── Validation Tests ──

def test_export_invalid_data_type():
    """Should return 400 for invalid data_type."""
    resp = _export("invalid", "markdown")
    assert resp.status_code == 400
    assert "Invalid data_type" in resp.json()["detail"]


def test_export_invalid_format():
    """Should return 400 for invalid format."""
    resp = _export("cards", "xml")
    assert resp.status_code == 400
    assert "Invalid format" in resp.json()["detail"]


def test_export_empty_result():
    """Export should always return valid output even with shared DB state."""
    resp = _export("cards", "markdown")
    assert resp.status_code == 200
    content = resp.text
    assert "# Knowledge Cards Export" in content
    assert "Total cards:" in content


def test_export_content_disposition_header():
    """Response should include Content-Disposition header for file download."""
    resp = _export("cards", "markdown")
    assert resp.status_code == 200
    assert "Content-Disposition" in resp.headers
    assert "knowledge_cards.md" in resp.headers["Content-Disposition"]


def test_export_csv_content_disposition():
    """CSV response should have correct filename in Content-Disposition."""
    resp = _export("annotations", "csv")
    assert resp.status_code == 200
    assert "annotations.csv" in resp.headers["Content-Disposition"]
