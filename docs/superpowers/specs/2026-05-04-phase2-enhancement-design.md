# Phase 2 Enhancement Design

> Document status: Confirmed | Date: 2026-05-04 | Version: v1.0

---

## Overview

Phase 2 builds on the Phase 1 MVP to add five capabilities:

1. **Auto Metadata Extraction** — enrich book records via Google Books / Open Library APIs
2. **Cross-Book Query** — AI-synthesized answers from multiple books with source citations
3. **Knowledge Cards** — save, annotate, and link insights from search and AI conversations
4. **Ollama Offline Support** — automatic network detection and seamless AI engine switching
5. **Reader Enhancement** — full PDF/EPUB rendering with TOC, pagination, and zoom

---

## 1. Auto Metadata Extraction

### 1.1 Pipeline Architecture

```
File Import
    │
    ▼
Parser extracts file-internal metadata (title, author, isbn, cover)
    │
    ▼
Book record created (fast return to user)
    │
    ▼
Background task: MetadataEnrichmentService.enrich(book_id)
    ├── ISBN exists → Google Books API lookup → fill publisher, publish_date, cover
    ├── ISBN missing → Open Library search by title+author → match and fill
    └── Cover missing → download from API, cache to data/covers/{book_id}.jpg
    │
    ▼
WebSocket push: enrichment complete / failed
```

### 1.2 New Model Fields

| Field | Type | Description |
|-------|------|-------------|
| metadata_enriched | BOOLEAN | Whether enrichment has been attempted |
| metadata_source | VARCHAR(20) | "file" / "google_books" / "open_library" |
| open_library_id | VARCHAR(50) | Open Library work ID for future lookups |

### 1.3 External API Integration

**Google Books API** (no key required for basic queries):
- Endpoint: `https://www.googleapis.com/books/v1/volumes?q=isbn:{isbn}`
- Fields extracted: publisher, publishedDate, imageLinks.thumbnail

**Open Library API** (no key required):
- Search: `https://openlibrary.org/search.json?title={title}&author={author}&limit=1`
- Cover: `https://covers.openlibrary.org/b/olid/{olid}-L.jpg`
- Fields extracted: publisher, first_publish_year, cover_i

### 1.4 Error Handling

- API timeout (5s) → skip enrichment, mark `metadata_enriched=True, metadata_source="file"`
- Rate limiting → exponential backoff, max 3 retries
- No match found → use file-internal metadata only

---

## 2. Cross-Book Query

### 2.1 Query Flow

```
User question
    │
    ▼
SearchEngine._semantic_search(query, top_k=20)
    │
    ▼
Group results by book_id, keep top 3 passages per book
    │
    ▼
Build prompt:
  System: "Based on the following passages from multiple books, answer the
           user's question. Cite sources as [Book Title, Page X]."
  Context: passages with book_id, title, page_number
  User: question
    │
    ▼
AI generates synthesized answer with citations
    │
    ▼
Return: { answer, sources: [{book_id, title, pages: [12, 45]}] }
```

### 2.2 New API Endpoint

```
POST /api/search/cross-book
Request:  { query: str, top_k: int = 20 }
Response: {
  answer: str,
  sources: [{
    book_id: UUID,
    book_title: str,
    passages: [{ page_number, content, score }]
  }]
}
```

### 2.3 Frontend

- New "Cross-Book Query" tab in the Search page
- Display: synthesized answer at top, expandable source cards below
- Each source card shows book title, page numbers, and passage excerpts
- Click on source → navigate to reader at that page

---

## 3. Knowledge Cards

### 3.1 Data Model Changes

**Extend `knowledge_cards` table:**

| Field | Type | Description |
|-------|------|-------------|
| card_type | VARCHAR(20) | "search_result" / "ai_chat" / "manual" |
| tags | JSON | User-defined tags array |
| updated_at | TIMESTAMP | Last modification time |

**New `card_links` table:**

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| source_card_id | UUID | FK → knowledge_cards |
| target_card_id | UUID | FK → knowledge_cards |
| link_type | VARCHAR(20) | "related" / "contradicts" / "extends" |
| created_at | TIMESTAMP | Creation time |

### 3.2 Creation Flow

**From search results:**
- Each search result row has a "Save as Card" button
- Auto-populates: title (from query), content (passage text), source_book_id, source_passage
- User can edit and add annotation before saving

**From AI chat:**
- Each AI response has a "Save as Card" button
- Auto-populates: title (from question), content (AI response), annotation field for user notes

**Manual creation:**
- Knowledge Cards page has "New Card" button
- Modal with title, content, source_book (optional dropdown), annotation fields

### 3.3 Card Management UI

- New page: Knowledge Cards (accessible from sidebar)
- Grid/list view toggle (same pattern as Library page)
- Card detail drawer: title, content, source link, annotation, related cards
- Link cards: drag-to-link or "Link to..." button → search existing cards → select link type
- Filter by card_type, tags, source book

