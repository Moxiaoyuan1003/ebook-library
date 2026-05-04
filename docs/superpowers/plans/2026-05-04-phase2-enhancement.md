# Phase 2 Enhancement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add auto metadata extraction, cross-book queries, knowledge cards, Ollama offline support, and full PDF/EPUB reader to the Personal Library Manager.

**Architecture:** Extends Phase 1 with new backend services (MetadataEnrichmentService, NetworkChecker, AIServiceFactory), new API endpoints, new data models (CardLink, ReadingProgress), and enhanced frontend pages (KnowledgeCards, CrossBookQuery, full Reader).

**Tech Stack:** FastAPI, SQLAlchemy, httpx, react-pdf, epubjs, Zustand, Ant Design

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `backend/app/services/enrichment.py` | MetadataEnrichmentService — Google Books + Open Library API |
| `backend/app/services/network_checker.py` | NetworkChecker — online detection with caching |
| `backend/app/services/ai/factory.py` | AIServiceFactory — auto-switching cloud/Ollama |
| `backend/app/models/card_link.py` | CardLink model |
| `backend/app/models/reading_progress.py` | ReadingProgress model |
| `backend/app/schemas/knowledge_card.py` | KnowledgeCard + CardLink schemas |
| `backend/app/api/knowledge_cards.py` | Knowledge cards CRUD API |
| `backend/tests/test_enrichment.py` | Metadata enrichment tests |
| `backend/tests/test_cross_book.py` | Cross-book query tests |
| `backend/tests/test_knowledge_cards.py` | Knowledge card API tests |
| `backend/tests/test_network_checker.py` | Network checker tests |
| `frontend/src/pages/KnowledgeCards/KnowledgeCardsPage.tsx` | Knowledge cards page |
| `frontend/src/components/PdfViewer.tsx` | PDF reader component |
| `frontend/src/components/EpubViewer.tsx` | EPUB reader component |
| `frontend/src/services/knowledgeCardApi.ts` | Knowledge card API client |
| `frontend/src/stores/knowledgeCardStore.ts` | Knowledge card Zustand store |

### Modified Files

| File | Changes |
|------|---------|
| `backend/app/models/book.py` | Add metadata_enriched, metadata_source, open_library_id fields |
| `backend/app/models/knowledge_card.py` | Add card_type, tags, updated_at fields |
| `backend/app/models/__init__.py` | Register CardLink, ReadingProgress |
| `backend/app/schemas/search.py` | Add CrossBookQuery/Response schemas |
| `backend/app/schemas/book.py` | Add new fields to BookResponse |
| `backend/app/services/search/engine.py` | Add cross_book_query method |
| `backend/app/api/search.py` | Add cross-book endpoint |
| `backend/app/api/ai.py` | Replace get_ai_service with AIServiceFactory |
| `backend/app/services/import_service.py` | Call enrichment after import |
| `backend/app/api/ws.py` | Add enrichment progress broadcast |
| `backend/app/main.py` | Register knowledge_cards router |
| `backend/conftest.py` | Patch JSON column type for SQLite |
| `frontend/src/App.tsx` | Add knowledge-cards route |
| `frontend/src/pages/Reader/ReaderPage.tsx` | Replace skeleton with PdfViewer/EpubViewer |
| `frontend/src/pages/Search/SearchPage.tsx` | Add cross-book query tab |
| `frontend/src/components/Layout/Sidebar.tsx` | Add knowledge cards entry |
| `frontend/src/components/Layout/StatusBar.tsx` | Show AI engine status |
| `frontend/src/services/bookApi.ts` | Add enrichment API call |
| `frontend/src/services/aiApi.ts` | Add cross-book query method |
| `frontend/src/stores/appStore.ts` | Add aiStatus state |

---

## Task 1: Model Extensions — Book, KnowledgeCard, CardLink, ReadingProgress

**Files:**
- Modify: `backend/app/models/book.py`
- Modify: `backend/app/models/knowledge_card.py`
- Create: `backend/app/models/card_link.py`
- Create: `backend/app/models/reading_progress.py`
- Modify: `backend/app/models/__init__.py`
- Modify: `backend/app/schemas/book.py`
- Create: `backend/app/schemas/knowledge_card.py`
- Test: `backend/tests/test_models.py` (modify)

- [ ] **Step 1: Write the failing test for new model fields**

```python
# backend/tests/test_models.py — add these tests
def test_book_has_metadata_enriched():
    from app.models import Book
    assert hasattr(Book, 'metadata_enriched')

def test_book_has_metadata_source():
    from app.models import Book
    assert hasattr(Book, 'metadata_source')

def test_knowledge_card_has_card_type():
    from app.models import KnowledgeCard
    assert hasattr(KnowledgeCard, 'card_type')

def test_card_link_model_exists():
    from app.models import CardLink
    assert CardLink.__tablename__ == "card_links"

def test_reading_progress_model_exists():
    from app.models import ReadingProgress
    assert ReadingProgress.__tablename__ == "reading_progress"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_models.py -v`
Expected: FAIL — attributes/models don't exist

- [ ] **Step 3: Add new fields to Book model**

```python
# backend/app/models/book.py — add after summary field
metadata_enriched = Column(Boolean, default=False)
metadata_source = Column(String(20), default="file")  # file / google_books / open_library
open_library_id = Column(String(50))
```

- [ ] **Step 4: Extend KnowledgeCard model**

```python
# backend/app/models/knowledge_card.py — add after annotation field
from sqlalchemy import JSON
card_type = Column(String(20), default="manual")  # search_result / ai_chat / manual
tags = Column(JSON, default=list)
updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
```

Full file:
```python
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

from app.core.database import Base


class KnowledgeCard(Base):
    __tablename__ = "knowledge_cards"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String(300), nullable=False)
    content = Column(Text, nullable=False)
    source_book_id = Column(UUID(as_uuid=True), ForeignKey("books.id"))
    source_passage = Column(Text)
    annotation = Column(Text)
    card_type = Column(String(20), default="manual")
    tags = Column(JSON, default=list)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    book = relationship("Book", foreign_keys=[source_book_id])
```

- [ ] **Step 5: Create CardLink model**

```python
# backend/app/models/card_link.py
from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

from app.core.database import Base


class CardLink(Base):
    __tablename__ = "card_links"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source_card_id = Column(UUID(as_uuid=True), ForeignKey("knowledge_cards.id"), nullable=False, index=True)
    target_card_id = Column(UUID(as_uuid=True), ForeignKey("knowledge_cards.id"), nullable=False, index=True)
    link_type = Column(String(20), default="related")  # related / contradicts / extends
    created_at = Column(DateTime, default=datetime.utcnow)

    source_card = relationship("KnowledgeCard", foreign_keys=[source_card_id])
    target_card = relationship("KnowledgeCard", foreign_keys=[target_card_id])
```

- [ ] **Step 6: Create ReadingProgress model**

```python
# backend/app/models/reading_progress.py
from sqlalchemy import Column, String, Integer, Float, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

from app.core.database import Base


class ReadingProgress(Base):
    __tablename__ = "reading_progress"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    book_id = Column(UUID(as_uuid=True), ForeignKey("books.id"), nullable=False, unique=True, index=True)
    current_page = Column(Integer)
    current_cfi = Column(Text)
    progress_percent = Column(Float, default=0.0)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    book = relationship("Book", foreign_keys=[book_id])
```

- [ ] **Step 7: Update models/__init__.py**

```python
# backend/app/models/__init__.py
from app.models.book import Book
from app.models.tag import Tag, book_tags
from app.models.bookshelf import Bookshelf, bookshelf_books
from app.models.passage import Passage
from app.models.annotation import Annotation
from app.models.knowledge_card import KnowledgeCard
from app.models.card_link import CardLink
from app.models.reading_progress import ReadingProgress

__all__ = [
    "Book",
    "Tag",
    "book_tags",
    "Bookshelf",
    "bookshelf_books",
    "Passage",
    "Annotation",
    "KnowledgeCard",
    "CardLink",
    "ReadingProgress",
]
```

- [ ] **Step 8: Update schemas/book.py — add new fields to BookResponse**

```python
# backend/app/schemas/book.py — add to BookResponse class
metadata_enriched: bool = False
metadata_source: Optional[str] = "file"
```

- [ ] **Step 9: Create knowledge_card schemas**

```python
# backend/app/schemas/knowledge_card.py
from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional
from uuid import UUID


class KnowledgeCardCreate(BaseModel):
    title: str = Field(..., max_length=300)
    content: str
    source_book_id: Optional[UUID] = None
    source_passage: Optional[str] = None
    annotation: Optional[str] = None
    card_type: str = Field("manual", pattern="^(search_result|ai_chat|manual)$")
    tags: list[str] = []


class KnowledgeCardUpdate(BaseModel):
    title: Optional[str] = Field(None, max_length=300)
    content: Optional[str] = None
    annotation: Optional[str] = None
    tags: Optional[list[str]] = None


class KnowledgeCardResponse(BaseModel):
    id: UUID
    title: str
    content: str
    source_book_id: Optional[UUID]
    source_passage: Optional[str]
    annotation: Optional[str]
    card_type: str
    tags: list[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class CardLinkCreate(BaseModel):
    target_card_id: UUID
    link_type: str = Field("related", pattern="^(related|contradicts|extends)$")


class CardLinkResponse(BaseModel):
    id: UUID
    source_card_id: UUID
    target_card_id: UUID
    link_type: str
    created_at: datetime
    target_card: Optional[KnowledgeCardResponse] = None

    class Config:
        from_attributes = True


class KnowledgeCardListResponse(BaseModel):
    items: list[KnowledgeCardResponse]
    total: int
    page: int
    page_size: int
```

