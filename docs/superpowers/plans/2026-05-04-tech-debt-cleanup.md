# Tech Debt Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clean up 7 tech debt items from Phase 2/3: replace window globals with forwardRef, deduplicate types, scope keyboard handlers, make toolbar format-aware, fix stale closures, create Alembic migration, and fix env.py imports.

**Architecture:** Pure refactors — no new features, no behavior changes. Frontend tasks restructure component communication via React refs and shared types. Backend tasks fix Alembic configuration and create missing migration.

**Tech Stack:** React forwardRef/useImperativeHandle, TypeScript, Alembic, SQLAlchemy

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `frontend/src/types/reader.ts` | Shared TocItem interface |
| `backend/alembic/versions/20260504_add_reading_session_and_annotation_fields.py` | Migration for new/changed tables |

### Modified Files

| File | Changes |
|------|---------|
| `frontend/src/components/PdfViewer.tsx` | forwardRef, import shared TocItem, scope keyboard to container |
| `frontend/src/components/EpubViewer.tsx` | forwardRef, import shared TocItem, ref-wrap callbacks |
| `frontend/src/pages/Reader/ReaderPage.tsx` | Use viewer refs, import shared TocItem, format-aware toolbar |
| `backend/alembic/env.py` | Fix model imports |

---

## Task 1: Extract Shared TocItem Type

**Files:**
- Create: `frontend/src/types/reader.ts`
- Modify: `frontend/src/components/PdfViewer.tsx`
- Modify: `frontend/src/components/EpubViewer.tsx`
- Modify: `frontend/src/pages/Reader/ReaderPage.tsx`

- [ ] **Step 1: Create shared types file**

Create `frontend/src/types/reader.ts`:

```typescript
export interface TocItem {
  title: string;
  pageNumber: number;
  href?: string;
  items?: TocItem[];
}
```

- [ ] **Step 2: Update PdfViewer to use shared TocItem**

In `frontend/src/components/PdfViewer.tsx`:

Remove the local `TocItem` interface (lines 9-13):

```typescript
// DELETE this block:
interface TocItem {
  title: string;
  pageNumber: number;
  items?: TocItem[];
}
```

Add import at top of file:

```typescript
import type { TocItem } from '../types/reader';
```

- [ ] **Step 3: Update EpubViewer to use shared TocItem**

In `frontend/src/components/EpubViewer.tsx`:

The existing `TocItem` interface (lines 5-9) has `href` but not `items`. The shared type has both (optional). Replace:

```typescript
// DELETE this block:
interface TocItem {
  title: string;
  href: string;
  pageNumber: number;
}
```

Add import at top of file:

```typescript
import type { TocItem } from '../types/reader';
```

- [ ] **Step 4: Update ReaderPage to use shared TocItem**

In `frontend/src/pages/Reader/ReaderPage.tsx`:

Remove the local `TocItem` interface (lines 15-20):

```typescript
// DELETE this block:
interface TocItem {
  title: string;
  pageNumber: number;
  href?: string;
  items?: TocItem[];
}
```

Add import at top of file:

```typescript
import type { TocItem } from '../../types/reader';
```

