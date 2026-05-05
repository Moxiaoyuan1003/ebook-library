# Phase 5: Value-Add Features

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add smart shelves, series grouping, cover gallery, reading speed stats, note PDF export, share cards, system tray, reading reminders, AI recommendations, and font customization.

**Depends on:** Phase 3 (stats, sessions, bookmarks) and Phase 4 (backup, goals).

---

### Task 1: Smart shelves

**Files:**
- Modify: `backend/app/models/bookshelf.py` (add `rules` JSON field)
- Modify: `backend/app/api/bookshelves.py` (auto-filter by rules)
- Modify: `frontend/src/components/Layout/Sidebar.tsx` (smart shelf UI)

- [ ] **Step 1: Add rules field to Bookshelf model**

```python
rules = Column(JSON, nullable=True)  # e.g. {"file_format": "pdf", "min_rating": 4}
```

- [ ] **Step 2: Modify bookshelf books endpoint to filter by rules**

If `bookshelf.rules` is set, filter books dynamically instead of using the join table.

- [ ] **Step 3: Add "智能书架" option in create shelf modal**

Radio toggle: "普通书架" vs "智能书架". Smart shelf shows rule configuration form.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat: add smart shelves with auto-filtering rules"
```

---

### Task 2: Font/typography customization for reader

**Files:**
- Create: `frontend/src/stores/readerSettingsStore.ts`
- Modify: `frontend/src/pages/Reader/ReaderPage.tsx` (add settings panel)

- [ ] **Step 1: Create readerSettingsStore**

```typescript
// frontend/src/stores/readerSettingsStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ReaderSettings {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  marginMode: 'narrow' | 'medium' | 'wide';
  setFontFamily: (f: string) => void;
  setFontSize: (s: number) => void;
  setLineHeight: (h: number) => void;
  setMarginMode: (m: 'narrow' | 'medium' | 'wide') => void;
}

export const useReaderSettingsStore = create<ReaderSettings>()(
  persist(
    (set) => ({
      fontFamily: 'system-ui',
      fontSize: 16,
      lineHeight: 1.6,
      marginMode: 'medium',
      setFontFamily: (fontFamily) => set({ fontFamily }),
      setFontSize: (fontSize) => set({ fontSize }),
      setLineHeight: (lineHeight) => set({ lineHeight }),
      setMarginMode: (marginMode) => set({ marginMode }),
    }),
    { name: 'ebook-reader-settings' },
  ),
);
```

- [ ] **Step 2: Add settings panel to ReaderPage**

Gear icon button in toolbar opens a popover with:
- Font family select (system-ui, 宋体, 黑体, 楷体)
- Font size slider (12-24px)
- Line height slider (1.2-2.0)
- Margin mode (narrow/medium/wide buttons)

- [ ] **Step 3: Apply settings to EPUB viewer**

Pass `fontFamily`, `fontSize`, `lineHeight` to epubjs `rendition.themes.override()`.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat: add reader font/typography customization settings"
```

---

### Task 3: Cover gallery view

**Files:**
- Modify: `frontend/src/pages/Library/LibraryPage.tsx` (add gallery mode)

- [ ] **Step 1: Add 'gallery' to viewMode options**

```typescript
<Segmented
  value={viewMode}
  onChange={(v) => setViewMode(v as 'grid' | 'list' | 'gallery')}
  options={[
    { value: 'grid', icon: <AppstoreOutlined /> },
    { value: 'list', icon: <UnorderedListOutlined /> },
    { value: 'gallery', icon: <PictureOutlined /> },
  ]}
/>
```

- [ ] **Step 2: Add gallery view rendering**

Large cover images in a 3-column grid, hover shows title + author overlay, click goes to detail page.

- [ ] **Step 3: Commit**

```bash
git commit -m "feat: add cover gallery view mode to library"
```

---

### Task 4: Reading speed stats

**Files:**
- Modify: `frontend/src/pages/Stats/StatsPage.tsx` (add speed section)

- [ ] **Step 1: Calculate speed from reading_sessions**

```typescript
// In StatsPage, after loading stats:
const avgSpeed = stats.total_minutes > 0
  ? Math.round((stats.finished * 300) / stats.total_minutes * 10) / 10  // rough pages/hour
  : 0;
```

- [ ] **Step 2: Add speed card to stats page**

A new stat card showing "平均阅读速度" with pages/hour value.

- [ ] **Step 3: Commit**

```bash
git commit -m "feat: add reading speed statistics"
```

---

### Task 5: System tray (Electron)

**Files:**
- Modify: `frontend/electron/main.ts`

- [ ] **Step 1: Add tray setup**