- [ ] **Step 10: Patch conftest.py for JSON column**

```python
# backend/conftest.py — add after _patch_uuid_columns_for_sqlite function
from sqlalchemy import JSON as SA_JSON

def _patch_json_columns_for_sqlite():
    """Replace PostgreSQL JSON columns with SQLite-compatible TEXT."""
    for table in Base.metadata.tables.values():
        for column in table.columns:
            if isinstance(column.type, SA_JSON):
                column.type = SA_JSON().with_variant(sa.Text, 'sqlite')
```

Wait, SQLite handles JSON as TEXT automatically with modern SQLAlchemy. Let me simplify — just add the import and patch call:

```python
# backend/conftest.py — add after the UUID patch call (line 24)
# JSON columns work as TEXT in SQLite automatically
```

Actually, the `JSON` type in SQLAlchemy works with SQLite natively (stored as TEXT). No patching needed. But we should add `import sa` if needed. Let me check — SQLAlchemy's JSON type already works with SQLite. No change needed to conftest.py.

- [ ] **Step 11: Run all tests**

Run: `cd backend && python -m pytest tests/ -v`
Expected: All PASS

- [ ] **Step 12: Commit**

```bash
git add backend/app/models/book.py backend/app/models/knowledge_card.py backend/app/models/card_link.py backend/app/models/reading_progress.py backend/app/models/__init__.py backend/app/schemas/book.py backend/app/schemas/knowledge_card.py backend/tests/test_models.py
git commit -m "feat: extend models for Phase 2 (metadata fields, CardLink, ReadingProgress)"
```

---

## Task 2: Metadata Enrichment Service

**Files:**
- Create: `backend/app/services/enrichment.py`
- Test: `backend/tests/test_enrichment.py`

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_enrichment.py
import pytest
from app.services.enrichment import MetadataEnrichmentService


def test_enrichment_service_exists():
    assert MetadataEnrichmentService is not None


@pytest.mark.asyncio
async def test_google_books_url_format():
    service = MetadataEnrichmentService()
    url = service._google_books_url("9780134685991")
    assert "isbn:9780134685991" in url


@pytest.mark.asyncio
async def test_open_library_search_url_format():
    service = MetadataEnrichmentService()
    url = service._open_library_search_url("Clean Code", "Robert Martin")
    assert "Clean+Code" in url or "Clean%20Code" in url
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_enrichment.py -v`
Expected: FAIL — module not found

- [ ] **Step 3: Implement MetadataEnrichmentService**

```python
# backend/app/services/enrichment.py
import httpx
import re
from pathlib import Path
from typing import Optional
from urllib.parse import quote_plus
from sqlalchemy.orm import Session

from app.models import Book


class MetadataEnrichmentService:
    """Enriches book metadata from Google Books and Open Library APIs."""

    GOOGLE_BOOKS_URL = "https://www.googleapis.com/books/v1/volumes"
    OPEN_LIBRARY_SEARCH_URL = "https://openlibrary.org/search.json"
    OPEN_LIBRARY_COVER_URL = "https://covers.openlibrary.org/b/olid"
    TIMEOUT = 5.0
    MAX_RETRIES = 3

    def __init__(self, cover_cache_dir: str = "data/covers"):
        self.cover_cache_dir = Path(cover_cache_dir)
        self.cover_cache_dir.mkdir(parents=True, exist_ok=True)

    def _google_books_url(self, isbn: str) -> str:
        return f"{self.GOOGLE_BOOKS_URL}?q=isbn:{isbn}"

    def _open_library_search_url(self, title: str, author: str) -> str:
        params = f"title={quote_plus(title)}"
        if author:
            params += f"&author={quote_plus(author)}"
        return f"{self.OPEN_LIBRARY_SEARCH_URL}?{params}&limit=1"

    async def enrich(self, db: Session, book: Book) -> bool:
        """Enrich a book's metadata. Returns True if any field was updated."""
        if book.metadata_enriched:
            return False

        updated = False

        try:
            # Try Google Books first if ISBN exists
            if book.isbn:
                updated = await self._enrich_from_google_books(db, book)

            # Fall back to Open Library
            if not updated and book.title:
                updated = await self._enrich_from_open_library(db, book)

        except Exception:
            pass  # Enrichment failure should not block import

        book.metadata_enriched = True
        if not book.metadata_source or book.metadata_source == "file":
            book.metadata_source = "file"
        db.commit()
        return updated

    async def _enrich_from_google_books(self, db: Session, book: Book) -> bool:
        url = self._google_books_url(book.isbn)
        data = await self._http_get(url)
        if not data or not data.get("items"):
            return False

        volume = data["items"][0].get("volumeInfo", {})
        updated = False

        if not book.publisher and volume.get("publisher"):
            book.publisher = volume["publisher"]
            updated = True

        if not book.publish_date and volume.get("publishedDate"):
            try:
                from datetime import datetime
                date_str = volume["publishedDate"]
                if len(date_str) == 4:
                    book.publish_date = datetime(int(date_str), 1, 1)
                elif len(date_str) == 7:
                    book.publish_date = datetime.strptime(date_str, "%Y-%m")
                else:
                    book.publish_date = datetime.strptime(date_str, "%Y-%m-%d")
                updated = True
            except (ValueError, TypeError):
                pass

        if not book.cover_url:
            thumbnail = volume.get("imageLinks", {}).get("thumbnail")
            if thumbnail:
                cover_path = await self._download_cover(thumbnail, book.id)
                if cover_path:
                    book.cover_url = str(cover_path)
                    updated = True

        if updated:
            book.metadata_source = "google_books"
        return updated

    async def _enrich_from_open_library(self, db: Session, book: Book) -> bool:
        url = self._open_library_search_url(book.title, book.author or "")
        data = await self._http_get(url)
        if not data or not data.get("docs"):
            return False

        doc = data["docs"][0]
        updated = False

        if not book.publisher and doc.get("publisher"):
            pubs = doc["publisher"]
            book.publisher = pubs[0] if isinstance(pubs, list) else pubs
            updated = True

        if not book.publish_date and doc.get("first_publish_year"):
            try:
                from datetime import datetime
                book.publish_date = datetime(doc["first_publish_year"], 1, 1)
                updated = True
            except (ValueError, TypeError):
                pass

        if not book.cover_url and doc.get("cover_i"):
            cover_url = f"https://covers.openlibrary.org/b/id/{doc['cover_i']}-L.jpg"
            cover_path = await self._download_cover(cover_url, book.id)
            if cover_path:
                book.cover_url = str(cover_path)
                updated = True

        if doc.get("key"):
            book.open_library_id = doc["key"]
            updated = True

        if updated:
            book.metadata_source = "open_library"
        return updated

    async def _http_get(self, url: str) -> Optional[dict]:
        for attempt in range(self.MAX_RETRIES):
            try:
                async with httpx.AsyncClient() as client:
                    resp = await client.get(url, timeout=self.TIMEOUT)
                    if resp.status_code == 200:
                        return resp.json()
                    if resp.status_code == 429:
                        import asyncio
                        await asyncio.sleep(2 ** attempt)
                        continue
                    return None
            except (httpx.TimeoutException, httpx.RequestError):
                if attempt < self.MAX_RETRIES - 1:
                    import asyncio
                    await asyncio.sleep(2 ** attempt)
        return None

    async def _download_cover(self, url: str, book_id) -> Optional[Path]:
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.get(url, timeout=self.TIMEOUT)
                if resp.status_code == 200:
                    ext = "jpg"
                    if "png" in resp.headers.get("content-type", ""):
                        ext = "png"
                    path = self.cover_cache_dir / f"{book_id}.{ext}"
                    path.write_bytes(resp.content)
                    return path
        except Exception:
            pass
        return None
```

- [ ] **Step 4: Run tests**

Run: `cd backend && python -m pytest tests/test_enrichment.py -v`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/enrichment.py backend/tests/test_enrichment.py
git commit -m "feat: add metadata enrichment service (Google Books + Open Library)"
```

---

## Task 3: Network Checker and AI Service Factory

**Files:**
- Create: `backend/app/services/network_checker.py`
- Create: `backend/app/services/ai/factory.py`
- Modify: `backend/app/api/ai.py`
- Test: `backend/tests/test_network_checker.py`

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_network_checker.py
import pytest
from app.services.network_checker import NetworkChecker
from app.services.ai.factory import AIServiceFactory


def test_network_checker_exists():
    assert NetworkChecker is not None


def test_ai_service_factory_exists():
    assert AIServiceFactory is not None