- [ ] **Step 5: Verify TypeScript compilation**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/types/reader.ts frontend/src/components/PdfViewer.tsx frontend/src/components/EpubViewer.tsx frontend/src/pages/Reader/ReaderPage.tsx
git commit -m "refactor: extract shared TocItem type to types/reader.ts"
```

---

## Task 2: PdfViewer forwardRef + Keyboard Scoping

This task combines I1 (forwardRef) and I3 (keyboard scoping) for PdfViewer since they both modify the same component.

**Files:**
- Modify: `frontend/src/components/PdfViewer.tsx`

- [ ] **Step 1: Refactor PdfViewer to forwardRef**

Replace the entire `frontend/src/components/PdfViewer.tsx` with:

```typescript
// frontend/src/components/PdfViewer.tsx
import { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';
import type { TocItem } from '../types/reader';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export interface PdfViewerRef {
  goToPage: (page: number) => void;
  handleZoomIn: () => void;
  handleZoomOut: () => void;
  handleFitWidth: () => void;
  getScale: () => number;
  getCurrentPage: () => number;
  getNumPages: () => number;
}

interface PdfViewerProps {
  filePath: string;
  onPageChange?: (page: number, total: number) => void;
  onTocLoad?: (toc: TocItem[]) => void;
  onTextSelect?: (text: string, rect: DOMRect) => void;
  initialPage?: number;
}

const PdfViewer = forwardRef<PdfViewerRef, PdfViewerProps>(({ filePath, onPageChange, onTocLoad, onTextSelect, initialPage = 1 }, ref) => {
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

  const goToPage = useCallback((page: number) => {
    setCurrentPage((prev) => {
      if (page >= 1 && page <= numPages) {
        onPageChange?.(page, numPages);
        return page;
      }
      return prev;
    });
  }, [numPages, onPageChange]);

  const handleZoomIn = useCallback(() => setScale((s) => Math.min(s + 0.2, 2.0)), []);
  const handleZoomOut = useCallback(() => setScale((s) => Math.max(s - 0.2, 0.5)), []);
  const handleFitWidth = useCallback(() => {
    if (containerRef.current) {
      const containerWidth = containerRef.current.clientWidth - 48;
      setScale(containerWidth / 612);
    }
  }, []);

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    goToPage,
    handleZoomIn,
    handleZoomOut,
    handleFitWidth,
    getScale: () => scale,
    getCurrentPage: () => currentPage,
    getNumPages: () => numPages,
  }), [goToPage, handleZoomIn, handleZoomOut, handleFitWidth, scale, currentPage, numPages]);

  // Keyboard navigation — scoped to container
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

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
    container.addEventListener('keydown', handleKeyDown);
    return () => container.removeEventListener('keydown', handleKeyDown);
  }, [currentPage, numPages, goToPage, handleZoomIn, handleZoomOut]);

  // Text selection handler
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !onTextSelect) return;

    const handleMouseUp = () => {
      const selection = window.getSelection();
      const text = selection?.toString().trim();
      if (text && selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        onTextSelect(text, rect);
      }
    };

    container.addEventListener('mouseup', handleMouseUp);
    return () => container.removeEventListener('mouseup', handleMouseUp);
  }, [onTextSelect]);

  const fileUrl = filePath.startsWith('http') ? filePath : `/api/books/file?file_path=${encodeURIComponent(filePath)}`;

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', overflow: 'auto', height: '100%', padding: 24, outline: 'none' }}
    >
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
});

PdfViewer.displayName = 'PdfViewer';

export default PdfViewer;
```

Key changes:
- Wrapped in `forwardRef<PdfViewerRef, PdfViewerProps>`
- Added `useImperativeHandle` exposing methods via ref
- Keyboard handler scoped to `containerRef.current` instead of `window`
- Added `tabIndex={0}` and `outline: 'none'` to container div
- Deleted `window.__pdfViewer` assignment
- Exported `PdfViewerRef` interface

- [ ] **Step 2: Verify TypeScript compilation**

Run: `cd frontend && npx tsc --noEmit`
Expected: May show errors in ReaderPage.tsx where `window.__pdfViewer` is still used — that's expected, will be fixed in Task 4.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/PdfViewer.tsx
git commit -m "refactor: PdfViewer forwardRef with useImperativeHandle, scope keyboard to container"
```

---

## Task 3: EpubViewer forwardRef + Stale Closure Fix

This task combines I1 (forwardRef) and I5 (stale closure) for EpubViewer.

**Files:**
- Modify: `frontend/src/components/EpubViewer.tsx`

- [ ] **Step 1: Refactor EpubViewer to forwardRef with ref-wrapped callbacks**

Replace the entire `frontend/src/components/EpubViewer.tsx` with:

```typescript
// frontend/src/components/EpubViewer.tsx
import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import ePub from 'epubjs';
import type { TocItem } from '../types/reader';

export interface EpubViewerRef {
  goNext: () => void;
  goPrev: () => void;
  goToHref: (href: string) => void;
}

interface EpubViewerProps {
  filePath: string;
  onLocationChange?: (cfi: string, progress: number) => void;
  onTocLoad?: (toc: TocItem[]) => void;
  onTextSelect?: (text: string, cfiRange: string) => void;
  initialCfi?: string;
  fontSize?: number;
  darkMode?: boolean;
}

const EpubViewer = forwardRef<EpubViewerRef, EpubViewerProps>(({ filePath, onLocationChange, onTocLoad, onTextSelect, initialCfi, fontSize = 16, darkMode = true }, ref) => {
  const viewerRef = useRef<HTMLDivElement>(null);
  const bookRef = useRef<any>(null);
  const renditionRef = useRef<any>(null);
  const [, setReady] = useState(false);

  // Ref-wrap callbacks to avoid stale closures in rendition event handlers
  const onLocationChangeRef = useRef(onLocationChange);
  onLocationChangeRef.current = onLocationChange;
  const onTocLoadRef = useRef(onTocLoad);
  onTocLoadRef.current = onTocLoad;
  const onTextSelectRef = useRef(onTextSelect);
  onTextSelectRef.current = onTextSelect;

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
        onLocationChangeRef.current?.(location.start.cfi, Math.round(progress * 100));
      }
    });

    // Track text selection
    rendition.on('selected', (cfiRange: string, contents: any) => {
      const text = contents.window.getSelection().toString();
      if (text) {
        onTextSelectRef.current?.(text, cfiRange);
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
        onTocLoadRef.current?.(toc);
      }
      // Generate locations for progress tracking
      book.locations.generate(1024).then(() => setReady(true)).catch((err: unknown) => {
        console.warn('Failed to generate EPUB locations:', err);
      });
    }).catch((err: unknown) => {
      console.warn('Failed to load EPUB book:', err);
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
          'line-height': '1.6',
        },
      });
    }
  }, [fontSize, darkMode]);

  // Navigation methods
  const goNext = useCallback(() => renditionRef.current?.next(), []);
  const goPrev = useCallback(() => renditionRef.current?.prev(), []);
  const goToHref = useCallback((href: string) => renditionRef.current?.display(href), []);

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    goNext,
    goPrev,
    goToHref,
  }), [goNext, goPrev, goToHref]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); goPrev(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); goNext(); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goNext, goPrev]);

  return (
    <div ref={viewerRef} style={{ width: '100%', height: '100%' }} />
  );
});

EpubViewer.displayName = 'EpubViewer';

export default EpubViewer;
```

Key changes:
- Wrapped in `forwardRef<EpubViewerRef, EpubViewerProps>`
- Added `useImperativeHandle` exposing `goNext`, `goPrev`, `goToHref`
- Added `useRef` wrappers for `onLocationChange`, `onTocLoad`, `onTextSelect` to fix stale closures
- Deleted `window.__epubViewer` assignment
- Exported `EpubViewerRef` interface

- [ ] **Step 2: Verify TypeScript compilation**

