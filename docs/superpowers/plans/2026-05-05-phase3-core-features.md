# Phase 3: Core Features — Detail, Stats, Search, Timer, Bookmarks

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add book detail page, reading statistics dashboard, full-text search, reading session timer, and bookmark functionality.

**Architecture:** New pages follow the same pattern: Zustand store + page component + backend API. Backend changes add new tables (`reading_sessions`, `bookmarks`) and endpoints. Cover extraction runs at import time.

**Tech Stack:** React + TypeScript + recharts + theme tokens + FastAPI + SQLite

**Depends on:** Phase 1 (theme system) and Phase 2 (UI components).

---

## Backend Changes (Tasks 1-4)

### Task 1: Database schema — add tags, cover_path, reading_sessions, bookmarks

**Files:**
- Modify: `backend/app/models/book.py` (or equivalent ORM model)
- Create: `backend/app/models/reading_session.py`
- Create: `backend/app/models/bookmark.py`

- [ ] **Step 1: Add fields to Book model**

Add to the Book model:
```python
tags: list[str] = Field(default_factory=list, sa_column=Column(JSON))
cover_path: str | None = None
```

- [ ] **Step 2: Create ReadingSession model**

```python
# backend/app/models/reading_session.py
from sqlalchemy import Column, String, DateTime, Integer, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime
import uuid

class ReadingSession(Base):
    __tablename__ = "reading_sessions"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    book_id = Column(String, ForeignKey("books.id"), nullable=False)
    start_time = Column(DateTime, nullable=False, default=datetime.utcnow)
    end_time = Column(DateTime, nullable=True)
    pages_read = Column(Integer, default=0)
```

- [ ] **Step 3: Create Bookmark model**

```python
# backend/app/models/bookmark.py
class Bookmark(Base):
    __tablename__ = "bookmarks"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    book_id = Column(String, ForeignKey("books.id"), nullable=False)
    page_number = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
```

- [ ] **Step 4: Run migration**

```bash
cd f:/Code/ebook-library/backend
alembic revision --autogenerate -m "add tags cover reading_sessions bookmarks"
alembic upgrade head
```

- [ ] **Step 5: Commit**

```bash
git add backend/app/models/
git commit -m "feat: add tags, cover_path, reading_sessions, bookmarks to DB schema"
```

---

### Task 2: Backend APIs — search, stats, tags, bookmarks, cover

**Files:**
- Create: `backend/app/api/search.py`
- Create: `backend/app/api/stats.py`
- Modify: `backend/app/api/books.py` (add tags, cover, bookmarks endpoints)

- [ ] **Step 1: Create search endpoint**

```python
# backend/app/api/search.py
from fastapi import APIRouter, Query
from ..models.book import Book
from ..models.annotation import Annotation
from ..models.knowledge_card import KnowledgeCard
from ..deps import get_db

router = APIRouter(prefix="/api/search", tags=["search"])

@router.get("/")
def search(q: str = Query(..., min_length=1), db=Depends(get_db)):
    pattern = f"%{q}%"
    books = db.query(Book).filter(
        Book.title.ilike(pattern) | Book.author.ilike(pattern)
    ).limit(20).all()
    annotations = db.query(Annotation).filter(
        Annotation.selected_text.ilike(pattern) | Annotation.note_content.ilike(pattern)
    ).limit(20).all()
    cards = db.query(KnowledgeCard).filter(
        KnowledgeCard.title.ilike(pattern) | KnowledgeCard.content.ilike(pattern)
    ).limit(20).all()
    return {
        "books": [{"id": str(b.id), "title": b.title, "match_field": "title", "snippet": b.title} for b in books],
        "annotations": [{"id": str(a.id), "book_title": a.book_id, "snippet": (a.selected_text or "")[:100], "page": a.page_number} for a in annotations],
        "knowledge_cards": [{"id": str(c.id), "title": c.title, "snippet": (c.content or "")[:100]} for c in cards],
    }
```

- [ ] **Step 2: Create stats endpoint**