---

## 4. Ollama Offline Support

### 4.1 Network Detection

```python
class NetworkChecker:
    def __init__(self):
        self._cache = {}  # {result: bool, timestamp: float}
        self._cache_ttl = 30  # seconds

    async def is_online(self) -> bool:
        # Check cache first
        if cached and not expired:
            return cached result
        # Ping check
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.head("https://www.google.com", timeout=3)
                return resp.status_code < 500
        except:
            return False
```

### 4.2 Auto-Switching Logic

```python
class AIServiceFactory:
    @staticmethod
    async def get_service(settings, network_checker) -> AIServiceInterface:
        is_online = await network_checker.is_online()

        if is_online:
            # Use configured cloud provider
            if settings.AI_PROVIDER == "openai":
                return OpenAIAdapter(...)
            elif settings.AI_PROVIDER == "claude":
                return ClaudeAdapter(...)
            else:
                return OllamaAdapter(...)
        else:
            # Offline - try Ollama
            try:
                ollama = OllamaAdapter(base_url=settings.OLLAMA_BASE_URL)
                # Quick health check
                await ollama.health_check()
                return ollama
            except:
                raise AIServiceUnavailableError("No AI service available offline")
```

### 4.3 UI Feedback

- Status bar shows current AI engine: "AI: OpenAI (Online)" / "AI: Ollama (Offline)"
- When switching, show brief notification toast
- Settings page shows network status indicator

---

## 5. Reader Enhancement

### 5.1 PDF Reader (react-pdf)

**Library:** `react-pdf` v7+ (wraps PDF.js)

**Features:**
- Page-by-page rendering with virtualization for large PDFs
- TOC extraction from PDF outline (`pdf.getOutline()`)
- Navigation: keyboard arrows, mouse scroll, toolbar buttons
- Zoom: Ctrl+scroll, toolbar buttons (50%–200%, fit-width, fit-page)
- Page indicator: "Page X / Y" in toolbar

**Component structure:**
```
ReaderPage
├── ReaderToolbar (back, title, TOC toggle, zoom controls, page input)
├── PdfViewer (react-pdf Document + Page)
├── TocDrawer (chapter list from outline)
└── ReaderStatusBar (page number, zoom level)
```

### 5.2 EPUB Reader (epub.js)

**Library:** `epub.js` v0.3+

**Features:**
- Flow (paginated) and scrolled modes
- TOC from EPUB navigation document
- Navigation: keyboard, click edges, swipe
- Font size adjustment (zoom equivalent)
- Theme: light/dark toggle

**Component structure:**
```
ReaderPage
├── ReaderToolbar (back, title, TOC toggle, font size, theme)
├── EpubViewer (epub.js Rendition)
├── TocDrawer (chapter list from navigation)
└── ReaderStatusBar (current chapter, progress %)
```

### 5.3 Shared Features

**Reading progress persistence:**
- Save to `reading_progress` table: book_id, current_page/cfi, percentage, updated_at
- Resume from last position on re-open

**`reading_progress` table:**

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| book_id | UUID | FK → books, unique |
| current_page | INTEGER | PDF page number |
| current_cfi | TEXT | EPUB CFI position |
| progress_percent | FLOAT | 0.0–100.0 |
| updated_at | TIMESTAMP | Last update |

**Bookmark integration:**
- Toolbar bookmark button saves current position to `annotations` table (type="bookmark")
- Bookmark list drawer shows all bookmarks for current book

---

## 6. Frontend Navigation Changes

**Sidebar additions:**
- Knowledge Cards page entry
- Cross-Book Query under Search section

**New pages:**
- `/knowledge-cards` — card grid/list, detail drawer, link management
- `/search/cross-book` — cross-book query interface

**Modified pages:**
- `/reader/:bookId` — full PDF/EPUB rendering (replaces skeleton)
- `/search` — add cross-book query tab

---

## 7. New Dependencies

**Backend:**
- `httpx` — already installed, used for external API calls
- No new dependencies needed

**Frontend:**
- `react-pdf` — PDF rendering
- `epubjs` — EPUB rendering
- `pdfjs-dist` — PDF.js worker (peer dep of react-pdf)

---

## Error Handling Summary

| Scenario | Handling |
|----------|----------|
| Google Books API timeout | Skip enrichment, use file metadata |
| Open Library API timeout | Skip enrichment, use file metadata |
| No metadata match found | Use file-internal metadata only |
| Cross-book query AI failure | Return raw passages without synthesis |
| Ollama not running offline | Show error "No AI service available" |
| Network check fails | Assume offline, try Ollama |
| PDF/EPUB render error | Show error message, offer file download |
| Reading progress save failure | Silent fail, non-critical |

---

*Phase 2 design complete. Phase 3 (dialogue reading, notes/annotations, data export, auto-update) will be a separate design.*