Run: `cd frontend && npx tsc --noEmit`
Expected: May show errors in ReaderPage.tsx where `window.__epubViewer` is still used — that's expected, will be fixed in Task 4.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/EpubViewer.tsx
git commit -m "refactor: EpubViewer forwardRef with useImperativeHandle, fix stale closures"
```

---

## Task 4: ReaderPage — Use Refs + Format-Aware Toolbar

This task combines the remaining I1 work (use refs in ReaderPage) with I4 (format-aware toolbar).

**Files:**
- Modify: `frontend/src/pages/Reader/ReaderPage.tsx`

- [ ] **Step 1: Rewrite ReaderPage with refs and format-aware toolbar**

Replace the entire `frontend/src/pages/Reader/ReaderPage.tsx` with:

```typescript
// frontend/src/pages/Reader/ReaderPage.tsx
import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Drawer, List, Spin, message, Space, InputNumber, Tag } from 'antd';
import { ArrowLeftOutlined, BookOutlined, StarOutlined, LeftOutlined, RightOutlined, ZoomInOutlined, ZoomOutOutlined, HighlightOutlined, MessageOutlined } from '@ant-design/icons';
import { bookApi, Book } from '../../services/bookApi';
import { annotationApi } from '../../services/annotationApi';
import type { Annotation } from '../../services/annotationApi';
import type { TocItem } from '../../types/reader';
import PdfViewer from '../../components/PdfViewer';
import type { PdfViewerRef } from '../../components/PdfViewer';
import EpubViewer from '../../components/EpubViewer';
import type { EpubViewerRef } from '../../components/EpubViewer';
import TextSelectionMenu from '../../components/TextSelectionMenu';
import AnnotationSidebar from '../../components/AnnotationSidebar';
import ReadingChatPanel from '../../components/ReadingChatPanel';

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
  const [showAnnotations, setShowAnnotations] = useState(false);
  const [selectionMenu, setSelectionMenu] = useState<{ visible: boolean; x: number; y: number; text: string }>({ visible: false, x: 0, y: 0, text: '' });
  const [showChat, setShowChat] = useState(false);
  const [chatContext, setChatContext] = useState('');

  const pdfRef = useRef<PdfViewerRef>(null);
  const epubRef = useRef<EpubViewerRef>(null);

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
    pdfRef.current?.goToPage(page);
  };

  const handleZoomIn = () => {
    const newZoom = Math.min(zoom + 20, 200);
    setZoom(newZoom);
    pdfRef.current?.handleZoomIn();
  };

  const handleZoomOut = () => {
    const newZoom = Math.max(zoom - 20, 50);
    setZoom(newZoom);
    pdfRef.current?.handleZoomOut();
  };

  const handleTextSelect = (text: string, rectOrCfi: any) => {
    if (rectOrCfi instanceof DOMRect) {
      setSelectionMenu({ visible: true, x: rectOrCfi.left + rectOrCfi.width / 2, y: rectOrCfi.top - 10, text });
    } else {
      // EPUB — position near center of screen
      setSelectionMenu({ visible: true, x: window.innerWidth / 2, y: 100, text });
    }
  };

  const handleHighlight = async (color: string) => {
    if (!bookId) return;
    try {
      await annotationApi.create({
        book_id: bookId,
        type: 'highlight',
        selected_text: selectionMenu.text,
        highlight_color: color,
        page_number: currentPage,
      });
      message.success('已高亮');
    } catch {
      message.error('高亮失败');
    }
    setSelectionMenu({ ...selectionMenu, visible: false });
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(selectionMenu.text).then(() => {
      message.success('已复制');
    }).catch(() => {
      message.error('复制失败');
    });
    setSelectionMenu({ ...selectionMenu, visible: false });
  };

  const handleAskAI = () => {
    setChatContext(selectionMenu.text);
    setShowChat(true);
    setSelectionMenu({ ...selectionMenu, visible: false });
  };

  const handleJumpToAnnotation = (annotation: Annotation) => {
    if (annotation.page_number) {
      goToPage(annotation.page_number);
    }
    setShowAnnotations(false);
  };

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}><Spin size="large" /></div>;
  }

  if (!book) {
    return <div>图书未找到</div>;
  }

  const isPdf = book.file_format === 'pdf';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '8px 16px', background: '#141414', borderBottom: '1px solid #303030', gap: 8 }}>
        <Button icon={<ArrowLeftOutlined />} type="text" onClick={() => navigate('/')} />
        <span style={{ flex: 1, textAlign: 'center', fontSize: 14 }}>{book.title}</span>
        <Space>
          {isPdf ? (
            <>
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
            </>
          ) : (
            <Tag style={{ fontSize: 11 }}>阅读中</Tag>
          )}
          <span style={{ width: 1, height: 16, background: '#303030' }} />
          <Button icon={<BookOutlined />} type="text" onClick={() => setShowToc(true)} />
          <Button icon={<HighlightOutlined />} type="text" onClick={() => setShowAnnotations(true)} />
          <Button icon={<StarOutlined />} type="text" />
          <Button icon={<MessageOutlined />} type="text" onClick={() => setShowChat(!showChat)} />
        </Space>
      </div>

      {/* Content area */}
      <div style={{ flex: 1, overflow: 'hidden', background: '#0a0a0a' }}>
        {isPdf ? (
          <PdfViewer
            ref={pdfRef}
            filePath={book.file_path}
            onPageChange={handlePageChange}
            onTocLoad={setToc}
            onTextSelect={handleTextSelect}
            initialPage={currentPage}
          />
        ) : book.file_format === 'epub' ? (
          <EpubViewer
            ref={epubRef}
            filePath={book.file_path}
            onLocationChange={(cfi, progress) => {
              if (bookId) {
                bookApi.updateProgress(bookId, { current_cfi: cfi, progress_percent: progress }).catch(() => {});
              }
            }}
            onTocLoad={setToc}
            onTextSelect={handleTextSelect}
            initialCfi={undefined}
          />
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
              onClick={() => {
                if (!isPdf && item.href) {
                  epubRef.current?.goToHref(item.href);
                } else {
                  goToPage(item.pageNumber);
                }
                setShowToc(false);
              }}
            >
              <span style={{ fontSize: 13 }}>{item.title}</span>
              <span style={{ color: '#888', fontSize: 11, marginLeft: 'auto' }}>P.{item.pageNumber}</span>
            </List.Item>
          )}
        />
      </Drawer>

      {/* Text Selection Menu */}
      <TextSelectionMenu
        visible={selectionMenu.visible}
        position={{ x: selectionMenu.x, y: selectionMenu.y }}
        selectedText={selectionMenu.text}
        onAskAI={handleAskAI}
        onHighlight={handleHighlight}
        onCopy={handleCopy}
        onClose={() => setSelectionMenu({ ...selectionMenu, visible: false })}
      />

      {/* Annotation Sidebar */}
      {bookId && (
        <AnnotationSidebar
          visible={showAnnotations}
          bookId={bookId}
          onClose={() => setShowAnnotations(false)}
          onJumpToAnnotation={handleJumpToAnnotation}
        />
      )}

      {/* Reading Chat Panel */}
      {bookId && (
        <ReadingChatPanel
          visible={showChat}
          bookId={bookId}
          selectedText={chatContext}
          onClose={() => { setShowChat(false); setChatContext(''); }}
        />
      )}
    </div>
  );
}
```

Key changes:
- Added `useRef<PdfViewerRef>` and `useRef<EpubViewerRef>`
- Passed `ref={pdfRef}` / `ref={epubRef}` to viewers
- Replaced `window.__pdfViewer?.goToPage()` with `pdfRef.current?.goToPage()`
- Replaced `window.__epubViewer?.goToHref()` with `epubRef.current?.goToHref()`
- Removed import of `EpubViewer`'s local `TocItem` (now uses shared type)
- Added `const isPdf = book.file_format === 'pdf'`
- Toolbar conditionally renders: PDF shows page nav + zoom, EPUB shows just a tag
- TOC click uses `epubRef.current?.goToHref()` for EPUB

- [ ] **Step 2: Verify TypeScript compilation**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors. All `window.__pdfViewer` and `window.__epubViewer` references are gone.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/Reader/ReaderPage.tsx
git commit -m "refactor: ReaderPage uses viewer refs, format-aware toolbar"
```