```python
# backend/app/api/stats.py
from fastapi import APIRouter, Depends
from sqlalchemy import func
from ..models.book import Book
from ..models.reading_session import ReadingSession
from ..deps import get_db
from datetime import datetime, timedelta

router = APIRouter(prefix="/api/stats", tags=["stats"])

@router.get("/")
def get_stats(db=Depends(get_db)):
    total_books = db.query(func.count(Book.id)).scalar()
    finished = db.query(func.count(Book.id)).filter(Book.reading_status == "finished").scalar()
    reading = db.query(func.count(Book.id)).filter(Book.reading_status == "reading").scalar()

    # Total reading time
    sessions = db.query(ReadingSession).filter(ReadingSession.end_time.isnot(None)).all()
    total_minutes = sum(
        (s.end_time - s.start_time).total_seconds() / 60 for s in sessions
    )

    # Format distribution
    formats = db.query(Book.file_format, func.count(Book.id)).group_by(Book.file_format).all()

    # Recent sessions
    recent = db.query(ReadingSession).order_by(ReadingSession.start_time.desc()).limit(10).all()

    # Daily reading for heatmap (last 365 days)
    daily = db.query(
        func.date(ReadingSession.start_time).label("day"),
        func.sum(func.extract("epoch", ReadingSession.end_time - ReadingSession.start_time) / 60).label("minutes")
    ).filter(ReadingSession.end_time.isnot(None)).group_by("day").all()

    return {
        "total_books": total_books,
        "finished": finished,
        "reading": reading,
        "total_minutes": round(total_minutes),
        "formats": {f: c for f, c in formats},
        "daily_reading": {str(d.day): round(d.minutes or 0) for d in daily},
    }
```

- [ ] **Step 3: Add tags, cover, bookmarks endpoints to books.py**

```python
# Add to backend/app/api/books.py

class TagBody(BaseModel):
    tag: str

class BookmarkBody(BaseModel):
    page_number: int

@router.get("/{book_id}/tags")
def get_tags(book_id: UUID, db=Depends(get_db)):
    book = db.query(Book).get(str(book_id))
    return {"tags": book.tags or []}

@router.post("/{book_id}/tags")
def add_tag(book_id: UUID, body: TagBody, db=Depends(get_db)):
    book = db.query(Book).get(str(book_id))
    tags = book.tags or []
    if body.tag not in tags:
        tags.append(body.tag)
        book.tags = tags
        db.commit()
    return {"tags": tags}

@router.delete("/{book_id}/tags/{tag}")
def delete_tag(book_id: UUID, tag: str, db=Depends(get_db)):
    book = db.query(Book).get(str(book_id))
    tags = book.tags or []
    if tag in tags:
        tags.remove(tag)
        book.tags = tags
        db.commit()
    return {"tags": tags}

@router.get("/{book_id}/cover")
def get_cover(book_id: UUID, db=Depends(get_db)):
    book = db.query(Book).get(str(book_id))
    if book.cover_path:
        from fastapi.responses import FileResponse
        return FileResponse(book.cover_path)
    return {"error": "no cover"}, 404

@router.get("/{book_id}/bookmarks")
def get_bookmarks(book_id: UUID, db=Depends(get_db)):
    from ..models.bookmark import Bookmark
    bms = db.query(Bookmark).filter(Bookmark.book_id == str(book_id)).order_by(Bookmark.page_number).all()
    return [{"id": str(b.id), "page_number": b.page_number, "created_at": b.created_at.isoformat()} for b in bms]

@router.post("/{book_id}/bookmarks")
def add_bookmark(book_id: UUID, body: BookmarkBody, db=Depends(get_db)):
    from ..models.bookmark import Bookmark
    existing = db.query(Bookmark).filter(
        Bookmark.book_id == str(book_id), Bookmark.page_number == body.page_number
    ).first()
    if existing:
        return {"id": str(existing.id), "page_number": existing.page_number}
    bm = Bookmark(book_id=str(book_id), page_number=body.page_number)
    db.add(bm)
    db.commit()
    return {"id": str(bm.id), "page_number": bm.page_number}

@router.delete("/{book_id}/bookmarks/{page_number}")
def delete_bookmark(book_id: UUID, page_number: int, db=Depends(get_db)):
    from ..models.bookmark import Bookmark
    db.query(Bookmark).filter(
        Bookmark.book_id == str(book_id), Bookmark.page_number == page_number
    ).delete()
    db.commit()
    return {"ok": True}
```