@pytest.mark.asyncio
async def test_network_checker_caches_result():
    checker = NetworkChecker(cache_ttl=30)
    # Should return a boolean
    result = await checker.is_online()
    assert isinstance(result, bool)
    # Second call should use cache
    result2 = await checker.is_online()
    assert result == result2
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_network_checker.py -v`
Expected: FAIL — module not found

- [ ] **Step 3: Implement NetworkChecker**

```python
# backend/app/services/network_checker.py
import time
import httpx


class NetworkChecker:
    """Checks internet connectivity with caching."""

    CHECK_URL = "https://www.google.com"
    TIMEOUT = 3.0

    def __init__(self, cache_ttl: int = 30):
        self._cache_ttl = cache_ttl
        self._cached_result: bool | None = None
        self._cache_time: float = 0

    async def is_online(self) -> bool:
        now = time.time()
        if self._cached_result is not None and (now - self._cache_time) < self._cache_ttl:
            return self._cached_result

        try:
            async with httpx.AsyncClient() as client:
                resp = await client.head(self.CHECK_URL, timeout=self.TIMEOUT, follow_redirects=True)
                self._cached_result = resp.status_code < 500
        except (httpx.TimeoutException, httpx.RequestError, Exception):
            self._cached_result = False

        self._cache_time = time.time()
        return self._cached_result

    def invalidate_cache(self):
        self._cached_result = None
        self._cache_time = 0
```

- [ ] **Step 4: Implement AIServiceFactory**

```python
# backend/app/services/ai/factory.py
from app.services.ai.base import AIServiceInterface
from app.services.ai.openai_adapter import OpenAIAdapter
from app.services.ai.claude_adapter import ClaudeAdapter
from app.services.ai.ollama_adapter import OllamaAdapter
from app.services.network_checker import NetworkChecker


class AIServiceUnavailableError(Exception):
    pass


class AIServiceFactory:
    """Creates AI service instances with automatic offline fallback."""

    def __init__(self, settings, network_checker: NetworkChecker | None = None):
        self.settings = settings
        self.network_checker = network_checker or NetworkChecker()

    async def get_service(self) -> tuple[AIServiceInterface, str]:
        """Returns (service, provider_name). provider_name indicates active engine."""
        is_online = await self.network_checker.is_online()

        if is_online:
            provider = self.settings.AI_PROVIDER
            if provider == "openai" and self.settings.OPENAI_API_KEY:
                return OpenAIAdapter(
                    api_key=self.settings.OPENAI_API_KEY,
                    base_url=self.settings.OPENAI_BASE_URL,
                ), "openai"
            elif provider == "claude" and self.settings.CLAUDE_API_KEY:
                return ClaudeAdapter(api_key=self.settings.CLAUDE_API_KEY), "claude"
            elif provider == "ollama":
                return OllamaAdapter(base_url=self.settings.OLLAMA_BASE_URL), "ollama"

        # Offline or cloud provider unavailable — try Ollama
        try:
            ollama = OllamaAdapter(base_url=self.settings.OLLAMA_BASE_URL)
            # Quick health check
            import httpx
            async with httpx.AsyncClient() as client:
                resp = await client.get(f"{self.settings.OLLAMA_BASE_URL}/api/tags", timeout=3)
                if resp.status_code == 200:
                    return ollama, "ollama"
        except Exception:
            pass

        raise AIServiceUnavailableError("No AI service available. Check network or start Ollama.")
```

- [ ] **Step 5: Update api/ai.py to use AIServiceFactory**

```python
# backend/app/api/ai.py — replace get_ai_service function
from app.services.ai.factory import AIServiceFactory, AIServiceUnavailableError
from app.services.network_checker import NetworkChecker

_network_checker = NetworkChecker()

def get_ai_factory() -> AIServiceFactory:
    return AIServiceFactory(settings, _network_checker)


@router.get("/status")
async def get_ai_status():
    factory = get_ai_factory()
    try:
        _, provider_name = await factory.get_service()
        is_online = await _network_checker.is_online()
        return {
            "provider": provider_name,
            "online": is_online,
            "available": True,
        }
    except AIServiceUnavailableError:
        return {
            "provider": "none",
            "online": False,
            "available": False,
        }