```typescript
import { Tray, Menu, nativeImage } from 'electron';

let tray: Tray | null = null;

function createTray() {
  const icon = nativeImage.createFromPath('path/to/icon.png');
  tray = new Tray(icon);
  const contextMenu = Menu.buildFromTemplate([
    { label: '打开主窗口', click: () => mainWindow?.show() },
    { type: 'separator' },
    { label: '退出', click: () => { mainWindow?.destroy(); app.quit(); } },
  ]);
  tray.setToolTip('个人图书管理器');
  tray.setContextMenu(contextMenu);
  tray.on('click', () => mainWindow?.show());
}
```

- [ ] **Step 2: Override close to minimize to tray**

```typescript
mainWindow.on('close', (e) => {
  if (!app.isQuitting) {
    e.preventDefault();
    mainWindow.hide();
  }
});
```

- [ ] **Step 3: Commit**

```bash
git commit -m "feat: add system tray minimize support"
```

---

### Task 6: Reading reminders (Electron)

**Files:**
- Modify: `frontend/electron/main.ts` (notification scheduler)
- Modify: `frontend/src/pages/Settings/SettingsPage.tsx` (reminder config)

- [ ] **Step 1: Add reminder scheduling in main process**

Use `setInterval` to check if current time matches configured reminder time. Show native notification.

- [ ] **Step 2: Add reminder settings in SettingsPage**

Time picker for reminder time, stored in localStorage via IPC.

- [ ] **Step 3: Commit**

```bash
git commit -m "feat: add daily reading reminder notifications"
```

---

### Task 7: AI-powered book recommendations

**Files:**
- Create: `backend/app/api/recommendations.py`
- Modify: `frontend/src/pages/Library/LibraryPage.tsx` (add recommendations section)

- [ ] **Step 1: Create recommendations endpoint**

```python
@router.get("/api/recommendations")
def get_recommendations(db=Depends(get_db)):
    # Get user's favorite tags and high-rated books
    favorites = db.query(Book).filter(Book.is_favorite == True).all()
    # Use AI to generate recommendations based on reading history
    # Fallback: recommend books with similar tags
    return {"recommendations": []}
```

- [ ] **Step 2: Add "为你推荐" section to LibraryPage**

Show at the top of library when no filters are active.

- [ ] **Step 3: Commit**

```bash
git commit -m "feat: add AI-powered book recommendations"
```

---

### Task 8: Series/grouping

**Files:**
- Create: `backend/app/models/series.py`
- Modify: `backend/app/api/books.py` (series endpoints)
- Modify: `frontend/src/pages/BookDetail/BookDetailPage.tsx` (series field)

- [ ] **Step 1: Create Series model and endpoints**

```python
class Series(Base):
    __tablename__ = "series"
    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    description = Column(String, default="")
```

Add `series_id` to Book model. Add CRUD endpoints for series.

- [ ] **Step 2: Add series field to BookDetailPage**

Display series name, show other books in same series.

- [ ] **Step 3: Commit**

```bash
git commit -m "feat: add book series/grouping support"
```

---

### Task 9: Share card generation

**Files:**
- Modify: `frontend/src/pages/BookDetail/BookDetailPage.tsx` (add share button)

- [ ] **Step 1: Install html2canvas**

Run: `cd f:/Code/ebook-library/frontend && npm install html2canvas`

- [ ] **Step 2: Add share card generation**

```typescript
const generateShareCard = async () => {
  const el = document.getElementById('share-card');
  if (!el) return;
  const html2canvas = (await import('html2canvas')).default;
  const canvas = await html2canvas(el);
  const link = document.createElement('a');
  link.download = `${book.title}-share.png`;
  link.href = canvas.toDataURL();
  link.click();
};
```

- [ ] **Step 3: Commit**

```bash
git commit -m "feat: add book share card image generation"
```

---

### Task 10: Full integration test

- [ ] **Step 1: Run full TypeScript check**

Run: `cd f:/Code/ebook-library/frontend && npx tsc --noEmit 2>&1`
Expected: no errors

- [ ] **Step 2: Run backend**

Run: `cd f:/Code/ebook-library/backend && python -m app.main`
Expected: server starts without errors

- [ ] **Step 3: Manual smoke test**

Test each feature:
- Switch between 3 themes → all pages update
- Drag file to library → imports
- Open book detail → shows cover, tags, notes
- Search → returns results with highlighting
- Stats page → shows charts
- Bookmarks → toggle works in reader
- Notes export → downloads .md file
- Backup → exports zip

- [ ] **Step 4: Final commit**

```bash
git add .
git commit -m "feat: complete Phase 5 value-add features"
```
