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


app.dependency_overrides[get_db] = _override_get_db

client = TestClient(app)


# ── Helper to create a book for session FK ──

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


# ── CRUD Tests ──

def test_list_reading_sessions_empty():
    """List sessions for a book with no sessions returns empty list."""
    book_id = _create_book(title="Empty Sessions Book")
    resp = client.get(f"/api/ai/reading-sessions/{book_id}")
    assert resp.status_code == 200
    assert resp.json() == []


def test_delete_reading_session_not_found():
    """Deleting a non-existent session returns 404."""
    fake_id = str(uuid_mod.uuid4())
    resp = client.delete(f"/api/ai/reading-sessions/{fake_id}")
    assert resp.status_code == 404


def test_reading_chat_no_ai_service():
    """Reading chat returns 503 when no AI service is available (expected in test env)."""
    book_id = _create_book(title="Chat Test Book")
    resp = client.post("/api/ai/reading-chat", json={
        "book_id": book_id,
        "message": "Tell me about this book",
    })
    # In test environment, no AI service is configured, so we expect 503
    assert resp.status_code == 503


def test_reading_chat_with_mocked_ai(monkeypatch):
    """Reading chat creates session and returns reply when AI service is mocked."""
    book_id = _create_book(title="Mocked Chat Book")

    # Mock the AI service factory to return a mock service
    class MockAIService:
        async def chat(self, messages, context=None):
            return "This is a mocked AI response about the book."

    class MockFactory:
        async def get_service(self):
            return MockAIService(), "mock"

    # Patch the factory creation
    import app.api.ai as ai_module
    monkeypatch.setattr(ai_module, "_get_ai_factory", lambda: MockFactory())

    resp = client.post("/api/ai/reading-chat", json={
        "book_id": book_id,
        "message": "What is this book about?",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert "reply" in data
    assert "session_id" in data
    assert data["reply"] == "This is a mocked AI response about the book."


def test_reading_chat_with_context_passages(monkeypatch):
    """Reading chat with context passages works correctly."""
    book_id = _create_book(title="Context Test Book")

    class MockAIService:
        async def chat(self, messages, context=None):
            return f"Response with context: {context[:50] if context else 'none'}"

    class MockFactory:
        async def get_service(self):
            return MockAIService(), "mock"

    import app.api.ai as ai_module
    monkeypatch.setattr(ai_module, "_get_ai_factory", lambda: MockFactory())

    resp = client.post("/api/ai/reading-chat", json={
        "book_id": book_id,
        "message": "Analyze this passage",
        "context_passages": [
            {"text": "The quick brown fox jumps over the lazy dog."},
            {"text": "A second passage for context."},
        ],
    })
    assert resp.status_code == 200
    data = resp.json()
    assert "session_id" in data
    assert "Response with context:" in data["reply"]


def test_reading_chat_continues_session(monkeypatch):
    """Reading chat with session_id continues an existing session."""
    book_id = _create_book(title="Continue Session Book")

    call_count = 0

    class MockAIService:
        async def chat(self, messages, context=None):
            nonlocal call_count
            call_count += 1
            return f"Response #{call_count}"

    class MockFactory:
        async def get_service(self):
            return MockAIService(), "mock"

    import app.api.ai as ai_module
    monkeypatch.setattr(ai_module, "_get_ai_factory", lambda: MockFactory())

    # First message - creates session
    resp1 = client.post("/api/ai/reading-chat", json={
        "book_id": book_id,
        "message": "Hello",
    })
    assert resp1.status_code == 200
    session_id = resp1.json()["session_id"]

    # Second message - continues session
    resp2 = client.post("/api/ai/reading-chat", json={
        "book_id": book_id,
        "message": "Follow up question",
        "session_id": session_id,
    })
    assert resp2.status_code == 200
    assert resp2.json()["session_id"] == session_id


def test_list_reading_sessions_after_chat(monkeypatch):
    """List sessions returns sessions after creating them via chat."""
    book_id = _create_book(title="List After Chat Book")

    class MockAIService:
        async def chat(self, messages, context=None):
            return "Mock response"

    class MockFactory:
        async def get_service(self):
            return MockAIService(), "mock"

    import app.api.ai as ai_module
    monkeypatch.setattr(ai_module, "_get_ai_factory", lambda: MockFactory())

    # Create a session via chat
    client.post("/api/ai/reading-chat", json={
        "book_id": book_id,
        "message": "First session",
    })

    # Create another session
    client.post("/api/ai/reading-chat", json={
        "book_id": book_id,
        "message": "Second session",
    })

    # List sessions
    resp = client.get(f"/api/ai/reading-sessions/{book_id}")
    assert resp.status_code == 200
    sessions = resp.json()
    assert len(sessions) == 2


def test_delete_reading_session(monkeypatch):
    """Delete session removes the session successfully."""
    book_id = _create_book(title="Delete Session Book")

    class MockAIService:
        async def chat(self, messages, context=None):
            return "Mock response"

    class MockFactory:
        async def get_service(self):
            return MockAIService(), "mock"

    import app.api.ai as ai_module
    monkeypatch.setattr(ai_module, "_get_ai_factory", lambda: MockFactory())

    # Create a session
    resp = client.post("/api/ai/reading-chat", json={
        "book_id": book_id,
        "message": "To be deleted",
    })
    session_id = resp.json()["session_id"]

    # Delete it
    resp = client.delete(f"/api/ai/reading-sessions/{session_id}")
    assert resp.status_code == 200
    assert resp.json()["status"] == "deleted"

    # Verify it's gone
    resp = client.get(f"/api/ai/reading-sessions/{book_id}")
    assert len(resp.json()) == 0


def test_reading_chat_with_session_id_not_found(monkeypatch):
    """Reading chat with non-existent session_id returns 404."""
    book_id = _create_book(title="Session Not Found Book")

    class MockAIService:
        async def chat(self, messages, context=None):
            return "Should not reach here"

    class MockFactory:
        async def get_service(self):
            return MockAIService(), "mock"

    import app.api.ai as ai_module
    monkeypatch.setattr(ai_module, "_get_ai_factory", lambda: MockFactory())

    fake_session_id = str(uuid_mod.uuid4())
    resp = client.post("/api/ai/reading-chat", json={
        "book_id": book_id,
        "message": "Hello",
        "session_id": fake_session_id,
    })
    assert resp.status_code == 404