---

## Task 5: Fix Alembic env.py Imports

**Files:**
- Modify: `backend/alembic/env.py`

- [ ] **Step 1: Update env.py imports**

In `backend/alembic/env.py`, replace line 14:

```python
# OLD:
from app.models import Book, Tag, Bookshelf, Passage, Annotation, KnowledgeCard  # noqa: F401

# NEW:
import app.models  # noqa: F401 — registers all models with Base.metadata
```

This uses the `__init__.py` which already imports all models (Book, Tag, Bookshelf, Passage, Annotation, KnowledgeCard, CardLink, ReadingProgress, ReadingSession, book_tags, bookshelf_books).

- [ ] **Step 2: Verify Alembic can detect all models**

Run: `cd backend && python -c "from app.core.database import Base; from app.models import *; print([t for t in Base.metadata.tables.keys()])"`
Expected: Should list all tables including `reading_sessions`, `annotations`, `books`, etc.

- [ ] **Step 3: Commit**

```bash
git add backend/alembic/env.py
git commit -m "fix: import all models in alembic env.py"
```

---

## Task 6: Create Alembic Migration

**Files:**
- Create: `backend/alembic/versions/20260504_add_reading_session_and_annotation_fields.py`

- [ ] **Step 1: Generate migration**

Run: `cd backend && python -m alembic revision --autogenerate -m "add reading_session table and annotation fields"`

If autogenerate fails (e.g., no database connection), create the migration manually.

- [ ] **Step 2: Verify migration file content**

The generated migration should contain:

1. `op.create_table('reading_sessions', ...)` with columns: id (UUID PK), book_id (UUID FK), messages (JSON), context_passages (JSON), created_at (DateTime), updated_at (DateTime)
2. `op.add_column('annotations', ...)` for: highlight_color (String(20)), start_cfi (Text), end_cfi (Text), rect_data (Text)

If autogenerate produced something different, edit the file to match.

- [ ] **Step 3: Test migration (dry run)**

Run: `cd backend && python -m alembic upgrade head --sql > /dev/null && echo "Migration OK"`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add backend/alembic/versions/
git commit -m "feat: add migration for reading_sessions table and annotation fields"
```

---

## Task 7: Final Verification

- [ ] **Step 1: Run frontend type check**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 2: Run backend tests**

Run: `cd backend && python -m pytest tests/ -v --tb=short`
Expected: All tests pass.

- [ ] **Step 3: Verify no window globals remain**

Run: `grep -r "window.__pdfViewer\|window.__epubViewer" frontend/src/`
Expected: No matches.

- [ ] **Step 4: Verify no duplicate TocItem definitions**

Run: `grep -rn "interface TocItem" frontend/src/`
Expected: Only one match in `frontend/src/types/reader.ts`.

---

## Spec Coverage

| Spec Requirement | Task |
|------------------|------|
| I1: forwardRef refactor — PdfViewer | Task 2 |
| I1: forwardRef refactor — EpubViewer | Task 3 |
| I1: forwardRef refactor — ReaderPage use refs | Task 4 |
| I2: TocItem deduplication | Task 1 |
| I3: Keyboard handler scoping | Task 2 |
| I4: Format-aware toolbar | Task 4 |
| I5: Stale closure fix | Task 3 |
| I6: Alembic migration | Task 6 |
| I7: env.py imports | Task 5 |
