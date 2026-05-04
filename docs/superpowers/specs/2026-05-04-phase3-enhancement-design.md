# Phase 3 Enhancement Design

> Document status: Confirmed | Date: 2026-05-04 | Version: v1.0

---

## Overview

Phase 3 builds on Phase 1-2 to add four capabilities:

1. **Dialogue-Based Deep Reading** — AI-powered conversation while reading, with text selection and sidebar chat
2. **Notes & Annotations Enhancement** — highlights with colors, attached notes, sidebar annotation list
3. **Data Export** — export knowledge cards, annotations, and conversations as Markdown/PDF/CSV
4. **Auto-Update** — GitHub Release version check with notification and manual download

---

## 1. Dialogue-Based Deep Reading

### 1.1 Interaction Flow

**Text Selection → AI Chat:**
1. User selects text in PDF/EPUB reader
2. Floating menu (Popover) appears with buttons: "Ask AI", "Highlight", "Copy"
3. Click "Ask AI" → opens side panel with selected text as context
4. AI answers based on selected passage + current chapter/page context

**Sidebar Chat:**
1. Toolbar gets "AI Chat" button to toggle side panel
2. Panel has message list + input box at bottom
3. Supports multi-turn conversation
4. Automatically includes current chapter/page content as context
5. Conversation history persisted to database, resumable on re-open

### 1.2 Data Model

**New `reading_sessions` table:**

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| book_id | UUID | FK → books |
| messages | JSON | Conversation history `[{role, content, timestamp}]` |
| context_passages | JSON | Referenced passages/pages |
| created_at | TIMESTAMP | Creation time |
| updated_at | TIMESTAMP | Last update |

### 1.3 API Endpoints

```
POST /api/ai/reading-chat
Request: {
  book_id: UUID,
  message: str,
  context_passages: [{content, page_number, cfi}],
  session_id?: UUID  // continue existing session
}
Response: {
  reply: str,
  session_id: UUID,
  sources: [{page_number, content}]
}

GET /api/ai/reading-sessions/{book_id}
Response: [{id, messages, context_passages, created_at, updated_at}]

DELETE /api/reading-sessions/{id}
Response: {success: bool}
```

### 1.4 Frontend Components

- `ReadingChatPanel.tsx` — Side panel with message list, input box, context indicator
- `TextSelectionMenu.tsx` — Unified floating menu on text selection: "Ask AI" opens chat panel, "Highlight" opens color picker + annotation input, "Copy" copies text. This component handles both dialogue and annotation entry points.

### 1.5 ReaderPage Integration

- Add chat panel state and toggle button in toolbar
- PDF viewer: expose text selection event via `onTextSelect` callback
- EPUB viewer: use epub.js `rendition.on('selected')` event
- Chat panel renders as right-side drawer (320px wide)

---

## 2. Notes & Annotations Enhancement

### 2.1 Features

1. **Highlight**: Select text → choose color (yellow/green/blue/pink/purple) → highlight rendered
2. **Annotation**: After highlighting, optional text note can be attached
3. **Sidebar list**: Shows all highlights/annotations for current book, click to jump

### 2.2 Data Model Changes

**Extend existing `annotations` table:**

| New Field | Type | Description |
|-----------|------|-------------|
| highlight_color | VARCHAR(20) | Color: yellow/green/blue/pink/purple |
| selected_text | TEXT | Selected original text |
| start_cfi | TEXT | EPUB start position (CFI) |
| end_cfi | TEXT | EPUB end position (CFI) |
| page_number | INTEGER | PDF page number |
| rect_data | JSON | PDF highlight rectangle coordinates |

### 2.3 Rendering

**PDF Highlights (react-pdf):**
- Use custom overlay layer on top of `Page` component
- Store highlight rectangles (x, y, width, height + page number)
- Render semi-transparent colored rectangles at stored positions
- Re-render on page change and zoom change

**EPUB Highlights (epub.js):**
- Use epub.js built-in annotation API: `rendition.annotations.add('highlight', cfiRange, {}, cb, className, styles)`
- Store CFI range, render via `annotations.add` on location change

