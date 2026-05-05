# Phase 2: UI Redesign + Drag Import

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Modernize all page UIs using the Phase 1 theme token system, add drag-and-drop import, skeleton loading, and empty states.

**Architecture:** Each page component imports `useThemeStore` for tokens and replaces hardcoded Ant Design styling with token-driven inline styles. New components (Skeleton, DragImport, EmptyState) are reusable.

**Tech Stack:** React + TypeScript + Ant Design + theme tokens from Phase 1

**Depends on:** Phase 1 (theme system) must be complete.

---

## File Structure

```
frontend/src/
├── components/
│   ├── BookCard.tsx           # REWRITE: themed card with cover, progress, hover
│   ├── SkeletonCard.tsx       # CREATE: loading skeleton
│   ├── DragImportZone.tsx     # CREATE: drag-and-drop import overlay
│   ├── EmptyState.tsx         # CREATE: empty state with illustration
│   ├── TextSelectionMenu.tsx  # MODIFY: themed, animated
│   └── ReadingChatPanel.tsx   # MODIFY: themed chat bubbles
├── pages/
│   ├── Library/
│   │   └── LibraryPage.tsx    # REWRITE: filters, skeleton, drag import
│   ├── Reader/
│   │   └── ReaderPage.tsx     # MODIFY: floating toolbar, progress bar
│   ├── AiAssistant/
│   │   └── AiAssistantPage.tsx # REWRITE: themed bubbles, markdown
│   └── KnowledgeCards/
│       └── KnowledgeCardsPage.tsx # REWRITE: card wall, tag filter
```

---

### Task 1: Create SkeletonCard component

**Files:**
- Create: `frontend/src/components/SkeletonCard.tsx`

- [ ] **Step 1: Create SkeletonCard**

```typescript
// frontend/src/components/SkeletonCard.tsx
import { useThemeStore } from '../stores/themeStore';

export default function SkeletonCard() {
  const tokens = useThemeStore((s) => s.tokens);

  const shimmer = {
    background: `linear-gradient(90deg, ${tokens.cardBg} 25%, rgba(255,255,255,0.06) 50%, ${tokens.cardBg} 75%)`,
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.5s infinite',
    borderRadius: 8,
  };

  return (
    <div
      style={{
        background: tokens.cardBg,
        border: tokens.cardBorder,
        borderRadius: tokens.radius,
        padding: 16,
      }}
    >
      <div style={{ ...shimmer, width: 60, height: 80, marginBottom: 12 }} />
      <div style={{ ...shimmer, width: '80%', height: 14, marginBottom: 8 }} />
      <div style={{ ...shimmer, width: '50%', height: 12, marginBottom: 12 }} />
      <div style={{ ...shimmer, width: '100%', height: 4 }} />
    </div>
  );
}
```

- [ ] **Step 2: Add shimmer animation to index.css**

Read `frontend/src/index.css` and add:

```css
@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd f:/Code/ebook-library/frontend && npx tsc --noEmit 2>&1 | grep "SkeletonCard"`
Expected: no errors

---

### Task 2: Create EmptyState component

**Files:**
- Create: `frontend/src/components/EmptyState.tsx`

- [ ] **Step 1: Create EmptyState**

```typescript
// frontend/src/components/EmptyState.tsx
import { Button } from 'antd';
import { useThemeStore } from '../stores/themeStore';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

export default function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  const tokens = useThemeStore((s) => s.tokens);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 64,
        color: tokens.textSecondary,
      }}
    >
      {icon && <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.5 }}>{icon}</div>}
      <div style={{ fontSize: 16, fontWeight: 600, color: tokens.text, marginBottom: 8 }}>{title}</div>
      {description && <div style={{ fontSize: 13, marginBottom: 24, textAlign: 'center' }}>{description}</div>}
      {action && (
        <Button type="primary" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd f:/Code/ebook-library/frontend && npx tsc --noEmit 2>&1 | grep "EmptyState"`
Expected: no errors

---

### Task 3: Create DragImportZone component

**Files:**
- Create: `frontend/src/components/DragImportZone.tsx`

- [ ] **Step 1: Create DragImportZone**