- [ ] **Step 4: Register new routers in main.py**

Add to `backend/app/main.py`:
```python
from .api.search import router as search_router
from .api.stats import router as stats_router
app.include_router(search_router)
app.include_router(stats_router)
```

- [ ] **Step 5: Commit**

```bash
git add backend/app/api/ backend/app/main.py
git commit -m "feat: add search, stats, tags, bookmarks, cover backend APIs"
```

---

### Task 3: Cover extraction service

**Files:**
- Create: `backend/app/services/cover_service.py`
- Modify: `backend/app/services/book_service.py` (call cover extraction on import)

- [ ] **Step 1: Create cover extraction service**

```python
# backend/app/services/cover_service.py
import os
from pathlib import Path

COVERS_DIR = Path("covers")
COVERS_DIR.mkdir(exist_ok=True)

def extract_cover_pdf(file_path: str, book_id: str) -> str | None:
    """Extract first page of PDF as cover image."""
    try:
        import fitz  # PyMuPDF
        doc = fitz.open(file_path)
        page = doc[0]
        pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))
        cover_name = f"{book_id}.png"
        pix.save(str(COVERS_DIR / cover_name))
        doc.close()
        return cover_name
    except Exception:
        return None

def extract_cover_epub(file_path: str, book_id: str) -> str | None:
    """Extract cover image from EPUB."""
    try:
        import zipfile
        from lxml import etree
        with zipfile.ZipFile(file_path) as zf:
            # Try to find cover in OPF
            for name in zf.namelist():
                if name.endswith('.opf'):
                    opf = etree.parse(zf.open(name))
                    ns = {'opf': 'http://www.idpf.org/2007/opf'}
                    cover_id = opf.xpath('//opf:meta[@name="cover"]/@content', namespaces=ns)
                    if cover_id:
                        manifest = opf.xpath(f'//opf:item[@id="{cover_id[0]}"]/@href', namespaces=ns)
                        if manifest:
                            cover_path = manifest[0]
                            # Find and extract the cover file
                            for zf_name in zf.namelist():
                                if zf_name.endswith(cover_path):
                                    cover_name = f"{book_id}.png"
                                    with open(COVERS_DIR / cover_name, 'wb') as f:
                                        f.write(zf.read(zf_name))
                                    return cover_name
    except Exception:
        return None
    return None
```

- [ ] **Step 2: Call cover extraction during import**

In `book_service.py`, after creating the book record:
```python
from .cover_service import extract_cover_pdf, extract_cover_epub

# After book is saved:
if book.file_format == 'pdf':
    cover = extract_cover_pdf(book.file_path, str(book.id))
elif book.file_format == 'epub':
    cover = extract_cover_epub(book.file_path, str(book.id))
else:
    cover = None
if cover:
    book.cover_path = cover
    db.commit()
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/services/cover_service.py backend/app/services/book_service.py
git commit -m "feat: extract book covers from PDF/EPUB on import"
```

---

### Task 4: Frontend API services for new endpoints

**Files:**
- Create: `frontend/src/services/searchApi.ts`
- Create: `frontend/src/services/statsApi.ts`
- Modify: `frontend/src/services/bookApi.ts` (add tags, bookmarks, cover methods)

- [ ] **Step 1: Create searchApi**

