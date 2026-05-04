# Code Quality Round 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 6 minor code quality issues: EPUB TOC display, type safety, useEffect deps, silent catches, function extraction, magic numbers.

**Architecture:** Two focused tasks — one per file. ReaderPage gets 4 fixes (items 1-4), PdfViewer gets 2 fixes (items 5-6).

**Tech Stack:** React, TypeScript

---

## Task 1: ReaderPage Quality Fixes

**Files:**
- Modify: `frontend/src/pages/Reader/ReaderPage.tsx`

- [ ] **Step 1: Fix EPUB TOC page number display**

In the TOC Drawer `renderItem`, conditionally show page number only for PDF. Find this block (around line 234):

```tsx
<span style={{ fontSize: 13 }}>{item.title}</span>
<span style={{ color: '#888', fontSize: 11, marginLeft: 'auto' }}>P.{item.pageNumber}</span>
```

Replace with:

```tsx
<span style={{ fontSize: 13 }}>{item.title}</span>
{isPdf && (
  <span style={{ color: '#888', fontSize: 11, marginLeft: 'auto' }}>P.{item.pageNumber}</span>
)}
```

- [ ] **Step 2: Fix handleTextSelect type**

Find the `handleTextSelect` function signature:

```typescript
const handleTextSelect = (text: string, rectOrCfi: any) => {
```

Replace with:

```typescript
const handleTextSelect = (text: string, rectOrCfi: DOMRect | string) => {
```

- [ ] **Step 3: Fix useEffect dependency array**

Find the useEffect that calls `loadBook` and `loadProgress`:

```typescript
useEffect(() => {
  if (bookId) {
    loadBook(bookId);
    loadProgress(bookId);
  }
}, [bookId]);
```

And the standalone `loadBook` and `loadProgress` functions. Replace all of that with inlined versions:

```typescript
useEffect(() => {
  if (!bookId) return;

  const load = async () => {
    try {
      const response = await bookApi.get(bookId);
      setBook(response.data);
    } catch (error) {
      message.error('加载图书失败');
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const loadProg = async () => {
    try {
      const response = await bookApi.getProgress(bookId);
      if (response.data.current_page > 0) {
        setCurrentPage(response.data.current_page);
      }
    } catch (err) {
      console.warn('Failed to load reading progress:', err);
    }
  };

  load();
  loadProg();
}, [bookId, navigate]);
```

Remove the old `loadBook` and `loadProgress` standalone functions.

- [ ] **Step 4: Add console.warn to saveProgress catch**

Find `saveProgress`:

```typescript
const saveProgress = async (page: number) => {
  if (!bookId) return;
  try {
    const percent = totalPages > 0 ? Math.round((page / totalPages) * 100) : 0;
    await bookApi.updateProgress(bookId, { current_page: page, progress_percent: percent });
  } catch {}
};
```

Replace with:

```typescript
const saveProgress = async (page: number) => {
  if (!bookId) return;
  try {
    const percent = totalPages > 0 ? Math.round((page / totalPages) * 100) : 0;
    await bookApi.updateProgress(bookId, { current_page: page, progress_percent: percent });
  } catch (err) {
    console.warn('Failed to save reading progress:', err);
  }
};
```

- [ ] **Step 5: Verify TypeScript compilation**

Run: `cd f:/Code/ebook-library/frontend && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 6: Commit**

```bash
cd f:/Code/ebook-library && git add frontend/src/pages/Reader/ReaderPage.tsx
git commit -m "fix: EPUB TOC display, type safety, useEffect deps, silent catches in ReaderPage"
```

---

## Task 2: PdfViewer Quality Fixes

**Files:**
- Modify: `frontend/src/components/PdfViewer.tsx`

- [ ] **Step 1: Extract resolveOutline outside component**

Find the `resolveOutline` function (currently defined inside the PdfViewer component body, after `onDocumentLoadSuccess`). Move it to before the component definition, as a module-level function. It's a pure utility that doesn't reference any component state.

Before the `const PdfViewer = forwardRef<...>` line, add:

```typescript
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
```

Remove the duplicate definition from inside the component body.

- [ ] **Step 2: Extract magic numbers as constants**

At the top of the file (after imports, before the component), add:

```typescript
const PDF_STANDARD_WIDTH = 612; // points
const CONTAINER_PADDING = 48;   // 24px * 2 sides
const ZOOM_STEP = 0.2;
const ZOOM_MAX = 2.0;
const ZOOM_MIN = 0.5;
```

Then replace the literals in the component:

In `handleFitWidth`:
```typescript
// OLD:
const containerWidth = containerRef.current.clientWidth - 48;
setScale(containerWidth / 612);
// NEW:
const containerWidth = containerRef.current.clientWidth - CONTAINER_PADDING;
setScale(containerWidth / PDF_STANDARD_WIDTH);
```

In `handleZoomIn`:
```typescript
// OLD:
setScale((s) => Math.min(s + 0.2, 2.0));
// NEW:
setScale((s) => Math.min(s + ZOOM_STEP, ZOOM_MAX));
```

In `handleZoomOut`:
```typescript
// OLD:
setScale((s) => Math.max(s - 0.2, 0.5));
// NEW:
setScale((s) => Math.max(s - ZOOM_STEP, ZOOM_MIN));
```

- [ ] **Step 3: Verify TypeScript compilation**

Run: `cd f:/Code/ebook-library/frontend && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
cd f:/Code/ebook-library && git add frontend/src/components/PdfViewer.tsx
git commit -m "refactor: extract resolveOutline and magic numbers in PdfViewer"
```

---

## Spec Coverage

| Spec Requirement | Task |
|------------------|------|
| 1. EPUB TOC page number display | Task 1 Step 1 |
| 2. handleTextSelect type safety | Task 1 Step 2 |
| 3. useEffect dependency array | Task 1 Step 3 |
| 4. Silent catch blocks | Task 1 Step 4 |
| 5. Extract resolveOutline | Task 2 Step 1 |
| 6. Extract magic numbers | Task 2 Step 2 |