### 2.4 Frontend Components

- `TextSelectionMenu.tsx` — (shared with dialogue reading) Color picker + annotation input when "Highlight" is clicked
- `AnnotationSidebar.tsx` — Sidebar list of all annotations (sorted by page/chapter)
- `AnnotationDrawer.tsx` — Detail drawer for editing/deleting annotation

### 2.5 API

Existing `/api/annotations` CRUD extended:
- `POST /api/annotations` — Create highlight/annotation with color, selected text, position data
- `GET /api/annotations?book_id={id}` — Get all annotations for a book
- `PUT /api/annotations/{id}` — Update annotation note
- `DELETE /api/annotations/{id}` — Delete annotation

---

## 3. Data Export

### 3.1 Exportable Data

| Data Type | Content |
|-----------|---------|
| Knowledge Cards | Title, content, note, tags, source book, linked cards |
| Annotations | Highlighted text, note, color, page, source book |
| Conversations | Chat history, associated book, timestamps |
| Book List | Title, author, metadata, reading status, rating |

### 3.2 Export Formats

**Markdown:**
- Each data type → one `.md` file
- Knowledge cards: title → content → note → tags → source
- Annotations: grouped by book, each entry has highlight + note + page

**PDF:**
- Generated via Python `reportlab` or `weasyprint`
- Chinese text support, proper formatting
- Optional cover page (export date, data statistics)

**CSV:**
- Each data type → one `.csv` file
- Suitable for Excel import or other tools

### 3.3 API

```
POST /api/export
Request: {
  data_type: "cards" | "annotations" | "sessions" | "books",
  format: "markdown" | "pdf" | "csv",
  filters: { book_id?, date_from?, date_to?, tags? }
}
Response: FileResponse (file download)
```

### 3.4 Frontend

- New page `/export` (or export section in Settings page)
- Select data type → select format → optional filters → click export → download
- "Export All" button for batch export

---

## 4. Auto-Update

### 4.1 Workflow

```
App startup
    │
    ▼
UpdateChecker.check_for_update()
    ├── Request GitHub API: GET /repos/{owner}/{repo}/releases/latest
    ├── Compare version (current vs latest)
    ├── New version → show toast notification + Settings page badge
    └── No update → silent
    │
    ▼
User clicks "Download Update"
    ├── Navigate to GitHub Release page for manual download
    └── Or: download installer to local temp directory
    │
    ▼
User installs and restarts
```

### 4.2 Technical Approach

**No electron-updater** (requirement is notification + manual download, not auto-install).

**Backend API:**
```
GET /api/system/update-check
Response: {
  current_version: str,
  latest_version: str | null,
  has_update: bool,
  release_url: str | null,
  release_notes: str | null,
  published_at: str | null
}
```

**Frontend:**
- Settings page: "Check Update" button
- Display: current version, latest version, changelog summary, download link
- Auto-check on app startup (configurable)

### 4.3 Version Management

- Version follows semver: `package.json` version field
- GitHub Release tag format: `v1.0.0`
- Changelog extracted from Release body

---

## 5. New Dependencies

**Backend:**
- `reportlab` — PDF generation for data export

**Frontend:**
- No new dependencies (react-pdf and epubjs already installed)

---

## 6. Frontend Navigation Changes

**Sidebar additions:**
- Export page entry (or in Settings)

**New pages:**
- `/export` — data export interface

**Modified pages:**
- `/reader/:bookId` — add chat panel, highlight popover, annotation sidebar
- `/settings` — add update check section

---

## Error Handling Summary

| Scenario | Handling |
|----------|----------|
| AI chat fails | Show error in chat panel, allow retry |
| Highlight render fails | Silent fail, annotation still saved |
| Export generation fails | Show error message, allow retry |
| GitHub API unreachable | Show "Unable to check for updates" |
| No updates available | Show "You're on the latest version" |
| PDF export fails (missing font) | Fallback to Markdown export |

---

*Phase 3 design complete.*
