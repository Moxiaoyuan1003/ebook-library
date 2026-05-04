# Code Quality Round 2 Design

> Document status: Confirmed | Date: 2026-05-04 | Version: v1.0

---

## Overview

Fix 6 minor code quality issues identified during Phase 2/3 code reviews. All are small, isolated changes.

---

## 1. EPUB TOC Page Number Display

**Problem:** ReaderPage TOC drawer shows "P.{pageNumber}" for all items. EPUB TocItem entries may not have meaningful pageNumber values — displays "P.0" or "P.undefined".

**Solution:** In ReaderPage TOC renderItem, conditionally show page number only for PDF:

```tsx
{isPdf && (
  <span style={{ color: '#888', fontSize: 11, marginLeft: 'auto' }}>P.{item.pageNumber}</span>
)}
```

---

## 2. handleTextSelect Type Safety

**Problem:** `handleTextSelect` in ReaderPage accepts `rectOrCfi: any`. The `instanceof DOMRect` check narrows it, but the parameter type should be explicit.

**Solution:** Change parameter type to `DOMRect | string`:

```typescript
const handleTextSelect = (text: string, rectOrCfi: DOMRect | string) => {
```

This requires updating PdfViewer's `onTextSelect` prop type (already `(text: string, rect: DOMRect) => void`) and EpubViewer's `onTextSelect` prop type (already `(text: string, cfiRange: string) => void`). The union type works for both.

---

## 3. useEffect Dependency Array Fix

**Problem:** `loadBook` and `loadProgress` are defined as bare async functions inside the component body and called from a useEffect with `[bookId]` dependency. ESLint's `react-hooks/exhaustive-deps` rule warns they're missing from deps.

**Solution:** Inline the functions into the useEffect callback:

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

  const loadProgress = async () => {
    try {
      const response = await bookApi.getProgress(bookId);
      if (response.data.current_page > 0) {
        setCurrentPage(response.data.current_page);
      }
    } catch {}
  };

  load();
  loadProgress();
}, [bookId, navigate]);
```

---

## 4. Silent Catch Blocks

**Problem:** `loadProgress` and `saveProgress` swallow errors silently. Makes debugging difficult.

**Solution:** Add `console.warn` to both catch blocks:

```typescript
} catch (err) {
  console.warn('Failed to load reading progress:', err);
}
```

```typescript
} catch (err) {
  console.warn('Failed to save reading progress:', err);
}
```

---

## 5. Extract resolveOutline Outside Component

**Problem:** `resolveOutline` in PdfViewer is a pure utility function (takes pdf and outline, returns TocItem[]) but is defined inside the component body, recreated on every render.

**Solution:** Move it outside the component as a module-level function:

```typescript
// Before component definition
const resolveOutline = async (pdf: any, outline: any[]): Promise<TocItem[]> => {
  // ... same implementation
};
```

No signature changes needed — it doesn't reference any component state or props.

---

## 6. Extract Magic Numbers as Constants

**Problem:** PdfViewer has unexplained numeric literals: `612` (standard PDF width in points), `48` (double padding), `0.2` (zoom step), `2.0` (max zoom), `0.5` (min zoom).

**Solution:** Extract as named constants at the top of the file:

```typescript
const PDF_STANDARD_WIDTH = 612; // points
const CONTAINER_PADDING = 48;   // 24px * 2
const ZOOM_STEP = 0.2;
const ZOOM_MAX = 2.0;
const ZOOM_MIN = 0.5;
```

Replace the literals with these constants.

---

## File Change Summary

| File | Changes |
|------|---------|
| `frontend/src/pages/Reader/ReaderPage.tsx` | Items 1, 2, 3, 4 |
| `frontend/src/components/PdfViewer.tsx` | Items 5, 6 |

---

## Spec Self-Review

1. **Placeholder scan:** No TBDs. ✅
2. **Internal consistency:** All items reference actual code verified in reviews. ✅
3. **Scope check:** 6 small fixes, 2 files — appropriate. ✅
4. **Ambiguity check:** Each has a concrete before/after. ✅