```typescript
// frontend/src/components/DragImportZone.tsx
import { useState, useCallback } from 'react';
import { message } from 'antd';
import { useThemeStore } from '../stores/themeStore';
import { bookApi } from '../services/bookApi';

interface DragImportZoneProps {
  onImportComplete?: () => void;
  children: React.ReactNode;
}

export default function DragImportZone({ onImportComplete, children }: DragImportZoneProps) {
  const tokens = useThemeStore((s) => s.tokens);
  const [dragging, setDragging] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget === e.target) setDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    let successCount = 0;
    for (const file of files) {
      try {
        await bookApi.importFile(file.path);
        successCount++;
      } catch {
        // skip failed files
      }
    }

    if (successCount > 0) {
      message.success(`成功导入 ${successCount} 本书籍`);
      onImportComplete?.();
    }
  }, [onImportComplete]);

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{ position: 'relative', height: '100%' }}
    >
      {children}
      {dragging && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 100,
            background: 'rgba(59,130,246,0.15)',
            backdropFilter: 'blur(4px)',
            border: `2px dashed ${tokens.primary}`,
            borderRadius: tokens.radius,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 18,
            fontWeight: 600,
            color: tokens.primary,
          }}
        >
          释放文件以导入
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd f:/Code/ebook-library/frontend && npx tsc --noEmit 2>&1 | grep "DragImportZone"`
Expected: no errors

---

### Task 4: Rewrite BookCard with theme tokens

**Files:**
- Rewrite: `frontend/src/components/BookCard.tsx`

- [ ] **Step 1: Read current BookCard**

Read `frontend/src/components/BookCard.tsx` to understand current structure.

- [ ] **Step 2: Rewrite BookCard**

Replace hardcoded colors with tokens. Add hover animation, gradient progress bar, cover with fallback.

```typescript
// frontend/src/components/BookCard.tsx
import { useState, useEffect } from 'react';
import { Dropdown, message, Modal, Rate, Select } from 'antd';
import { HeartOutlined, HeartFilled, MoreOutlined, ReadOutlined, StarOutlined, DeleteOutlined, FolderOutlined } from '@ant-design/icons';
import { useThemeStore } from '../stores/themeStore';
import { useBookStore } from '../stores/bookStore';
import { Book, bookApi } from '../services/bookApi';
import axios from 'axios';
import API_BASE from '../services/apiConfig';

interface BookCardProps {
  book: Book;
  onClick: (book: Book) => void;
}

function generateGradient(title: string): string {
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    hash = title.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h1 = Math.abs(hash % 360);
  const h2 = (h1 + 40) % 360;
  return `linear-gradient(135deg, hsl(${h1},60%,40%), hsl(${h2},60%,30%))`;
}

export default function BookCard({ book, onClick }: BookCardProps) {
  const tokens = useThemeStore((s) => s.tokens);
  const toggleFavorite = useBookStore((s) => s.toggleFavorite);
  const updateRating = useBookStore((s) => s.updateRating);
  const deleteBook = useBookStore((s) => s.deleteBook);
  const [shelves, setShelves] = useState<{ id: string; name: string }[]>([]);
  const [shelfModalOpen, setShelfModalOpen] = useState(false);
  const [selectedShelfId, setSelectedShelfId] = useState<string>('');
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    axios.get(`${API_BASE}/api/bookshelves/`).then((r) => setShelves(r.data)).catch(() => {});
  }, []);

  const handleAddToShelf = async () => {
    if (!selectedShelfId) return;
    try {
      await axios.post(`${API_BASE}/api/bookshelves/${selectedShelfId}/books`, { book_id: book.id });
      message.success('已加入书架');
      setShelfModalOpen(false);
    } catch { message.error('操作失败'); }
  };

  const progress = (book as any).progress_percent ?? 0;
  const coverUrl = book.cover_url ? `${API_BASE}/covers/${book.cover_url}` : null;

  const menuItems = [
    { key: 'read', icon: <ReadOutlined />, label: '阅读', onClick: () => onClick(book) },
    { key: 'fav', icon: book.is_favorite ? <HeartFilled style={{ color: '#ff4d4f' }} /> : <HeartOutlined />, label: book.is_favorite ? '取消收藏' : '收藏', onClick: () => toggleFavorite(book.id) },
    { key: 'shelf', icon: <FolderOutlined />, label: '加入书架', onClick: () => setShelfModalOpen(true) },
    { key: 'delete', icon: <DeleteOutlined />, label: '删除', danger: true, onClick: () => { Modal.confirm({ title: '确认删除?', onOk: () => deleteBook(book.id) }); } },
  ];

  return (
    <div
      onClick={() => onClick(book)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: tokens.cardBg,
        border: tokens.cardBorder,
        borderRadius: tokens.radius,
        padding: 14,
        cursor: 'pointer',
        transition: 'transform 0.2s, box-shadow 0.2s',
        transform: hovered ? 'translateY(-4px)' : 'none',
        boxShadow: hovered ? tokens.cardShadow : 'none',
      }}
    >
      {/* Cover */}
      <div
        style={{
          width: 56,
          height: 76,
          borderRadius: 8,
          background: coverUrl ? `url(${coverUrl}) center/cover` : generateGradient(book.title),
          marginBottom: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 11,
          color: '#fff',
          textAlign: 'center',
          padding: 4,
          overflow: 'hidden',
        }}
      >
        {!coverUrl && book.title.slice(0, 6)}
      </div>

      {/* Title + Author */}
      <div style={{ fontSize: 13, fontWeight: 600, color: tokens.text, marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {book.title}
      </div>
      <div style={{ fontSize: 11, color: tokens.textSecondary, marginBottom: 8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {book.author || '未知作者'}
      </div>

      {/* Rating */}
      <Rate
        value={book.rating || 0}
        onChange={(v) => updateRating(book.id, v)}
        count={5}
        style={{ fontSize: 12 }}
        character={<StarOutlined />}
      />

      {/* Progress bar */}
      <div style={{ marginTop: 8, height: 3, background: tokens.border, borderRadius: 2, overflow: 'hidden' }}>
        <div
          style={{
            width: `${progress}%`,
            height: '100%',
            background: tokens.primaryGradient
              ? `linear-gradient(90deg, ${tokens.primaryGradient.join(', ')})`
              : tokens.primary,
            borderRadius: 2,
            transition: 'width 0.3s',
          }}
        />
      </div>

      {/* Actions row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
        <span
          onClick={(e) => { e.stopPropagation(); toggleFavorite(book.id); }}
          style={{ cursor: 'pointer', color: book.is_favorite ? '#ff4d4f' : tokens.textMuted, fontSize: 14 }}
        >
          {book.is_favorite ? <HeartFilled /> : <HeartOutlined />}
        </span>
        <Dropdown menu={{ items: menuItems }} trigger={['click']}>
          <span
            onClick={(e) => e.stopPropagation()}
            style={{ color: tokens.textMuted, cursor: 'pointer', fontSize: 14 }}
          >
            <MoreOutlined />
          </span>
        </Dropdown>
      </div>

      {/* Add to shelf modal */}
      <Modal
        title="加入书架"
        open={shelfModalOpen}
        onOk={handleAddToShelf}
        onCancel={() => setShelfModalOpen(false)}
        okText="添加"
        cancelText="取消"
      >
        <Select
          placeholder="选择书架"
          style={{ width: '100%' }}
          value={selectedShelfId || undefined}
          onChange={setSelectedShelfId}
          options={shelves.map((s) => ({ value: s.id, label: s.name }))}
        />
      </Modal>
    </div>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd f:/Code/ebook-library/frontend && npx tsc --noEmit 2>&1 | grep "BookCard"`