# Update generate_summary and chat_with_ai to use factory:
@router.post("/summary", response_model=SummaryResponse)
async def generate_summary(
    request: SummaryRequest,
    db: Session = Depends(get_db),
):
    from app.models import Book
    book = db.query(Book).filter(Book.id == request.book_id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    if book.summary and not request.force_regenerate:
        return SummaryResponse(book_id=book.id, summary=book.summary, tags=[])

    factory = get_ai_factory()
    try:
        ai_service, _ = await factory.get_service()
    except AIServiceUnavailableError as e:
        raise HTTPException(status_code=503, detail=str(e))

    from app.services.parser.registry import ParserRegistry
    parser = ParserRegistry()
    parsed = parser.parse(book.file_path)

    if not parsed:
        raise HTTPException(status_code=400, detail="Could not parse book file")

    summary = await ai_service.generate_summary(parsed.full_text)
    tags = await ai_service.generate_tags(parsed.full_text)

    book.summary = summary
    db.commit()

    return SummaryResponse(book_id=book.id, summary=summary, tags=tags)


@router.post("/chat", response_model=ChatResponse)
async def chat_with_ai(request: ChatRequest):
    factory = get_ai_factory()
    try:
        ai_service, _ = await factory.get_service()
    except AIServiceUnavailableError as e:
        raise HTTPException(status_code=503, detail=str(e))

    context = "\n\n".join(request.context_passages) if request.context_passages else None

    response_text = await ai_service.chat(
        messages=[{"role": m.role, "content": m.content} for m in request.messages],
        context=context,
    )

    return ChatResponse(
        message=ChatMessage(role="assistant", content=response_text),
        sources=[],
    )
```

- [ ] **Step 6: Run all tests**

Run: `cd backend && python -m pytest tests/ -v`
Expected: All PASS

- [ ] **Step 7: Commit**

```bash
git add backend/app/services/network_checker.py backend/app/services/ai/factory.py backend/app/api/ai.py backend/tests/test_network_checker.py
git commit -m "feat: add network checker and AI service factory with offline fallback"
```

---

## Task 4: Cross-Book Query

**Files:**
- Modify: `backend/app/schemas/search.py`
- Modify: `backend/app/services/search/engine.py`
- Modify: `backend/app/api/search.py`
- Test: `backend/tests/test_cross_book.py`

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_cross_book.py
import pytest
from app.schemas.search import CrossBookQuery, CrossBookResponse


def test_cross_book_query_schema():
    query = CrossBookQuery(query="machine learning", top_k=20)
    assert query.query == "machine learning"
    assert query.top_k == 20


def test_cross_book_response_schema():
    resp = CrossBookResponse(
        answer="Test answer",
        sources=[],
        query="test",
    )
    assert resp.answer == "Test answer"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_cross_book.py -v`
Expected: FAIL — cannot import CrossBookQuery

- [ ] **Step 3: Add cross-book schemas**

```python
# backend/app/schemas/search.py — add at the end
class CrossBookQuery(BaseModel):
    query: str = Field(..., min_length=1, max_length=500)
    top_k: int = Field(20, ge=1, le=100)


class CrossBookPassage(BaseModel):
    page_number: Optional[int]
    content: str
    score: float


class CrossBookSource(BaseModel):
    book_id: UUID
    book_title: str
    passages: list[CrossBookPassage]


class CrossBookResponse(BaseModel):
    answer: str
    sources: list[CrossBookSource]
    query: str
```

- [ ] **Step 4: Add cross_book_query to SearchEngine**

```python
# backend/app/services/search/engine.py — add after index_book method
from app.schemas.search import CrossBookSource, CrossBookPassage

async def cross_book_query(self, query: str, top_k: int = 20) -> tuple[str, list[CrossBookSource]]:
    """Cross-book query: semantic search + AI synthesis."""
    if not self.ai_service:
        raise ValueError("AI service required for cross-book query")

    # Get semantic search results
    results = await self._semantic_search(query, top_k)

    # Group by book, keep top 3 per book
    book_groups: dict[str, dict] = {}
    for r in results:
        bid = str(r.book_id)
        if bid not in book_groups:
            book_groups[bid] = {
                "book_id": r.book_id,
                "book_title": r.book_title,
                "passages": [],
            }
        if len(book_groups[bid]["passages"]) < 3:
            book_groups[bid]["passages"].append(r)

    sources = [
        CrossBookSource(
            book_id=g["book_id"],
            book_title=g["book_title"],
            passages=[
                CrossBookPassage(
                    page_number=p.page_number,
                    content=p.content,
                    score=p.score,
                )
                for p in g["passages"]
            ],
        )
        for g in book_groups.values()
    ]

    # Build context for AI
    context_parts = []
    for src in sources:
        for p in src.passages:
            page_ref = f"Page {p.page_number}" if p.page_number else "unknown page"
            context_parts.append(f"[{src.book_title}, {page_ref}]: {p.content[:500]}")

    context = "\n\n".join(context_parts)

    # Generate synthesized answer
    answer = await self.ai_service.chat(
        messages=[{"role": "user", "content": query}],
        context=f"Based on the following passages from multiple books, answer the user's question. Cite sources as [Book Title, Page X].\n\n{context}",
    )

    return answer, sources
```

- [ ] **Step 5: Add cross-book API endpoint**

```python
# backend/app/api/search.py — add after existing search endpoint
from app.schemas.search import CrossBookQuery, CrossBookResponse, CrossBookSource

@router.post("/cross-book", response_model=CrossBookResponse)
async def cross_book_search(
    query: CrossBookQuery,
    db: Session = Depends(get_db),
):
    from app.services.ai.factory import AIServiceFactory, AIServiceUnavailableError
    from app.services.network_checker import NetworkChecker
    from app.api.ai import get_ai_factory

    factory = get_ai_factory()
    try:
        ai_service, _ = await factory.get_service()
    except AIServiceUnavailableError as e:
        raise HTTPException(status_code=503, detail=str(e))

    engine = SearchEngine(db, ai_service)
    answer, sources = await engine.cross_book_query(
        query=query.query,
        top_k=query.top_k,
    )

    return CrossBookResponse(
        answer=answer,
        sources=sources,
        query=query.query,
    )
```

Also add `from fastapi import HTTPException` to the imports at the top of search.py.

- [ ] **Step 6: Run tests**

Run: `cd backend && python -m pytest tests/test_cross_book.py -v`
Expected: All PASS

- [ ] **Step 7: Commit**

```bash
git add backend/app/schemas/search.py backend/app/services/search/engine.py backend/app/api/search.py backend/tests/test_cross_book.py
git commit -m "feat: add cross-book query with AI synthesis"
```

---

## Task 5: Knowledge Cards API

**Files:**
- Create: `backend/app/api/knowledge_cards.py`
- Modify: `backend/app/main.py`
- Test: `backend/tests/test_knowledge_cards.py`

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_knowledge_cards.py
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_create_knowledge_card():
    response = client.post("/api/knowledge-cards/", json={
        "title": "Test Card",
        "content": "Test content",
        "card_type": "manual",
    })
    assert response.status_code == 200
    data = response.json()
    assert data["title"] == "Test Card"
    assert data["card_type"] == "manual"


def test_list_knowledge_cards():
    response = client.get("/api/knowledge-cards/")
    assert response.status_code == 200


def test_create_card_link():
    # Create two cards first
    r1 = client.post("/api/knowledge-cards/", json={"title": "Card 1", "content": "Content 1"})
    r2 = client.post("/api/knowledge-cards/", json={"title": "Card 2", "content": "Content 2"})
    card1_id = r1.json()["id"]
    card2_id = r2.json()["id"]

    # Create link
    response = client.post(f"/api/knowledge-cards/{card1_id}/links", json={
        "target_card_id": card2_id,
        "link_type": "related",
    })
    assert response.status_code == 200
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_knowledge_cards.py -v`
Expected: FAIL — 404 (endpoint doesn't exist)

- [ ] **Step 3: Implement knowledge cards API**

```python
# backend/app/api/knowledge_cards.py
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from uuid import UUID

from app.core.database import get_db
from app.models import KnowledgeCard, CardLink
from app.schemas.knowledge_card import (
    KnowledgeCardCreate, KnowledgeCardUpdate, KnowledgeCardResponse,
    CardLinkCreate, CardLinkResponse, KnowledgeCardListResponse,
)

router = APIRouter()


@router.get("/", response_model=KnowledgeCardListResponse)
def list_cards(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    card_type: str = None,
    search: str = None,
    db: Session = Depends(get_db),
):
    query = db.query(KnowledgeCard)
    if card_type:
        query = query.filter(KnowledgeCard.card_type == card_type)
    if search:
        query = query.filter(
            KnowledgeCard.title.ilike(f"%{search}%")
            | KnowledgeCard.content.ilike(f"%{search}%")
        )
    total = query.count()
    cards = query.order_by(KnowledgeCard.updated_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return KnowledgeCardListResponse(
        items=[KnowledgeCardResponse.model_validate(c) for c in cards],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{card_id}", response_model=KnowledgeCardResponse)
def get_card(card_id: UUID, db: Session = Depends(get_db)):
    card = db.query(KnowledgeCard).filter(KnowledgeCard.id == card_id).first()
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    return KnowledgeCardResponse.model_validate(card)


@router.post("/", response_model=KnowledgeCardResponse)
def create_card(data: KnowledgeCardCreate, db: Session = Depends(get_db)):
    card = KnowledgeCard(**data.model_dump())
    db.add(card)
    db.commit()
    db.refresh(card)
    return KnowledgeCardResponse.model_validate(card)


@router.put("/{card_id}", response_model=KnowledgeCardResponse)
def update_card(card_id: UUID, data: KnowledgeCardUpdate, db: Session = Depends(get_db)):
    card = db.query(KnowledgeCard).filter(KnowledgeCard.id == card_id).first()
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(card, key, value)
    db.commit()
    db.refresh(card)
    return KnowledgeCardResponse.model_validate(card)


@router.delete("/{card_id}")
def delete_card(card_id: UUID, db: Session = Depends(get_db)):
    card = db.query(KnowledgeCard).filter(KnowledgeCard.id == card_id).first()
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    db.delete(card)
    db.commit()
    return {"status": "deleted"}


@router.post("/{card_id}/links", response_model=CardLinkResponse)
def create_link(card_id: UUID, data: CardLinkCreate, db: Session = Depends(get_db)):
    source = db.query(KnowledgeCard).filter(KnowledgeCard.id == card_id).first()
    if not source:
        raise HTTPException(status_code=404, detail="Source card not found")
    target = db.query(KnowledgeCard).filter(KnowledgeCard.id == data.target_card_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Target card not found")
    link = CardLink(source_card_id=card_id, target_card_id=data.target_card_id, link_type=data.link_type)
    db.add(link)
    db.commit()
    db.refresh(link)
    return CardLinkResponse.model_validate(link)


@router.get("/{card_id}/links", response_model=list[CardLinkResponse])
def list_links(card_id: UUID, db: Session = Depends(get_db)):
    links = db.query(CardLink).filter(
        (CardLink.source_card_id == card_id) | (CardLink.target_card_id == card_id)
    ).all()
    return [CardLinkResponse.model_validate(l) for l in links]


@router.delete("/links/{link_id}")
def delete_link(link_id: UUID, db: Session = Depends(get_db)):
    link = db.query(CardLink).filter(CardLink.id == link_id).first()
    if not link:
        raise HTTPException(status_code=404, detail="Link not found")
    db.delete(link)
    db.commit()
    return {"status": "deleted"}
```

- [ ] **Step 4: Register router in main.py**

```python
# backend/app/main.py — add import and router
from app.api import books, tags, bookshelves, search, ai, annotations, ws, knowledge_cards

app.include_router(knowledge_cards.router, prefix="/api/knowledge-cards", tags=["knowledge-cards"])
```

- [ ] **Step 5: Run tests**

Run: `cd backend && python -m pytest tests/test_knowledge_cards.py -v`
Expected: All PASS

- [ ] **Step 6: Commit**

```bash
git add backend/app/api/knowledge_cards.py backend/app/main.py backend/tests/test_knowledge_cards.py
git commit -m "feat: add knowledge cards CRUD API with card linking"
```

---

## Task 6: Import Enrichment Integration + Reading Progress API

**Files:**
- Modify: `backend/app/services/import_service.py`
- Modify: `backend/app/api/books.py`
- Test: Modify existing tests

- [ ] **Step 1: Update import_service.py to call enrichment**

```python
# backend/app/services/import_service.py — add enrichment after book creation
# In import_file method, after book is committed, add:
from app.services.enrichment import MetadataEnrichmentService

async def import_file_enriched(self, file_path: str) -> Optional[Book]:
    """Import a single file and enrich metadata."""
    book = self.import_file(file_path)
    if book:
        enricher = MetadataEnrichmentService()
        await enricher.enrich(self.db, book)
    return book
```

- [ ] **Step 2: Add file serving endpoint to books.py**

The PdfViewer and EpubViewer need to load files via HTTP. Add a static file endpoint:

```python
# backend/app/api/books.py — add at the top after imports
from fastapi.responses import FileResponse
from pathlib import Path

@router.get("/file")
def serve_book_file(file_path: str):
    """Serve a book file for the reader."""
    p = Path(file_path)
    if not p.exists() or not p.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(p)
```

- [ ] **Step 3: Add reading progress endpoints to books.py**

```python
# backend/app/api/books.py — add at the end
from app.models import ReadingProgress

@router.get("/{book_id}/progress")
def get_reading_progress(book_id: UUID, db: Session = Depends(get_db)):
    progress = db.query(ReadingProgress).filter(ReadingProgress.book_id == book_id).first()
    if not progress:
        return {"current_page": 0, "current_cfi": None, "progress_percent": 0.0}
    return {
        "current_page": progress.current_page,
        "current_cfi": progress.current_cfi,
        "progress_percent": progress.progress_percent,
    }


@router.put("/{book_id}/progress")
def update_reading_progress(
    book_id: UUID,
    current_page: int = None,
    current_cfi: str = None,
    progress_percent: float = None,
    db: Session = Depends(get_db),
):
    progress = db.query(ReadingProgress).filter(ReadingProgress.book_id == book_id).first()
    if not progress:
        progress = ReadingProgress(book_id=book_id)
        db.add(progress)
    if current_page is not None:
        progress.current_page = current_page
    if current_cfi is not None:
        progress.current_cfi = current_cfi
    if progress_percent is not None:
        progress.progress_percent = progress_percent
    db.commit()
    return {"status": "ok"}
```

- [ ] **Step 3: Run all backend tests**

Run: `cd backend && python -m pytest tests/ -v`
Expected: All PASS

- [ ] **Step 4: Commit**

```bash
git add backend/app/services/import_service.py backend/app/api/books.py
git commit -m "feat: add import enrichment integration and reading progress API"
```

---

## Task 7: Frontend — Knowledge Cards Page

**Files:**
- Create: `frontend/src/services/knowledgeCardApi.ts`
- Create: `frontend/src/stores/knowledgeCardStore.ts`
- Create: `frontend/src/pages/KnowledgeCards/KnowledgeCardsPage.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/Layout/Sidebar.tsx`

- [ ] **Step 1: Create knowledge card API service**

```typescript
// frontend/src/services/knowledgeCardApi.ts
import axios from 'axios';

const api = axios.create({ baseURL: '/api/knowledge-cards' });

export interface KnowledgeCard {
  id: string;
  title: string;
  content: string;
  source_book_id: string | null;
  source_passage: string | null;
  annotation: string | null;
  card_type: string;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface CardLink {
  id: string;
  source_card_id: string;
  target_card_id: string;
  link_type: string;
  created_at: string;
  target_card?: KnowledgeCard;
}

export interface KnowledgeCardListResponse {
  items: KnowledgeCard[];
  total: number;
  page: number;
  page_size: number;
}

export const knowledgeCardApi = {
  list: (params?: { page?: number; page_size?: number; card_type?: string; search?: string }) =>
    api.get<KnowledgeCardListResponse>('/', { params }),
  get: (id: string) => api.get<KnowledgeCard>(`/${id}`),
  create: (data: Partial<KnowledgeCard>) => api.post<KnowledgeCard>('/', data),
  update: (id: string, data: Partial<KnowledgeCard>) => api.put<KnowledgeCard>(`/${id}`, data),
  delete: (id: string) => api.delete(`/${id}`),
  createLink: (cardId: string, data: { target_card_id: string; link_type: string }) =>
    api.post<CardLink>(`/${cardId}/links`, data),
  listLinks: (cardId: string) => api.get<CardLink[]>(`/${cardId}/links`),
  deleteLink: (linkId: string) => api.delete(`/links/${linkId}`),
};
```

- [ ] **Step 2: Create knowledge card store**

```typescript
// frontend/src/stores/knowledgeCardStore.ts
import { create } from 'zustand';
import { knowledgeCardApi, KnowledgeCard, KnowledgeCardListResponse } from '../services/knowledgeCardApi';

interface KnowledgeCardState {
  cards: KnowledgeCard[];
  total: number;
  page: number;
  pageSize: number;
  loading: boolean;
  searchQuery: string;
  cardTypeFilter: string | null;
  fetchCards: () => Promise<void>;
  setSearchQuery: (query: string) => void;
  setCardTypeFilter: (type: string | null) => void;
  setPage: (page: number) => void;
}

export const useKnowledgeCardStore = create<KnowledgeCardState>((set, get) => ({
  cards: [],
  total: 0,
  page: 1,
  pageSize: 20,
  loading: false,
  searchQuery: '',
  cardTypeFilter: null,
  fetchCards: async () => {
    set({ loading: true });
    try {
      const { page, pageSize, searchQuery, cardTypeFilter } = get();
      const response = await knowledgeCardApi.list({
        page,
        page_size: pageSize,
        search: searchQuery || undefined,
        card_type: cardTypeFilter || undefined,
      });
      set({ cards: response.data.items, total: response.data.total, loading: false });
    } catch (error) {
      set({ loading: false });
    }
  },
  setSearchQuery: (query) => set({ searchQuery: query }),
  setCardTypeFilter: (type) => set({ cardTypeFilter: type }),
  setPage: (page) => set({ page }),
}));
```

- [ ] **Step 3: Create KnowledgeCardsPage**

```typescript
// frontend/src/pages/KnowledgeCards/KnowledgeCardsPage.tsx
import { useState, useEffect } from 'react';
import { Card, Input, Select, Button, Empty, Spin, Pagination, Drawer, Tag, Space, message, Modal, Form, Popconfirm } from 'antd';
import { PlusOutlined, DeleteOutlined, LinkOutlined } from '@ant-design/icons';
import { useKnowledgeCardStore } from '../../stores/knowledgeCardStore';
import { knowledgeCardApi, KnowledgeCard } from '../../services/knowledgeCardApi';

const cardTypeColors: Record<string, string> = {
  search_result: 'blue',
  ai_chat: 'purple',
  manual: 'green',
};

const cardTypeLabels: Record<string, string> = {
  search_result: '搜索结果',
  ai_chat: 'AI 对话',
  manual: '手动创建',
};

export default function KnowledgeCardsPage() {
  const { cards, total, page, pageSize, loading, searchQuery, cardTypeFilter, fetchCards, setSearchQuery, setCardTypeFilter, setPage } = useKnowledgeCardStore();
  const [selectedCard, setSelectedCard] = useState<KnowledgeCard | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => { fetchCards(); }, [page, searchQuery, cardTypeFilter]);

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      await knowledgeCardApi.create(values);
      message.success('卡片已创建');
      setShowCreate(false);
      form.resetFields();
      fetchCards();
    } catch (error) {
      message.error('创建失败');
    }
  };

  const handleDelete = async (id: string) => {
    await knowledgeCardApi.delete(id);
    message.success('已删除');
    fetchCards();
  };

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ margin: 0 }}>知识卡片</h2>
        <Space>
          <Input.Search placeholder="搜索卡片" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onSearch={fetchCards} style={{ width: 200 }} />
          <Select value={cardTypeFilter} onChange={setCardTypeFilter} allowClear placeholder="类型筛选" style={{ width: 120 }} options={[
            { value: 'search_result', label: '搜索结果' },
            { value: 'ai_chat', label: 'AI 对话' },
            { value: 'manual', label: '手动创建' },
          ]} />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setShowCreate(true)}>新建卡片</Button>
        </Space>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48 }}><Spin size="large" /></div>
      ) : cards.length === 0 ? (
        <Empty description="暂无知识卡片" />
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {cards.map((card) => (
              <Card
                key={card.id}
                hoverable
                onClick={() => setSelectedCard(card)}
                title={<Space><span style={{ fontSize: 14 }}>{card.title}</span><Tag color={cardTypeColors[card.card_type]}>{cardTypeLabels[card.card_type]}</Tag></Space>}
                extra={<Popconfirm title="确定删除？" onConfirm={(e) => { e?.stopPropagation(); handleDelete(card.id); }}><Button type="text" icon={<DeleteOutlined />} size="small" onClick={(e) => e.stopPropagation()} /></Popconfirm>}
                style={{ height: '100%' }}
              >
                <p style={{ color: '#aaa', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>{card.content}</p>
                {card.tags.length > 0 && <div style={{ marginTop: 8 }}>{card.tags.map((t) => <Tag key={t} style={{ fontSize: 11 }}>{t}</Tag>)}</div>}
              </Card>
            ))}
          </div>
          <div style={{ textAlign: 'center', marginTop: 24 }}>
            <Pagination current={page} total={total} pageSize={pageSize} onChange={setPage} showSizeChanger={false} />
          </div>
        </>
      )}

      <Drawer title="卡片详情" open={!!selectedCard} onClose={() => setSelectedCard(null)} width={500}>
        {selectedCard && (
          <div>
            <h3>{selectedCard.title}</h3>
            <Tag color={cardTypeColors[selectedCard.card_type]}>{cardTypeLabels[selectedCard.card_type]}</Tag>
            <p style={{ marginTop: 16, whiteSpace: 'pre-wrap' }}>{selectedCard.content}</p>
            {selectedCard.annotation && (
              <div style={{ marginTop: 16, padding: 12, background: '#1a1a2e', borderRadius: 8 }}>
                <strong>批注：</strong>
                <p>{selectedCard.annotation}</p>
              </div>
            )}
            {selectedCard.source_passage && (
              <div style={{ marginTop: 16, padding: 12, background: '#1a1a2e', borderRadius: 8 }}>
                <strong>出处：</strong>
                <p style={{ color: '#aaa', fontSize: 13 }}>{selectedCard.source_passage}</p>
              </div>
            )}
          </div>
        )}
      </Drawer>

      <Modal title="新建知识卡片" open={showCreate} onOk={handleCreate} onCancel={() => setShowCreate(false)}>
        <Form form={form} layout="vertical">
          <Form.Item name="title" label="标题" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="content" label="内容" rules={[{ required: true }]}><Input.TextArea rows={4} /></Form.Item>
          <Form.Item name="annotation" label="批注"><Input.TextArea rows={2} /></Form.Item>
          <Form.Item name="card_type" initialValue="manual" hidden><Input /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
```

- [ ] **Step 4: Update App.tsx — add route**

```typescript
// frontend/src/App.tsx — add import and route
import KnowledgeCardsPage from './pages/KnowledgeCards/KnowledgeCardsPage';

// Inside Routes, add:
<Route path="knowledge-cards" element={<KnowledgeCardsPage />} />
```

- [ ] **Step 5: Update Sidebar.tsx — add entry**

```typescript
// frontend/src/components/Layout/Sidebar.tsx — add import
import { BookOutlined, StarOutlined, HistoryOutlined, FolderOutlined, PlusOutlined, FileTextOutlined } from '@ant-design/icons';

// Add to sidebarItems after the shelves group:
{ type: 'divider' as const },
{ key: 'knowledge-cards', icon: <FileTextOutlined />, label: '知识卡片' },
```

- [ ] **Step 6: Run frontend type check**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 7: Commit**

```bash
git add frontend/src/services/knowledgeCardApi.ts frontend/src/stores/knowledgeCardStore.ts frontend/src/pages/KnowledgeCards/KnowledgeCardsPage.tsx frontend/src/App.tsx frontend/src/components/Layout/Sidebar.tsx
git commit -m "feat: add knowledge cards page with create, view, delete, link"
```

---

## Task 8: Frontend — Cross-Book Query and AI Status

**Files:**
- Modify: `frontend/src/pages/Search/SearchPage.tsx`
- Modify: `frontend/src/services/aiApi.ts`
- Modify: `frontend/src/stores/appStore.ts`
- Modify: `frontend/src/components/Layout/StatusBar.tsx`

- [ ] **Step 1: Update aiApi.ts — add cross-book and status methods**

```typescript
// frontend/src/services/aiApi.ts — add to aiApi object
export interface CrossBookSource {
  book_id: string;
  book_title: string;
  passages: { page_number: number | null; content: string; score: number }[];
}

export interface CrossBookResponse {
  answer: string;
  sources: CrossBookSource[];
  query: string;
}

export interface AiStatus {
  provider: string;
  online: boolean;
  available: boolean;
}

export const aiApi = {
  getConfig: () => api.get<AiConfig>('/config'),
  getStatus: () => api.get<AiStatus>('/status'),
  generateSummary: (bookId: string, forceRegenerate = false) =>
    api.post('/summary', { book_id: bookId, force_regenerate: forceRegenerate }),
  chat: (messages: { role: string; content: string }[], bookId?: string) =>
    api.post('/chat', { messages, book_id: bookId }),
  crossBookQuery: (query: string, topK = 20) =>
    api.post<CrossBookResponse>('/search/cross-book', { query, top_k: topK }),
};
```

Wait — cross-book is under `/api/search`, not `/api/ai`. Let me fix:

```typescript
// frontend/src/services/aiApi.ts — full replacement
import axios from 'axios';

const api = axios.create({ baseURL: '/api/ai' });
const searchApi = axios.create({ baseURL: '/api/search' });

export interface AiConfig {
  provider: string;
  has_openai_key: boolean;
  has_claude_key: boolean;
  ollama_url: string;
}

export interface AiStatus {
  provider: string;
  online: boolean;
  available: boolean;
}

export interface CrossBookSource {
  book_id: string;
  book_title: string;
  passages: { page_number: number | null; content: string; score: number }[];
}

export interface CrossBookResponse {
  answer: string;
  sources: CrossBookSource[];
  query: string;
}

export const aiApi = {
  getConfig: () => api.get<AiConfig>('/config'),
  getStatus: () => api.get<AiStatus>('/status'),
  generateSummary: (bookId: string, forceRegenerate = false) =>
    api.post('/summary', { book_id: bookId, force_regenerate: forceRegenerate }),
  chat: (messages: { role: string; content: string }[], bookId?: string) =>
    api.post('/chat', { messages, book_id: bookId }),
  crossBookQuery: (query: string, topK = 20) =>
    searchApi.post<CrossBookResponse>('/cross-book', { query, top_k: topK }),
};
```

- [ ] **Step 2: Update appStore.ts — add AI status**

```typescript
// frontend/src/stores/appStore.ts — add aiStatus to state
interface AppState {
  currentPage: string;
  sidebarCollapsed: boolean;
  importProgress: { current: number; total: number; file: string } | null;
  aiStatus: { provider: string; online: boolean; available: boolean } | null;
  setCurrentPage: (page: string) => void;
  toggleSidebar: () => void;
  setImportProgress: (progress: { current: number; total: number; file: string } | null) => void;
  setAiStatus: (status: { provider: string; online: boolean; available: boolean } | null) => void;
  fetchAiStatus: () => Promise<void>;
}

export const useAppStore = create<AppState>((set) => ({
  currentPage: 'library',
  sidebarCollapsed: false,
  importProgress: null,
  aiStatus: null,
  setCurrentPage: (page) => set({ currentPage: page }),
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setImportProgress: (progress) => set({ importProgress: progress }),
  setAiStatus: (status) => set({ aiStatus: status }),
  fetchAiStatus: async () => {
    try {
      const { aiApi } = await import('../services/aiApi');
      const response = await aiApi.getStatus();
      set({ aiStatus: response.data });
    } catch {
      set({ aiStatus: { provider: 'none', online: false, available: false } });
    }
  },
}));
```

- [ ] **Step 3: Update StatusBar.tsx — show AI status**

```typescript
// frontend/src/components/Layout/StatusBar.tsx
import { useEffect } from 'react';
import { Tag } from 'antd';
import { useAppStore } from '../../stores/appStore';

const providerLabels: Record<string, string> = {
  openai: 'OpenAI',
  claude: 'Claude',
  ollama: 'Ollama',
  none: '不可用',
};

export default function StatusBar() {
  const importProgress = useAppStore((state) => state.importProgress);
  const aiStatus = useAppStore((state) => state.aiStatus);
  const fetchAiStatus = useAppStore((state) => state.fetchAiStatus);

  useEffect(() => {
    fetchAiStatus();
    const interval = setInterval(fetchAiStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ height: 24, display: 'flex', alignItems: 'center', padding: '0 16px', background: '#0d0d0d', borderTop: '1px solid #303030', fontSize: 12, color: '#888', justifyContent: 'space-between' }}>
      <span>
        {importProgress ? (
          `导入中: ${importProgress.current}/${importProgress.total} - ${importProgress.file}`
        ) : (
          '就绪'
        )}
      </span>
      <span>
        AI: {aiStatus ? (
          <Tag color={aiStatus.available ? 'green' : 'red'} style={{ fontSize: 11, padding: '0 4px', lineHeight: '16px' }}>
            {providerLabels[aiStatus.provider] || aiStatus.provider} ({aiStatus.online ? '在线' : '离线'})
          </Tag>
        ) : (
          <Tag style={{ fontSize: 11 }}>检测中...</Tag>
        )}
      </span>
    </div>
  );
}
```

- [ ] **Step 4: Update SearchPage.tsx — add cross-book query tab**

```typescript
// frontend/src/pages/Search/SearchPage.tsx
import { useState } from 'react';
import { Input, Tabs, Card, Empty, Spin, Tag, message } from 'antd';
import { SearchOutlined, BookOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { aiApi, CrossBookSource } from '../../services/aiApi';
import { useBookStore } from '../../stores/bookStore';
import BookCard from '../../components/BookCard';
import { Book } from '../../services/bookApi';

export default function SearchPage() {
  const navigate = useNavigate();
  const { books, fetchBooks, searchQuery, setSearchQuery } = useBookStore();
  const [crossBookQuery, setCrossBookQuery] = useState('');
  const [crossBookLoading, setCrossBookLoading] = useState(false);
  const [crossBookAnswer, setCrossBookAnswer] = useState('');
  const [crossBookSources, setCrossBookSources] = useState<CrossBookSource[]>([]);

  const handleCrossBookSearch = async () => {
    if (!crossBookQuery.trim()) return;
    setCrossBookLoading(true);
    try {
      const response = await aiApi.crossBookQuery(crossBookQuery);
      setCrossBookAnswer(response.data.answer);
      setCrossBookSources(response.data.sources);
    } catch (error) {
      message.error('跨书查询失败，请检查 AI 服务');
    } finally {
      setCrossBookLoading(false);
    }
  };

  const items = [
    {
      key: 'search',
      label: '搜索',
      children: (
        <div>
          <Input.Search
            placeholder="搜索书名、作者、ISBN"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onSearch={fetchBooks}
            style={{ marginBottom: 24 }}
            size="large"
          />
          {books.length === 0 ? (
            <Empty description="输入关键词搜索" />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16 }}>
              {books.map((book) => (
                <BookCard key={book.id} book={book} onClick={(b: Book) => navigate(`/reader/${b.id}`)} />
              ))}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'cross-book',
      label: '跨书查询',
      children: (
        <div>
          <Input.Search
            placeholder="用自然语言提问，AI 会从多本书中综合答案"
            value={crossBookQuery}
            onChange={(e) => setCrossBookQuery(e.target.value)}
            onSearch={handleCrossBookSearch}
            loading={crossBookLoading}
            style={{ marginBottom: 24 }}
            size="large"
          />
          {crossBookLoading ? (
            <div style={{ textAlign: 'center', padding: 48 }}><Spin size="large" /></div>
          ) : crossBookAnswer ? (
            <div>
              <Card title="AI 综合答案" style={{ marginBottom: 16 }}>
                <p style={{ whiteSpace: 'pre-wrap' }}>{crossBookAnswer}</p>
              </Card>
              <h4>来源 ({crossBookSources.length} 本书)</h4>
              {crossBookSources.map((src) => (
                <Card key={src.book_id} size="small" style={{ marginBottom: 8 }} title={<><BookOutlined /> {src.book_title}</>} extra={<Tag>{src.passages.length} 段落</Tag>}>
                  {src.passages.map((p, i) => (
                    <div key={i} style={{ padding: '4px 0', borderBottom: i < src.passages.length - 1 ? '1px solid #303030' : 'none' }}>
                      {p.page_number && <Tag style={{ fontSize: 11 }}>Page {p.page_number}</Tag>}
                      <span style={{ fontSize: 13, color: '#aaa' }}>{p.content.slice(0, 200)}...</span>
                    </div>
                  ))}
                </Card>
              ))}
            </div>
          ) : (
            <Empty description="输入问题开始跨书查询" />
          )}
        </div>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <h2>搜索</h2>
      <Tabs items={items} />
    </div>
  );
}
```

- [ ] **Step 5: Run frontend type check**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/Search/SearchPage.tsx frontend/src/services/aiApi.ts frontend/src/stores/appStore.ts frontend/src/components/Layout/StatusBar.tsx
git commit -m "feat: add cross-book query tab and AI status indicator"
```

---

## Task 9: PDF Reader (react-pdf)

**Files:**
- Create: `frontend/src/components/PdfViewer.tsx`
- Modify: `frontend/src/pages/Reader/ReaderPage.tsx`

- [ ] **Step 1: Create PdfViewer component**

```typescript
// frontend/src/components/PdfViewer.tsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface TocItem {
  title: string;
  pageNumber: number;
  items?: TocItem[];
}

interface PdfViewerProps {
  filePath: string;
  onPageChange?: (page: number, total: number) => void;
  onTocLoad?: (toc: TocItem[]) => void;
  initialPage?: number;
}

export default function PdfViewer({ filePath, onPageChange, onTocLoad, initialPage = 1 }: PdfViewerProps) {
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [scale, setScale] = useState(1.0);
  const containerRef = useRef<HTMLDivElement>(null);

  const onDocumentLoadSuccess = useCallback(async (pdf: any) => {
    setNumPages(pdf.numPages);
    onPageChange?.(currentPage, pdf.numPages);

    // Extract outline (TOC)
    try {
      const outline = await pdf.getOutline();
      if (outline && outline.length > 0 && onTocLoad) {
        const toc = await resolveOutline(pdf, outline);
        onTocLoad(toc);
      }
    } catch {
      // No outline available
    }
  }, [onPageChange, onTocLoad, currentPage]);

  const resolveOutline = async (pdf: any, outline: any[]): Promise<TocItem[]> => {
    const items: TocItem[] = [];
    for (const item of outline) {
      let pageNumber = 0;
      try {
        if (item.dest) {
          const dest = typeof item.dest === 'string' ? await pdf.getDestination(item.dest) : item.dest;
          if (dest) {
            const pageIndex = await pdf.getPageIndex(dest[0]);
            pageNumber = pageIndex + 1;
          }
        }
      } catch {}
      items.push({
        title: item.title,
        pageNumber,
        items: item.items?.length ? await resolveOutline(pdf, item.items) : undefined,
      });
    }
    return items;
  };

  const goToPage = (page: number) => {
    if (page >= 1 && page <= numPages) {
      setCurrentPage(page);
      onPageChange?.(page, numPages);
    }
  };

  const handleZoomIn = () => setScale((s) => Math.min(s + 0.2, 2.0));
  const handleZoomOut = () => setScale((s) => Math.max(s - 0.2, 0.5));
  const handleFitWidth = () => {
    if (containerRef.current) {
      const containerWidth = containerRef.current.clientWidth - 48;
      setScale(containerWidth / 612); // 612 = standard PDF width in points
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        goToPage(currentPage - 1);
      } else if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        e.preventDefault();
        goToPage(currentPage + 1);
      } else if (e.ctrlKey && e.key === '=') {
        e.preventDefault();
        handleZoomIn();
      } else if (e.ctrlKey && e.key === '-') {
        e.preventDefault();
        handleZoomOut();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPage, numPages]);

  // Expose navigation methods via ref-like approach
  useEffect(() => {
    (window as any).__pdfViewer = { goToPage, handleZoomIn, handleZoomOut, handleFitWidth, getScale: () => scale, getCurrentPage: () => currentPage, getNumPages: () => numPages };
  }, [currentPage, numPages, scale]);

  const fileUrl = filePath.startsWith('http') ? filePath : `/api/books/file?file_path=${encodeURIComponent(filePath)}`;

  return (
    <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', overflow: 'auto', height: '100%', padding: 24 }}>
      <Document file={fileUrl} onLoadSuccess={onDocumentLoadSuccess} onLoadError={() => console.error('PDF load error')}>
        <Page
          pageNumber={currentPage}
          scale={scale}
          renderTextLayer={true}
          renderAnnotationLayer={true}
        />
      </Document>
    </div>
  );
}
```

- [ ] **Step 2: Update ReaderPage.tsx**

```typescript
// frontend/src/pages/Reader/ReaderPage.tsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Drawer, List, Spin, message, Space, InputNumber, Tag } from 'antd';
import { ArrowLeftOutlined, BookOutlined, StarOutlined, LeftOutlined, RightOutlined, ZoomInOutlined, ZoomOutOutlined, FullscreenOutlined } from '@ant-design/icons';
import { bookApi, Book } from '../../services/bookApi';
import PdfViewer from '../../components/PdfViewer';

interface TocItem {
  title: string;
  pageNumber: number;
  items?: TocItem[];
}

export default function ReaderPage() {
  const { bookId } = useParams<{ bookId: string }>();
  const navigate = useNavigate();
  const [book, setBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState(true);
  const [showToc, setShowToc] = useState(false);
  const [toc, setToc] = useState<TocItem[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [zoom, setZoom] = useState(100);

  useEffect(() => {
    if (bookId) {
      loadBook(bookId);
      loadProgress(bookId);
    }
  }, [bookId]);

  const loadBook = async (id: string) => {
    try {
      const response = await bookApi.get(id);
      setBook(response.data);
    } catch (error) {
      message.error('加载图书失败');
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const loadProgress = async (id: string) => {
    try {
      const response = await bookApi.getProgress(id);
      if (response.data.current_page > 0) {
        setCurrentPage(response.data.current_page);
      }
    } catch {}
  };

  const saveProgress = async (page: number) => {
    if (!bookId) return;
    try {
      const percent = totalPages > 0 ? Math.round((page / totalPages) * 100) : 0;
      await bookApi.updateProgress(bookId, { current_page: page, progress_percent: percent });
    } catch {}
  };

  const handlePageChange = (page: number, total: number) => {
    setCurrentPage(page);
    setTotalPages(total);
    saveProgress(page);
  };

  const goToPage = (page: number) => {
    (window as any).__pdfViewer?.goToPage(page);
  };

  const handleZoomIn = () => {
    const newZoom = Math.min(zoom + 20, 200);
    setZoom(newZoom);
    (window as any).__pdfViewer?.handleZoomIn();
  };

  const handleZoomOut = () => {
    const newZoom = Math.max(zoom - 20, 50);
    setZoom(newZoom);
    (window as any).__pdfViewer?.handleZoomOut();
  };

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}><Spin size="large" /></div>;
  }

  if (!book) {
    return <div>图书未找到</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '8px 16px', background: '#141414', borderBottom: '1px solid #303030', gap: 8 }}>
        <Button icon={<ArrowLeftOutlined />} type="text" onClick={() => navigate('/')} />
        <span style={{ flex: 1, textAlign: 'center', fontSize: 14 }}>{book.title}</span>
        <Space>
          <Button icon={<LeftOutlined />} type="text" onClick={() => goToPage(currentPage - 1)} disabled={currentPage <= 1} />
          <InputNumber
            min={1}
            max={totalPages || 1}
            value={currentPage}
            onChange={(v) => v && goToPage(v)}
            size="small"
            style={{ width: 60 }}
          />
          <span style={{ color: '#888', fontSize: 12 }}>/ {totalPages}</span>
          <Button icon={<RightOutlined />} type="text" onClick={() => goToPage(currentPage + 1)} disabled={currentPage >= totalPages} />
          <span style={{ width: 1, height: 16, background: '#303030' }} />
          <Button icon={<ZoomOutOutlined />} type="text" onClick={handleZoomOut} />
          <Tag style={{ fontSize: 11 }}>{zoom}%</Tag>
          <Button icon={<ZoomInOutlined />} type="text" onClick={handleZoomIn} />
          <span style={{ width: 1, height: 16, background: '#303030' }} />
          <Button icon={<BookOutlined />} type="text" onClick={() => setShowToc(true)} />
          <Button icon={<StarOutlined />} type="text" />
        </Space>
      </div>

      {/* Content area */}
      <div style={{ flex: 1, overflow: 'hidden', background: '#0a0a0a' }}>
        {book.file_format === 'pdf' ? (
          <PdfViewer
            filePath={book.file_path}
            onPageChange={handlePageChange}
            onTocLoad={setToc}
            initialPage={currentPage}
          />
        ) : book.file_format === 'epub' ? (
          <div style={{ textAlign: 'center', color: '#888', padding: 48 }}>
            <p>EPUB 阅读器将在后续任务中实现</p>
            <p>文件路径: {book.file_path}</p>
          </div>
        ) : (
          <div style={{ textAlign: 'center', color: '#888', padding: 48 }}>
            <p>暂不支持此格式的阅读</p>
          </div>
        )}
      </div>

      {/* TOC Drawer */}
      <Drawer title="目录" placement="right" onClose={() => setShowToc(false)} open={showToc} width={300}>
        <List
          dataSource={toc}
          renderItem={(item: TocItem) => (
            <List.Item
              style={{ cursor: 'pointer', padding: '8px 0' }}
              onClick={() => { goToPage(item.pageNumber); setShowToc(false); }}
            >
              <span style={{ fontSize: 13 }}>{item.title}</span>
              <span style={{ color: '#888', fontSize: 11, marginLeft: 'auto' }}>P.{item.pageNumber}</span>
            </List.Item>
          )}
        />
      </Drawer>
    </div>
  );
}
```

- [ ] **Step 3: Add progress API to bookApi.ts**

```typescript
// frontend/src/services/bookApi.ts — add to bookApi object
getProgress: (id: string) => api.get(`/books/${id}/progress`),
updateProgress: (id: string, data: { current_page?: number; current_cfi?: string; progress_percent?: number }) =>
  api.put(`/books/${id}/progress`, data),
```

- [ ] **Step 4: Run frontend type check**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/PdfViewer.tsx frontend/src/pages/Reader/ReaderPage.tsx frontend/src/services/bookApi.ts
git commit -m "feat: add PDF reader with react-pdf, TOC, zoom, page navigation"
```

---

## Task 10: EPUB Reader (epub.js)

**Files:**
- Create: `frontend/src/components/EpubViewer.tsx`
- Modify: `frontend/src/pages/Reader/ReaderPage.tsx`

- [ ] **Step 1: Create EpubViewer component**

```typescript
// frontend/src/components/EpubViewer.tsx
import { useEffect, useRef, useState, useCallback } from 'react';
import ePub from 'epubjs';

interface TocItem {
  title: string;
  href: string;
  pageNumber: number;
}

interface EpubViewerProps {
  filePath: string;
  onLocationChange?: (cfi: string, progress: number) => void;
  onTocLoad?: (toc: TocItem[]) => void;
  initialCfi?: string;
  fontSize?: number;
  darkMode?: boolean;
}

export default function EpubViewer({ filePath, onLocationChange, onTocLoad, initialCfi, fontSize = 16, darkMode = true }: EpubViewerProps) {
  const viewerRef = useRef<HTMLDivElement>(null);
  const bookRef = useRef<any>(null);
  const renditionRef = useRef<any>(null);
  const [ready, setReady] = useState(false);

  const fileUrl = filePath.startsWith('http') ? filePath : `/api/books/file?file_path=${encodeURIComponent(filePath)}`;

  useEffect(() => {
    if (!viewerRef.current) return;

    const book = ePub(fileUrl);
    bookRef.current = book;

    const rendition = book.renderTo(viewerRef.current, {
      width: '100%',
      height: '100%',
      spread: 'none',
    });
    renditionRef.current = rendition;

    // Apply theme
    rendition.themes.default({
      body: {
        color: darkMode ? '#e0e0e0' : '#333',
        background: darkMode ? '#0a0a0a' : '#fff',
        'font-size': `${fontSize}px`,
        'line-height': '1.6',
      },
    });

    // Display initial position
    if (initialCfi) {
      rendition.display(initialCfi);
    } else {
      rendition.display();
    }

    // Track location changes
    rendition.on('relocated', (location: any) => {
      if (location?.start) {
        const progress = book.locations?.percentageFromCfi(location.start.cfi) || 0;
        onLocationChange?.(location.start.cfi, Math.round(progress * 100));
      }
    });

    // Load TOC
    book.ready.then(() => {
      const navigation = book.navigation;
      if (navigation?.toc) {
        const toc = navigation.toc.map((item: any, i: number) => ({
          title: item.label?.trim() || `Chapter ${i + 1}`,
          href: item.href,
          pageNumber: i + 1,
        }));
        onTocLoad?.(toc);
      }
      // Generate locations for progress tracking
      book.locations.generate(1024).then(() => setReady(true));
    });

    return () => {
      book.destroy();
    };
  }, [fileUrl]);

  // Update theme when props change
  useEffect(() => {
    if (renditionRef.current) {
      renditionRef.current.themes.default({
        body: {
          color: darkMode ? '#e0e0e0' : '#333',
          background: darkMode ? '#0a0a0a' : '#fff',
          'font-size': `${fontSize}px`,
        },
      });
    }
  }, [fontSize, darkMode]);

  // Navigation methods
  const goNext = useCallback(() => renditionRef.current?.next(), []);
  const goPrev = useCallback(() => renditionRef.current?.prev(), []);
  const goToHref = useCallback((href: string) => renditionRef.current?.display(href), []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); goPrev(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); goNext(); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goNext, goPrev]);

  // Expose navigation
  useEffect(() => {
    (window as any).__epubViewer = { goNext, goPrev, goToHref };
  }, [goNext, goPrev, goToHref]);

  return (
    <div ref={viewerRef} style={{ width: '100%', height: '100%' }} />
  );
}
```

- [ ] **Step 2: Update ReaderPage.tsx to use EpubViewer**

```typescript
// frontend/src/pages/Reader/ReaderPage.tsx — update the EPUB section
// Replace the EPUB placeholder div with:
import EpubViewer from '../../components/EpubViewer';

// In the content area, replace the epub block:
{book.file_format === 'epub' ? (
  <EpubViewer
    filePath={book.file_path}
    onLocationChange={(cfi, progress) => {
      // Save progress
      if (bookId) {
        bookApi.updateProgress(bookId, { current_cfi: cfi, progress_percent: progress }).catch(() => {});
      }
    }}
    onTocLoad={setToc}
    initialCfi={undefined}
  />
) : book.file_format === 'pdf' ? (
  // ... existing PDF viewer
) : (
  // ... unsupported format
)}
```

Also update TOC click for EPUB:
```typescript
// In the TOC renderItem, add EPUB navigation:
onClick={() => {
  if (book?.file_format === 'epub') {
    (window as any).__epubViewer?.goToHref(item.href);
  } else {
    goToPage(item.pageNumber);
  }
  setShowToc(false);
}}
```

- [ ] **Step 3: Run frontend type check**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/EpubViewer.tsx frontend/src/pages/Reader/ReaderPage.tsx
git commit -m "feat: add EPUB reader with epub.js, TOC, font size, dark mode"
```

---

## Task 11: Final Integration and Verification

- [ ] **Step 1: Install any new frontend dependencies**

```bash
cd frontend && npm install
```

- [ ] **Step 2: Run backend tests**

```bash
cd backend && python -m pytest tests/ -v
```

Expected: All PASS

- [ ] **Step 3: Run frontend type check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: No errors

- [ ] **Step 4: Start backend and verify new endpoints**

```bash
cd backend && uvicorn app.main:app --reload --port 8000
```

Verify:
- `GET /api/ai/status` returns status
- `POST /api/search/cross-book` accepts query
- `GET /api/knowledge-cards/` returns card list
- `GET /api/books/{id}/progress` returns progress

- [ ] **Step 5: Commit final state**

```bash
git add -A
git commit -m "feat: complete Phase 2 enhancement integration"
```

---

## Spec Coverage Checklist

| Spec Requirement | Task |
|------------------|------|
| Book model: metadata_enriched, metadata_source, open_library_id | Task 1 |
| KnowledgeCard: card_type, tags, updated_at | Task 1 |
| CardLink model | Task 1 |
| ReadingProgress model | Task 1 |
| MetadataEnrichmentService (Google Books + Open Library) | Task 2 |
| NetworkChecker with caching | Task 3 |
| AIServiceFactory with offline fallback | Task 3 |
| AI status endpoint | Task 3 |
| Cross-book query schemas | Task 4 |
| SearchEngine.cross_book_query() | Task 4 |
| Cross-book API endpoint | Task 4 |
| Knowledge cards CRUD API | Task 5 |
| Card links API | Task 5 |
| Import enrichment integration | Task 6 |
| Reading progress API | Task 6 |
| Knowledge cards frontend page | Task 7 |
| Cross-book query frontend tab | Task 8 |
| AI status in status bar | Task 8 |
| PDF reader with react-pdf | Task 9 |
| EPUB reader with epub.js | Task 10 |
| Reading progress persistence | Task 9, 10 |
| TOC navigation (PDF + EPUB) | Task 9, 10 |
| Zoom / font size | Task 9, 10 |
| Keyboard navigation | Task 9, 10 |

---

*Plan complete. Phase 3 will be a separate plan.*
