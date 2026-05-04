# Tech Debt Cleanup Design

> Document status: Confirmed | Date: 2026-05-04 | Version: v1.0

---

## Overview

Clean up 7 tech debt items identified during Phase 2/3 code reviews. All items are refactors — no new features, no behavior changes.

---

## 1. I1: forwardRef Refactor (Viewer Method Exposure)

**Problem:** PdfViewer and EpubViewer expose methods via `window.__pdfViewer` / `window.__epubViewer` globals. ReaderPage calls them as `window.__pdfViewer?.goToPage(page)`. This is fragile, untyped, and couples components through the global scope.

**Solution:** Use React `forwardRef` + `useImperativeHandle`.

**PdfViewer:**
- Define `PdfViewerRef` interface: `{ goToPage, handleZoomIn, handleZoomOut, handleFitWidth, getScale, getCurrentPage, getNumPages }`
- Wrap component in `forwardRef`, use `useImperativeHandle` to expose methods
- Delete `window.__pdfViewer` assignment

**EpubViewer:**
- Define `EpubViewerRef` interface: `{ goNext, goPrev, goToHref }`
- Wrap component in `forwardRef`, use `useImperativeHandle` to expose methods
- Delete `window.__epubViewer` assignment

**ReaderPage:**
- `const pdfRef = useRef<PdfViewerRef>(null)` / `const epubRef = useRef<EpubViewerRef>(null)`
- Pass ref to `<PdfViewer ref={pdfRef} ...>` / `<EpubViewer ref={epubRef} ...>`
- Replace all `window.__pdfViewer?.xxx()` with `pdfRef.current?.xxx()`
- Replace `window.__epubViewer?.goToHref()` with `epubRef.current?.goToHref()`

---

## 2. I2: TocItem Interface Deduplication

**Problem:** `TocItem` interface is defined in both PdfViewer.tsx and ReaderPage.tsx with slightly different shapes (PdfViewer has optional `items?`, ReaderPage has optional `href?`).

**Solution:** Extract unified `TocItem` to `frontend/src/types/reader.ts`.

```typescript
export interface TocItem {
  title: string;
  pageNumber: number;
  href?: string;
  items?: TocItem[];
}
```

Both PdfViewer, EpubViewer, and ReaderPage import from this shared location.

---

## 3. I3: Keyboard Handler Scoping

**Problem:** PdfViewer's keydown handler listens on `window`, which captures arrow keys even when the user is typing in the page number InputNumber field in ReaderPage's toolbar.

**Solution:** Scope the handler to `containerRef.current`.

- Add `tabIndex={0}` to the container div so it can receive focus
- Add `onFocus` or auto-focus on mount
- Change `window.addEventListener('keydown', ...)` to `container.addEventListener('keydown', ...)`
- Same for cleanup

---

## 4. I4: Format-Aware Toolbar

**Problem:** ReaderPage toolbar shows page navigation, zoom controls, and page number input for both PDF and EPUB. EPUB doesn't use page numbers or zoom — it uses CFI-based navigation and font size.

**Solution:** Conditionally render toolbar controls based on `book.file_format`.

- **PDF:** Show page number input, prev/next page, zoom in/out/percentage (current behavior)
- **EPUB:** Show progress percentage only. Hide page input, zoom controls, prev/next page buttons.

---

## 5. I5: EpubViewer Stale Closure Fix

**Problem:** EpubViewer's `rendition.on('selected', ...)` and `rendition.on('relocated', ...)` callbacks capture `onTextSelect` / `onLocationChange` / `onTocLoad` props at mount time. If the parent re-renders with new callback references, the rendition handlers still call the stale ones.

**Solution:** Use `useRef` to hold latest callback references.

```typescript
const onTextSelectRef = useRef(onTextSelect);
onTextSelectRef.current = onTextSelect;

// In rendition handler:
rendition.on('selected', (cfiRange, contents) => {
  const text = contents.window.getSelection().toString();
  if (text) onTextSelectRef.current?.(text, cfiRange);
});
```

Same pattern for `onLocationChange` and `onTocLoad`.

---

## 6. I6: Alembic Migration

**Problem:** Phase 3 added the `reading_sessions` table and extended the `annotations` table with new columns, but no Alembic migration was created.

**Solution:** Create a single migration file covering:
1. Create `reading_sessions` table (id, book_id, messages JSON, context_passages JSON, created_at, updated_at)
2. Alter `annotations` table — add columns: `highlight_color` VARCHAR(20), `start_cfi` TEXT, `end_cfi` TEXT, `rect_data` TEXT

---

## 7. I7: Alembic env.py Import Fix

**Problem:** `alembic/env.py` only imports: Book, Tag, Bookshelf, Passage, Annotation, KnowledgeCard. Missing: ReadingSession, CardLink, ReadingProgress, bookshelf_books, book_tags. This means Alembic can't detect schema changes for those models.

**Solution:** Import from `app.models` which already has all models registered:

```python
from app.models import *  # noqa: F401,F403
```

Or explicitly import all models. The wildcard approach is cleaner since `__init__.py` already defines `__all__`.

---

## File Change Summary

| File | Action |
|------|--------|
| `frontend/src/types/reader.ts` | Create — shared TocItem interface |
| `frontend/src/components/PdfViewer.tsx` | Modify — forwardRef, import shared TocItem, scope keyboard |
| `frontend/src/components/EpubViewer.tsx` | Modify — forwardRef, import shared TocItem, ref callbacks |
| `frontend/src/pages/Reader/ReaderPage.tsx` | Modify — use refs, import shared TocItem, format-aware toolbar |
| `backend/alembic/env.py` | Modify — fix model imports |
| `backend/alembic/versions/xxxx_add_reading_session_and_annotation_fields.py` | Create — migration |

---

## Spec Self-Review

1. **Placeholder scan:** No TBDs or TODOs found.
2. **Internal consistency:** All items reference existing code verified in exploration phase.
3. **Scope check:** 7 focused refactors, all in one plan — appropriate scope.
4. **Ambiguity check:** Each item has a concrete before/after. No ambiguity.