```typescript
// frontend/src/services/searchApi.ts
import axios from 'axios';
import API_BASE from './apiConfig';

const api = axios.create({ baseURL: `${API_BASE}/api` });

export interface SearchResult {
  books: { id: string; title: string; match_field: string; snippet: string }[];
  annotations: { id: string; book_title: string; snippet: string; page: number }[];
  knowledge_cards: { id: string; title: string; snippet: string }[];
}

export const searchApi = {
  search: (q: string) => api.get<SearchResult>('/search', { params: { q } }),
};
```

- [ ] **Step 2: Create statsApi**

```typescript
// frontend/src/services/statsApi.ts
import axios from 'axios';
import API_BASE from './apiConfig';

const api = axios.create({ baseURL: `${API_BASE}/api` });

export interface Stats {
  total_books: number;
  finished: number;
  reading: number;
  total_minutes: number;
  formats: Record<string, number>;
  daily_reading: Record<string, number>;
}

export const statsApi = {
  getStats: () => api.get<Stats>('/stats'),
};
```

- [ ] **Step 3: Add tags/bookmarks/cover methods to bookApi**

```typescript
// Add to frontend/src/services/bookApi.ts

// Tags
getTags: (bookId: string) => api.get<{ tags: string[] }>(`/books/${bookId}/tags`),
addTag: (bookId: string, tag: string) => api.post<{ tags: string[] }>(`/books/${bookId}/tags`, { tag }),
deleteTag: (bookId: string, tag: string) => api.delete<{ tags: string[] }>(`/books/${bookId}/tags/${tag}`),

// Bookmarks
getBookmarks: (bookId: string) => api.get<{ id: string; page_number: number }[]>(`/books/${bookId}/bookmarks`),
addBookmark: (bookId: string, pageNumber: number) => api.post(`/books/${bookId}/bookmarks`, { page_number: pageNumber }),
deleteBookmark: (bookId: string, pageNumber: number) => api.delete(`/books/${bookId}/bookmarks/${pageNumber}`),
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/services/
git commit -m "feat: add frontend API services for search, stats, tags, bookmarks"
```

---

## Frontend Pages (Tasks 5-9)

### Task 5: Create BookDetailPage

**Files:**
- Create: `frontend/src/pages/BookDetail/BookDetailPage.tsx`
- Modify: `frontend/src/App.tsx` (add route)

- [ ] **Step 1: Create BookDetailPage**

