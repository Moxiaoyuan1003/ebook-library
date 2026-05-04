# Test Coverage Expansion Design

> Document status: Confirmed | Date: 2026-05-04 | Version: v1.0

---

## Overview

Expand test coverage for both frontend (from 0 to meaningful coverage) and backend (fill gaps in API endpoint testing).

---

## 1. Frontend Testing Setup

**Tool:** vitest + @testing-library/react + jsdom

**Setup needed:**
- Install `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `jsdom`
- Create `vitest.config.ts` (or add test config to `vite.config.ts`)
- Create `src/test/setup.ts` with jest-dom matchers

**Test file convention:** `*.test.tsx` / `*.test.ts` co-located with source files.

---

## 2. Frontend Component Tests

### 2.1 TextSelectionMenu

- Renders when `visible=true`
- Hides when `visible=false`
- Calls `onAskAI` when "问 AI" button clicked
- Calls `onCopy` when "复制" button clicked
- Calls `onHighlight` with color when color dot clicked
- Calls `onClose` when clicking outside

### 2.2 AnnotationSidebar

- Renders annotation list when `visible=true`
- Calls `onJumpToAnnotation` when item clicked
- Calls delete API when delete confirmed
- Shows empty state when no annotations

### 2.3 ReadingChatPanel

- Renders chat messages
- Sends message on submit
- Shows context indicator when `selectedText` provided
- Calls `onClose` when close button clicked

### 2.4 UpdateChecker

- Shows current version
- Calls check API on button click
- Shows update available state
- Shows no-update state

### 2.5 ExportPage

- Renders data type and format selectors
- Calls export API on button click

---

## 3. Frontend API Service Tests

Test API client request building (mock axios):

### 3.1 annotationApi

- `list(bookId)` sends GET with correct params
- `create(data)` sends POST with correct body
- `update(id, data)` sends PUT with correct body
- `delete(id)` sends DELETE

### 3.2 readingSessionApi

- `chat(data)` sends POST
- `listSessions(bookId)` sends GET
- `deleteSession(id)` sends DELETE

### 3.3 exportApi

- `export(data)` sends POST and returns blob

---

## 4. Backend API Tests — Books CRUD

Currently `test_book_api.py` only tests health and empty list. Add:

- `POST /api/books/` — create book with file
- `GET /api/books/{id}` — get single book
- `PUT /api/books/{id}` — update book metadata
- `DELETE /api/books/{id}` — delete book
- `GET /api/books/` — list with pagination
- `GET /api/books/?search=query` — search filter

---

## 5. Backend API Tests — Reading Progress

No dedicated test file exists. Create `test_reading_progress.py`:

- `POST /api/reading-progress/` — create/update progress
- `GET /api/reading-progress/{book_id}` — get progress
- Progress percentage calculation

---

## 6. Backend API Tests — Search

`test_search.py` exists but may be incomplete. Verify and add:

- `GET /api/search/?q=query` — full-text search
- Search with no results
- Search with multiple results

---

## File Change Summary

### New Files

| File | Responsibility |
|------|---------------|
| `frontend/vitest.config.ts` | Vitest configuration |
| `frontend/src/test/setup.ts` | Test setup (jest-dom matchers) |
| `frontend/src/components/TextSelectionMenu.test.tsx` | TextSelectionMenu tests |
| `frontend/src/components/AnnotationSidebar.test.tsx` | AnnotationSidebar tests |
| `frontend/src/components/ReadingChatPanel.test.tsx` | ReadingChatPanel tests |
| `frontend/src/components/UpdateChecker.test.tsx` | UpdateChecker tests |
| `frontend/src/services/annotationApi.test.ts` | annotationApi tests |
| `frontend/src/services/readingSessionApi.test.ts` | readingSessionApi tests |
| `frontend/src/services/exportApi.test.ts` | exportApi tests |
| `backend/tests/test_reading_progress.py` | Reading progress API tests |

### Modified Files

| File | Changes |
|------|---------|
| `frontend/package.json` | Add @testing-library deps |
| `frontend/src/pages/Export/ExportPage.test.tsx` | ExportPage tests |
| `backend/tests/test_book_api.py` | Add CRUD tests |

---

## Spec Self-Review

1. **Placeholder scan:** No TBDs. ✅
2. **Internal consistency:** All test files match existing component/service names. ✅
3. **Scope check:** 10 test files across frontend + backend — appropriate. ✅
4. **Ambiguity check:** Each test has clear inputs/outputs. ✅