Expected: no errors

---

### Task 5: Rewrite LibraryPage with filters, skeleton, drag import

**Files:**
- Rewrite: `frontend/src/pages/Library/LibraryPage.tsx`

- [ ] **Step 1: Read current LibraryPage**

Read `frontend/src/pages/Library/LibraryPage.tsx` to understand current structure.

- [ ] **Step 2: Rewrite LibraryPage**

Key changes:
- Wrap in `DragImportZone`
- Add filter chips (全部/最近阅读/已收藏/书架名)
- Show `SkeletonCard` while loading
- Show `EmptyState` when no books
- Use theme tokens for all colors
- Keep "加载更多" button for pagination

```typescript
// frontend/src/pages/Library/LibraryPage.tsx
import { useEffect, useState, useRef } from 'react';
import { Input, Segmented, Button, Pagination } from 'antd';
import { AppstoreOutlined, UnorderedListOutlined, ImportOutlined, BookOutlined } from '@ant-design/icons';
import { useBookStore } from '../../stores/bookStore';
import { useThemeStore } from '../../stores/themeStore';
import BookCard from '../../components/BookCard';
import SkeletonCard from '../../components/SkeletonCard';
import EmptyState from '../../components/EmptyState';
import DragImportZone from '../../components/DragImportZone';
import ImportDialog from '../../components/ImportDialog';
import { Book } from '../../services/bookApi';
import { useNavigate } from 'react-router-dom';

export default function LibraryPage() {
  const [importOpen, setImportOpen] = useState(false);
  const tokens = useThemeStore((s) => s.tokens);
  const {
    books, total, page, pageSize, loading,
    searchQuery, viewMode, filterStatus, filterFavorite, filterShelfId, filterShelfName,
    fetchBooks, setSearchQuery, setViewMode, setPage, setFilterStatus, setFilterFavorite,
  } = useBookStore();
  const navigate = useNavigate();

  useEffect(() => { fetchBooks(); }, [page, searchQuery, filterStatus, filterFavorite, filterShelfId]);

  const handleBookClick = (book: Book) => { navigate(`/book/${book.id}`); };

  const filters = [
    { key: 'all', label: '全部', active: !filterStatus && !filterFavorite && !filterShelfId },
    { key: 'recent', label: '最近阅读', active: filterStatus === 'reading' },
    { key: 'favorites', label: '已收藏', active: !!filterFavorite },
  ];

  const handleFilterClick = (key: string) => {
    if (key === 'all') { setFilterStatus(null); setFilterFavorite(false); }
    else if (key === 'recent') { setFilterStatus('reading'); }
    else if (key === 'favorites') { setFilterFavorite(true); }
  };

  return (
    <DragImportZone onImportComplete={fetchBooks}>
      <div style={{ padding: 24 }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h2 style={{ margin: 0, color: tokens.text }}>
              {filterShelfName ? `书架: ${filterShelfName}` : '全部书籍'}
            </h2>
            <span style={{ color: tokens.textMuted, fontSize: 13 }}>{total} 本</span>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Button type="primary" icon={<ImportOutlined />} onClick={() => setImportOpen(true)}>
              导入
            </Button>
            <Input.Search
              placeholder="搜索书名或作者"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onSearch={fetchBooks}
              style={{ width: 200 }}
            />
            <Segmented
              value={viewMode}
              onChange={(v) => setViewMode(v as 'grid' | 'list')}
              options={[
                { value: 'grid', icon: <AppstoreOutlined /> },
                { value: 'list', icon: <UnorderedListOutlined /> },
              ]}
            />
          </div>
        </div>

        {/* Filter chips */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {filters.map((f) => (
            <div
              key={f.key}
              onClick={() => handleFilterClick(f.key)}
              style={{
                padding: '4px 14px',
                borderRadius: 20,
                fontSize: 13,
                cursor: 'pointer',
                background: f.active ? tokens.primary : 'transparent',
                color: f.active ? '#fff' : tokens.textSecondary,
                border: `1px solid ${f.active ? tokens.primary : tokens.border}`,
                transition: 'all 0.2s',
              }}
            >
              {f.label}
            </div>
          ))}
          {filterShelfId && (
            <div
              style={{ padding: '4px 14px', borderRadius: 20, fontSize: 13, background: tokens.primary, color: '#fff' }}
            >
              {filterShelfName}
            </div>
          )}
        </div>

        {/* Content */}
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16 }}>
            {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : books.length === 0 ? (
          <EmptyState
            icon={<BookOutlined />}
            title="你的书库还是空的"
            description="导入你的第一本电子书开始阅读"
            action={{ label: '导入图书', onClick: () => setImportOpen(true) }}
          />
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16 }}>
              {books.map((book) => <BookCard key={book.id} book={book} onClick={handleBookClick} />)}
            </div>
            <div style={{ textAlign: 'center', marginTop: 24 }}>
              <Pagination current={page} total={total} pageSize={pageSize} onChange={setPage} showSizeChanger={false} />
            </div>
          </>
        )}

        <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} />
      </div>
    </DragImportZone>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd f:/Code/ebook-library/frontend && npx tsc --noEmit 2>&1 | grep "LibraryPage"`