```typescript
// frontend/src/pages/BookDetail/BookDetailPage.tsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Rate, Tag, Input, Tabs, List, message, Spin, Modal } from 'antd';
import { ArrowLeftOutlined, ReadOutlined, HeartOutlined, HeartFilled, DeleteOutlined, PlusOutlined, CloseOutlined, ExportOutlined } from '@ant-design/icons';
import { useThemeStore } from '../../stores/themeStore';
import { bookApi, Book } from '../../services/bookApi';
import { annotationApi, Annotation } from '../../services/annotationApi';

export default function BookDetailPage() {
  const { bookId } = useParams<{ bookId: string }>();
  const navigate = useNavigate();
  const tokens = useThemeStore((s) => s.tokens);
  const [book, setBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState(true);
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [annotations, setAnnotations] = useState<Annotation[]>([]);

  useEffect(() => {
    if (!bookId) return;
    Promise.all([
      bookApi.get(bookId).then((r) => setBook(r.data)),
      bookApi.getTags(bookId).then((r) => setTags(r.data.tags)),
      annotationApi.list(bookId).then((r) => setAnnotations(r.data)).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, [bookId]);

  const handleAddTag = async () => {
    if (!bookId || !newTag.trim()) return;
    const r = await bookApi.addTag(bookId, newTag.trim());
    setTags(r.data.tags);
    setNewTag('');
  };

  const handleDeleteTag = async (tag: string) => {
    if (!bookId) return;
    const r = await bookApi.deleteTag(bookId, tag);
    setTags(r.data.tags);
  };

  const handleDelete = () => {
    if (!bookId) return;
    Modal.confirm({
      title: '确认删除此书？',
      onOk: async () => {
        await bookApi.delete(bookId);
        navigate('/');
      },
    });
  };

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 100 }}><Spin size="large" /></div>;
  if (!book) return <div style={{ padding: 48, color: tokens.text }}>书籍未找到</div>;

  const coverUrl = book.cover_url ? `http://127.0.0.1:8000/covers/${book.cover_url}` : null;

  const cardStyle = {
    background: tokens.cardBg,
    border: tokens.cardBorder,
    borderRadius: tokens.radius,
    padding: 24,
  };

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/')} style={{ color: tokens.textSecondary, marginBottom: 16 }}>
        返回书库
      </Button>

      <div style={{ display: 'flex', gap: 24, ...cardStyle, marginBottom: 24 }}>
        {/* Cover */}
        <div
          style={{
            width: 160, height: 220, borderRadius: 12, flexShrink: 0,
            background: coverUrl ? `url(${coverUrl}) center/cover` : `linear-gradient(135deg, #667eea, #764ba2)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 14, textAlign: 'center', padding: 12,
          }}
        >
          {!coverUrl && book.title.slice(0, 10)}
        </div>

        {/* Info */}
        <div style={{ flex: 1 }}>
          <h1 style={{ color: tokens.text, margin: '0 0 8px', fontSize: 22 }}>{book.title}</h1>
          <div style={{ color: tokens.textSecondary, marginBottom: 4 }}>{book.author || '未知作者'}{book.publisher ? ` · ${book.publisher}` : ''}</div>
          {book.isbn && <div style={{ color: tokens.textMuted, fontSize: 13, marginBottom: 12 }}>ISBN: {book.isbn}</div>}

          <Rate value={book.rating || 0} onChange={(v) => bookId && bookApi.update(bookId, { rating: v })} />

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
            <Tag color={book.file_format === 'pdf' ? 'red' : 'green'}>{book.file_format?.toUpperCase()}</Tag>
            {tags.map((tag) => (
              <Tag key={tag} closable onClose={() => handleDeleteTag(tag)}>{tag}</Tag>
            ))}
            <Input
              size="small"
              placeholder="+ 标签"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onPressEnter={handleAddTag}
              onBlur={handleAddTag}
              style={{ width: 80 }}
            />
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
            <Button type="primary" icon={<ReadOutlined />} onClick={() => navigate(`/reader/${bookId}`)}>
              {book.reading_status === 'reading' ? '继续阅读' : '开始阅读'}
            </Button>
            <Button icon={book.is_favorite ? <HeartFilled style={{ color: '#ff4d4f' }} /> : <HeartOutlined />}
              onClick={() => bookId && bookApi.update(bookId, { is_favorite: !book.is_favorite })}>
              {book.is_favorite ? '已收藏' : '收藏'}
            </Button>
            <Button danger icon={<DeleteOutlined />} onClick={handleDelete}>删除</Button>
          </div>
        </div>
      </div>

      {/* Tabs: Notes */}
      <div style={cardStyle}>
        <Tabs
          items={[
            {
              key: 'notes',
              label: '笔记汇总',
              children: (
                <List
                  dataSource={annotations}
                  locale={{ emptyText: '暂无笔记' }}
                  renderItem={(a) => (
                    <List.Item style={{ color: tokens.text }}>
                      <div>
                        <div style={{ fontSize: 12, color: tokens.textMuted }}>P.{a.page_number}</div>
                        {a.type === 'highlight' && <div style={{ borderLeft: `3px solid ${a.highlight_color || tokens.primary}`, paddingLeft: 8 }}>{a.selected_text}</div>}
                        {a.type === 'note' && <div><div style={{ color: tokens.textSecondary }}>{a.selected_text}</div><div style={{ marginTop: 4 }}>{a.note_content}</div></div>}
                      </div>
                    </List.Item>
                  )}
                />
              ),
            },
          ]}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add route to App.tsx**

```typescript
// In App.tsx routes, add:
<Route path="/book/:bookId" element={<BookDetailPage />} />
```

- [ ] **Step 3: Update LibraryPage to navigate to detail page**

In LibraryPage, change `handleBookClick`:
```typescript
const handleBookClick = (book: Book) => { navigate(`/book/${book.id}`); };
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd f:/Code/ebook-library/frontend && npx tsc --noEmit 2>&1 | grep "BookDetail"`
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/BookDetail/ frontend/src/App.tsx frontend/src/pages/Library/
git commit -m "feat: add book detail page with tags, notes, cover display"
```

---

### Task 6: Create StatsPage with charts

**Files:**
- Create: `frontend/src/pages/Stats/StatsPage.tsx`
- Modify: `frontend/src/App.tsx` (add route)
- Install: `recharts`

- [ ] **Step 1: Install recharts**

Run: `cd f:/Code/ebook-library/frontend && npm install recharts`

- [ ] **Step 2: Create StatsPage**

```typescript
// frontend/src/pages/Stats/StatsPage.tsx
import { useState, useEffect } from 'react';
import { Spin } from 'antd';
import { BookOutlined, ClockOutlined, FireOutlined, CalendarOutlined } from '@ant-design/icons';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useThemeStore } from '../../stores/themeStore';
import { statsApi, Stats } from '../../services/statsApi';

export default function StatsPage() {
  const tokens = useThemeStore((s) => s.tokens);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    statsApi.getStats().then((r) => setStats(r.data)).finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 100 }}><Spin size="large" /></div>;
  if (!stats) return null;

  const statCards = [
    { icon: <BookOutlined />, label: '已读书籍', value: stats.finished, color: '#667eea' },
    { icon: <ClockOutlined />, label: '总阅读时长', value: `${Math.round(stats.total_minutes / 60)}h`, color: '#f59e0b' },
    { icon: <CalendarOutlined />, label: '本月阅读', value: stats.reading, color: '#10b981' },
  ];

  const formatData = Object.entries(stats.formats).map(([name, value]) => ({ name: name.toUpperCase(), value }));
  const COLORS = ['#667eea', '#f5576c', '#43e97b', '#f59e0b', '#8b5cf6'];

  // Monthly data from daily_reading
  const monthlyData: { month: string; minutes: number }[] = [];
  const monthMap: Record<string, number> = {};
  Object.entries(stats.daily_reading).forEach(([day, minutes]) => {
    const month = day.slice(0, 7);
    monthMap[month] = (monthMap[month] || 0) + minutes;
  });
  Object.entries(monthMap).sort().slice(-12).forEach(([month, minutes]) => {
    monthlyData.push({ month: month.slice(5), minutes: Math.round(minutes) });
  });

  const cardStyle = {
    background: tokens.cardBg,
    border: tokens.cardBorder,
    borderRadius: tokens.radius,
    padding: 20,
  };

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ color: tokens.text, marginBottom: 24 }}>阅读统计</h2>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        {statCards.map((s) => (
          <div key={s.label} style={cardStyle}>
            <div style={{ fontSize: 24, color: s.color, marginBottom: 8 }}>{s.icon}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: tokens.text }}>{s.value}</div>
            <div style={{ fontSize: 13, color: tokens.textSecondary }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
        <div style={cardStyle}>
          <h3 style={{ color: tokens.text, marginBottom: 16 }}>月度阅读量</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={monthlyData}>
              <XAxis dataKey="month" stroke={tokens.textMuted} />
              <YAxis stroke={tokens.textMuted} />
              <Tooltip contentStyle={{ background: tokens.cardBg, border: tokens.cardBorder, borderRadius: 8, color: tokens.text }} />
              <Bar dataKey="minutes" fill={tokens.primary} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div style={cardStyle}>
          <h3 style={{ color: tokens.text, marginBottom: 16 }}>格式分布</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={formatData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                {formatData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: tokens.cardBg, border: tokens.cardBorder, borderRadius: 8, color: tokens.text }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Add route to App.tsx**

```typescript
import StatsPage from './pages/Stats/StatsPage';
// In routes:
<Route path="/stats" element={<StatsPage />} />
```

- [ ] **Step 4: Commit**

```bash
npm install recharts
git add frontend/src/pages/Stats/ frontend/src/App.tsx frontend/package.json frontend/package-lock.json
git commit -m "feat: add reading statistics page with charts"
```

---

### Task 7: Rewrite SearchPage

**Files:**
- Rewrite: `frontend/src/pages/Search/SearchPage.tsx` (or create if not exists)

- [ ] **Step 1: Check if SearchPage exists**

Read `frontend/src/pages/Search/SearchPage.tsx`. If it doesn't exist, check what's currently at the `/search` route.

- [ ] **Step 2: Create/rewrite SearchPage**

```typescript
// frontend/src/pages/Search/SearchPage.tsx
import { useState, useCallback } from 'react';
import { Input, Spin } from 'antd';
import { BookOutlined, EditOutlined, FileTextOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useThemeStore } from '../../stores/themeStore';
import { searchApi, SearchResult } from '../../services/searchApi';

export default function SearchPage() {
  const tokens = useThemeStore((s) => s.tokens);
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setResults(null); return; }
    setLoading(true);
    try {
      const r = await searchApi.search(q.trim());
      setResults(r.data);
    } catch { setResults(null); }
    finally { setLoading(false); }
  }, []);

  const highlight = (text: string, q: string) => {
    if (!q) return text;
    const parts = text.split(new RegExp(`(${q})`, 'gi'));
    return parts.map((p, i) =>
      p.toLowerCase() === q.toLowerCase()
        ? <span key={i} style={{ background: tokens.primary, color: '#fff', padding: '0 2px', borderRadius: 2 }}>{p}</span>
        : p
    );
  };

  const cardStyle = {
    background: tokens.cardBg,
    border: tokens.cardBorder,
    borderRadius: tokens.radius,
    padding: 14,
    marginBottom: 8,
    cursor: 'pointer',
    transition: 'background 0.2s',
  };

  return (
    <div style={{ padding: 24, maxWidth: 700, margin: '0 auto' }}>
      <Input.Search
        placeholder="搜索书籍、作者、笔记、批注..."
        value={query}
        onChange={(e) => { setQuery(e.target.value); doSearch(e.target.value); }}
        size="large"
        style={{ marginBottom: 24 }}
        loading={loading}
      />

      {!results && !loading && (
        <div style={{ textAlign: 'center', color: tokens.textMuted, padding: 48 }}>
          输入关键词开始搜索
        </div>
      )}

      {results && (
        <>
          {results.books.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ color: tokens.text, marginBottom: 12 }}><BookOutlined /> 书籍 ({results.books.length})</h3>
              {results.books.map((b) => (
                <div key={b.id} style={cardStyle} onClick={() => navigate(`/book/${b.id}`)}>
                  <div style={{ color: tokens.text, fontWeight: 600 }}>{highlight(b.title, query)}</div>
                  <div style={{ color: tokens.textSecondary, fontSize: 12, marginTop: 4 }}>{highlight(b.snippet, query)}</div>
                </div>
              ))}
            </div>
          )}

          {results.annotations.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ color: tokens.text, marginBottom: 12 }}><EditOutlined /> 批注 ({results.annotations.length})</h3>
              {results.annotations.map((a) => (
                <div key={a.id} style={cardStyle} onClick={() => navigate(`/book/${a.book_title}`)}>
                  <div style={{ color: tokens.textSecondary, fontSize: 12 }}>P.{a.page}</div>
                  <div style={{ color: tokens.text, marginTop: 4 }}>{highlight(a.snippet, query)}</div>
                </div>
              ))}
            </div>
          )}

          {results.knowledge_cards.length > 0 && (
            <div>
              <h3 style={{ color: tokens.text, marginBottom: 12 }}><FileTextOutlined /> 知识卡片 ({results.knowledge_cards.length})</h3>
              {results.knowledge_cards.map((c) => (
                <div key={c.id} style={cardStyle}>
                  <div style={{ color: tokens.text, fontWeight: 600 }}>{highlight(c.title, query)}</div>
                  <div style={{ color: tokens.textSecondary, fontSize: 12, marginTop: 4 }}>{highlight(c.snippet, query)}</div>
                </div>
              ))}
            </div>
          )}

          {results.books.length === 0 && results.annotations.length === 0 && results.knowledge_cards.length === 0 && (
            <div style={{ textAlign: 'center', color: tokens.textMuted, padding: 48 }}>
              未找到匹配结果
            </div>
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verify and commit**

Run: `cd f:/Code/ebook-library/frontend && npx tsc --noEmit 2>&1 | grep "SearchPage"`
Expected: no errors

```bash
git add frontend/src/pages/Search/
git commit -m "feat: implement full-text search page with keyword highlighting"
```

---

### Task 8: Add reading session timer to ReaderPage

**Files:**
- Modify: `frontend/src/pages/Reader/ReaderPage.tsx`

- [ ] **Step 1: Add reading timer logic**

Add to ReaderPage:
```typescript
const sessionStartRef = useRef<Date>(new Date());
const lastActivityRef = useRef<Date>(new Date());
const [isTracking, setIsTracking] = useState(true);

// Track activity (page turns, scrolls)
const trackActivity = useCallback(() => {
  lastActivityRef.current = new Date();
  if (!isTracking) setIsTracking(true);
}, [isTracking]);

// Check idle every 30 seconds
useEffect(() => {
  const interval = setInterval(() => {
    const diff = Date.now() - lastActivityRef.current.getTime();
    if (diff > 3 * 60 * 1000 && isTracking) {
      setIsTracking(false);
    }
  }, 30000);
  return () => clearInterval(interval);
}, [isTracking]);

// Save session on unmount
useEffect(() => {
  return () => {
    const duration = Date.now() - sessionStartRef.current.getTime();
    if (duration > 30000 && bookId) {
      // Fire and forget
      fetch(`http://127.0.0.1:8000/api/reading-sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          book_id: bookId,
          start_time: sessionStartRef.current.toISOString(),
          end_time: new Date().toISOString(),
          pages_read: 0,
        }),
      }).catch(() => {});
    }
  };
}, [bookId]);