Expected: no errors

---

### Task 6: Update ReaderPage with floating toolbar and progress bar

**Files:**
- Modify: `frontend/src/pages/Reader/ReaderPage.tsx`

- [ ] **Step 1: Read current ReaderPage**

Read `frontend/src/pages/Reader/ReaderPage.tsx` to understand current structure.

- [ ] **Step 2: Add floating toolbar and progress bar**

Key changes:
- Toolbar: position fixed at top, opacity transition, hidden by default, show on mouse enter top 60px
- Progress bar: fixed at bottom, 3px height, theme primary gradient, hover expands
- Use `useThemeStore` tokens for all colors
- Add `getReaderBg()` for reader background

The toolbar logic:
```typescript
const [toolbarVisible, setToolbarVisible] = useState(false);
const hideTimerRef = useRef<NodeJS.Timeout>();

const handleMouseMove = useCallback((e: React.MouseEvent) => {
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
  const y = e.clientY - rect.top;
  if (y < 60) {
    setToolbarVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setToolbarVisible(false), 3000);
  }
}, []);
```

The progress bar:
```typescript
// At the bottom of the return JSX
<div
  style={{
    position: 'fixed', bottom: 0, left: 0, right: 0,
    height: 3, background: tokens.border, zIndex: 100,
  }}
>
  <div
    style={{
      width: totalPages > 0 ? `${(currentPage / totalPages) * 100}%` : '0%',
      height: '100%',
      background: tokens.primaryGradient
        ? `linear-gradient(90deg, ${tokens.primaryGradient.join(', ')})`
        : tokens.primary,
      transition: 'width 0.3s',
    }}
  />
</div>
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd f:/Code/ebook-library/frontend && npx tsc --noEmit 2>&1 | grep "ReaderPage"`
Expected: no errors

---

### Task 7: Update TextSelectionMenu with theme tokens

**Files:**
- Modify: `frontend/src/components/TextSelectionMenu.tsx`

- [ ] **Step 1: Update TextSelectionMenu**

Replace hardcoded `#1f1f1f`, `#333`, `#444` with theme tokens. Add scale+fade animation on appear.

```typescript
// Add at the top
import { useThemeStore } from '../stores/themeStore';

// Inside the component
const tokens = useThemeStore((s) => s.tokens);

// Replace hardcoded colors:
// background: '#1f1f1f' → tokens.cardBg
// background: '#333' → tokens.sidebar (for hover)
// background: '#444' → tokens.border (for dividers)
// color: '#e0e0e0' → tokens.text

// Add animation wrapper:
// style={{ ... existing, animation: 'menuAppear 0.15s ease-out' }}
```

- [ ] **Step 2: Add menuAppear animation to index.css**

```css
@keyframes menuAppear {
  from { opacity: 0; transform: translate(-50%, -100%) scale(0.9); }
  to { opacity: 1; transform: translate(-50%, -100%) scale(1); }
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd f:/Code/ebook-library/frontend && npx tsc --noEmit 2>&1 | grep "TextSelectionMenu"`
Expected: no errors

---

### Task 8: Rewrite AiAssistantPage with themed chat

**Files:**
- Rewrite: `frontend/src/pages/AiAssistant/AiAssistantPage.tsx`

- [ ] **Step 1: Read current AiAssistantPage**

Read `frontend/src/pages/AiAssistant/AiAssistantPage.tsx` to understand current structure.

- [ ] **Step 2: Rewrite with themed chat bubbles**

Key changes:
- User messages: right-aligned, primary gradient background, white text
- AI messages: left-aligned, cardBg background, text color
- Input: fixed at bottom, themed
- Use `tokens` for all colors

```typescript
// Chat bubble styles
const userBubble = {
  background: tokens.primaryGradient
    ? `linear-gradient(135deg, ${tokens.primaryGradient.join(', ')})`
    : tokens.primary,
  color: '#fff',
  borderRadius: `${tokens.radius}px ${tokens.radius}px 4px ${tokens.radius}px`,
  padding: '10px 14px',
  maxWidth: '70%',
};

const aiBubble = {
  background: tokens.cardBg,
  border: tokens.cardBorder,
  color: tokens.text,
  borderRadius: `${tokens.radius}px ${tokens.radius}px ${tokens.radius}px 4px`,
  padding: '10px 14px',
  maxWidth: '80%',
};
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd f:/Code/ebook-library/frontend && npx tsc --noEmit 2>&1 | grep "AiAssistantPage"`
Expected: no errors

---

### Task 9: Rewrite KnowledgeCardsPage with card wall and tag filter

**Files:**
- Rewrite: `frontend/src/pages/KnowledgeCards/KnowledgeCardsPage.tsx`

- [ ] **Step 1: Read current KnowledgeCardsPage**

Read `frontend/src/pages/KnowledgeCards/KnowledgeCardsPage.tsx` to understand current structure.

- [ ] **Step 2: Rewrite with card wall layout**

Key changes:
- Multi-column grid (auto-fill, minmax 280px)
- Cards: themed with hover effect, 3-line content truncation
- Tag filter chips at top
- Search bar
- Use tokens for all colors

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd f:/Code/ebook-library/frontend && npx tsc --noEmit 2>&1 | grep "KnowledgeCardsPage"`
Expected: no errors

---

### Task 10: Full TypeScript check and commit

- [ ] **Step 1: Run full type check**

Run: `cd f:/Code/ebook-library/frontend && npx tsc --noEmit 2>&1`
Expected: no errors

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/ frontend/src/pages/
git commit -m "feat: modernize all page UIs with theme tokens

- Add SkeletonCard, EmptyState, DragImportZone components
- Rewrite BookCard with hover animation, gradient progress, themed
- Rewrite LibraryPage with filter chips, skeleton loading, drag import
- Update ReaderPage with floating toolbar, bottom progress bar
- Rewrite AiAssistantPage with themed chat bubbles
- Rewrite KnowledgeCardsPage with card wall layout and tag filters
- Update TextSelectionMenu with theme tokens and appear animation"
```