// Call trackActivity on page change
const handlePageChange = (page: number, total: number) => {
  setCurrentPage(page);
  setTotalPages(total);
  saveProgress(page);
  trackActivity();
};
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/Reader/
git commit -m "feat: add reading session timer to reader page"
```

---

### Task 9: Add bookmark functionality to ReaderPage

**Files:**
- Modify: `frontend/src/pages/Reader/ReaderPage.tsx`

- [ ] **Step 1: Add bookmark state and API calls**

```typescript
const [bookmarkedPages, setBookmarkedPages] = useState<Set<number>>(new Set());

useEffect(() => {
  if (!bookId) return;
  bookApi.getBookmarks(bookId).then((r) => {
    setBookmarkedPages(new Set(r.data.map((b: any) => b.page_number)));
  }).catch(() => {});
}, [bookId]);

const toggleBookmark = async () => {
  if (!bookId) return;
  if (bookmarkedPages.has(currentPage)) {
    await bookApi.deleteBookmark(bookId, currentPage);
    setBookmarkedPages((prev) => { const s = new Set(prev); s.delete(currentPage); return s; });
  } else {
    await bookApi.addBookmark(bookId, currentPage);
    setBookmarkedPages((prev) => new Set(prev).add(currentPage));
  }
};
```

- [ ] **Step 2: Add bookmark button to toolbar**

In the toolbar, add a bookmark toggle button:
```typescript
<Button
  icon={<BookOutlined />}
  type="text"
  onClick={toggleBookmark}
  style={{ color: bookmarkedPages.has(currentPage) ? tokens.primary : tokens.textSecondary }}
  title={bookmarkedPages.has(currentPage) ? '取消书签' : '添加书签'}
/>
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/Reader/
git commit -m "feat: add bookmark toggle to reader page"
```
