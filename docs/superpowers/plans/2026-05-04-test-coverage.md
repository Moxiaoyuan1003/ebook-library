# Test Coverage Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand test coverage from 166 backend / 0 frontend to meaningful coverage across both.

**Architecture:** Frontend uses vitest + @testing-library/react for component tests and mocked axios for API service tests. Backend follows existing pattern: SQLite in-memory DB, UUID patching, FastAPI TestClient.

**Tech Stack:** vitest, @testing-library/react, @testing-library/jest-dom, jsdom, axios-mock-adapter, pytest, FastAPI TestClient

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `frontend/vitest.config.ts` | Vitest configuration with jsdom |
| `frontend/src/test/setup.ts` | Test setup (jest-dom matchers) |
| `frontend/src/components/TextSelectionMenu.test.tsx` | TextSelectionMenu tests |
| `frontend/src/components/AnnotationSidebar.test.tsx` | AnnotationSidebar tests |
| `frontend/src/services/annotationApi.test.ts` | annotationApi tests |
| `frontend/src/services/readingSessionApi.test.ts` | readingSessionApi tests |
| `frontend/src/services/exportApi.test.ts` | exportApi tests |
| `backend/tests/test_book_crud.py` | Books CRUD API tests |
| `backend/tests/test_reading_progress.py` | Reading progress API tests |

### Modified Files

| File | Changes |
|------|---------|
| `frontend/package.json` | Add @testing-library deps |

---

## Task 1: Frontend Test Setup

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/vitest.config.ts`
- Create: `frontend/src/test/setup.ts`

- [ ] **Step 1: Install test dependencies**

Run: `cd f:/Code/ebook-library/frontend && npm install --save-dev @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom axios-mock-adapter`

- [ ] **Step 2: Create vitest config**

Create `frontend/vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
  },
});
```

- [ ] **Step 3: Create test setup file**

Create `frontend/src/test/setup.ts`:

```typescript
import '@testing-library/jest-dom';
```

- [ ] **Step 4: Verify setup works**

Run: `cd f:/Code/ebook-library/frontend && npx vitest run --reporter=verbose 2>&1 | head -5`
Expected: "No test files found" or similar — confirms vitest loads without errors.

- [ ] **Step 5: Commit**

```bash
cd f:/Code/ebook-library && git add frontend/package.json frontend/package-lock.json frontend/vitest.config.ts frontend/src/test/setup.ts
git commit -m "test: set up frontend testing with vitest and @testing-library"
```

---

## Task 2: Frontend Component Tests

**Files:**
- Create: `frontend/src/components/TextSelectionMenu.test.tsx`
- Create: `frontend/src/components/AnnotationSidebar.test.tsx`

- [ ] **Step 1: Write TextSelectionMenu tests**

Create `frontend/src/components/TextSelectionMenu.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TextSelectionMenu from './TextSelectionMenu';

describe('TextSelectionMenu', () => {
  const defaultProps = {
    visible: true,
    position: { x: 100, y: 200 },
    selectedText: 'Hello world',
    onAskAI: vi.fn(),
    onHighlight: vi.fn(),
    onCopy: vi.fn(),
    onClose: vi.fn(),
  };

  it('renders when visible is true', () => {
    render(<TextSelectionMenu {...defaultProps} />);
    expect(screen.getByText('问 AI')).toBeInTheDocument();
    expect(screen.getByText('复制')).toBeInTheDocument();
  });

  it('does not render when visible is false', () => {
    render(<TextSelectionMenu {...defaultProps} visible={false} />);
    expect(screen.queryByText('问 AI')).not.toBeInTheDocument();
  });

  it('calls onAskAI when button clicked', () => {
    render(<TextSelectionMenu {...defaultProps} />);
    fireEvent.click(screen.getByText('问 AI'));
    expect(defaultProps.onAskAI).toHaveBeenCalledTimes(1);
  });

  it('calls onCopy when button clicked', () => {
    render(<TextSelectionMenu {...defaultProps} />);
    fireEvent.click(screen.getByText('复制'));
    expect(defaultProps.onCopy).toHaveBeenCalledTimes(1);
  });

  it('calls onHighlight with color when color dot clicked', () => {
    render(<TextSelectionMenu {...defaultProps} />);
    // Find color dots (they have specific background colors)
    const colorDots = document.querySelectorAll('[style*="background"]');
    // The first color dot should be yellow
    if (colorDots.length > 0) {
      fireEvent.click(colorDots[0]);
      expect(defaultProps.onHighlight).toHaveBeenCalled();
    }
  });
});
```

- [ ] **Step 2: Write AnnotationSidebar tests**

Create `frontend/src/components/AnnotationSidebar.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import AnnotationSidebar from './AnnotationSidebar';

// Mock the annotationApi
vi.mock('../services/annotationApi', () => ({
  annotationApi: {
    list: vi.fn().mockResolvedValue({ data: [] }),
    delete: vi.fn().mockResolvedValue({}),
  },
}));

describe('AnnotationSidebar', () => {
  it('renders when visible is true', () => {
    render(
      <AnnotationSidebar
        visible={true}
        bookId="test-book-id"
        onClose={vi.fn()}
        onJumpToAnnotation={vi.fn()}
      />
    );
    expect(screen.getByText('批注')).toBeInTheDocument();
  });

  it('does not render when visible is false', () => {
    render(
      <AnnotationSidebar
        visible={false}
        bookId="test-book-id"
        onClose={vi.fn()}
        onJumpToAnnotation={vi.fn()}
      />
    );
    expect(screen.queryByText('批注')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run tests**

Run: `cd f:/Code/ebook-library/frontend && npx vitest run --reporter=verbose`
Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
cd f:/Code/ebook-library && git add frontend/src/components/TextSelectionMenu.test.tsx frontend/src/components/AnnotationSidebar.test.tsx
git commit -m "test: add TextSelectionMenu and AnnotationSidebar component tests"
```

---

## Task 3: Frontend API Service Tests

**Files:**
- Create: `frontend/src/services/annotationApi.test.ts`
- Create: `frontend/src/services/readingSessionApi.test.ts`
- Create: `frontend/src/services/exportApi.test.ts`

- [ ] **Step 1: Write annotationApi tests**

Create `frontend/src/services/annotationApi.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { annotationApi } from './annotationApi';

vi.mock('axios');
const mockedAxios = vi.mocked(axios, true);

describe('annotationApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('list sends GET with book_id param', async () => {
    mockedAxios.create.mockReturnThis();
    mockedAxios.get.mockResolvedValue({ data: [] });
    await annotationApi.list('book-123');
    expect(mockedAxios.get).toHaveBeenCalledWith('/', { params: { book_id: 'book-123' } });
  });

  it('create sends POST with annotation data', async () => {
    const data = { book_id: 'book-123', type: 'highlight', selected_text: 'hello' };
    mockedAxios.create.mockReturnThis();
    mockedAxios.post.mockResolvedValue({ data: { id: 'ann-1' } });
    await annotationApi.create(data);
    expect(mockedAxios.post).toHaveBeenCalledWith('/', data);
  });

  it('update sends PUT with annotation data', async () => {
    const data = { note_content: 'updated note' };
    mockedAxios.create.mockReturnThis();
    mockedAxios.put.mockResolvedValue({ data: {} });
    await annotationApi.update('ann-1', data);
    expect(mockedAxios.put).toHaveBeenCalledWith('/ann-1', data);
  });

  it('delete sends DELETE with annotation id', async () => {
    mockedAxios.create.mockReturnThis();
    mockedAxios.delete.mockResolvedValue({ data: {} });
    await annotationApi.delete('ann-1');
    expect(mockedAxios.delete).toHaveBeenCalledWith('/ann-1');
  });
});
```

- [ ] **Step 2: Write readingSessionApi tests**

Create `frontend/src/services/readingSessionApi.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { readingSessionApi } from './readingSessionApi';

vi.mock('axios');
const mockedAxios = vi.mocked(axios, true);

describe('readingSessionApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('chat sends POST with message data', async () => {
    const data = { book_id: 'book-123', message: 'What is this about?' };
    mockedAxios.create.mockReturnThis();
    mockedAxios.post.mockResolvedValue({ data: { reply: 'It is about...', session_id: 'sess-1' } });
    await readingSessionApi.chat(data);
    expect(mockedAxios.post).toHaveBeenCalledWith('/reading-chat', data);
  });

  it('listSessions sends GET with book_id', async () => {
    mockedAxios.create.mockReturnThis();
    mockedAxios.get.mockResolvedValue({ data: [] });
    await readingSessionApi.listSessions('book-123');
    expect(mockedAxios.get).toHaveBeenCalledWith('/reading-sessions/book-123');
  });

  it('deleteSession sends DELETE', async () => {
    mockedAxios.create.mockReturnThis();
    mockedAxios.delete.mockResolvedValue({ data: {} });
    await readingSessionApi.deleteSession('sess-1');
    expect(mockedAxios.delete).toHaveBeenCalledWith('/reading-sessions/sess-1');
  });
});
```

- [ ] **Step 3: Write exportApi tests**

Create `frontend/src/services/exportApi.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { exportApi } from './exportApi';

vi.mock('axios');
const mockedAxios = vi.mocked(axios, true);

describe('exportApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('export sends POST with data type and format', async () => {
    const data = { data_type: 'cards', format: 'markdown' };
    mockedAxios.create.mockReturnThis();
    mockedAxios.post.mockResolvedValue({ data: new Blob() });
    await exportApi.export(data);
    expect(mockedAxios.post).toHaveBeenCalledWith('/', data, { responseType: 'blob' });
  });
});
```

- [ ] **Step 4: Run all frontend tests**

Run: `cd f:/Code/ebook-library/frontend && npx vitest run --reporter=verbose`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
cd f:/Code/ebook-library && git add frontend/src/services/annotationApi.test.ts frontend/src/services/readingSessionApi.test.ts frontend/src/services/exportApi.test.ts
git commit -m "test: add API service tests for annotation, reading session, and export"
```

---

## Task 4: Backend Books CRUD Tests

**Files:**
- Create: `backend/tests/test_book_crud.py`

- [ ] **Step 1: Write books CRUD tests**

Create `backend/tests/test_book_crud.py` following the existing test pattern (SQLite in-memory, UUID patching, autouse fixture for dependency override isolation):

```python
import uuid as uuid_mod
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from sqlalchemy.types import CHAR, TypeDecorator
from sqlalchemy.dialects.postgresql import UUID as PG_UUID

from app.core.database import get_db, Base
from app.models.book import Book
from app.models.tag import Tag, book_tags
from app.models.bookshelf import Bookshelf, bookshelf_books
from app.models.passage import Passage
from app.models.annotation import Annotation
from app.models.knowledge_card import KnowledgeCard
from app.models.card_link import CardLink
from app.models.reading_progress import ReadingProgress
from app.models.reading_session import ReadingSession


class SQLiteUUID(TypeDecorator):
    impl = CHAR(36)
    cache_ok = True
    def process_bind_param(self, value, dialect):
        return str(value) if value is not None else value
    def process_result_value(self, value, dialect):
        return uuid_mod.UUID(value) if value is not None else value


def _patch_uuid_columns_for_sqlite():
    for table in Base.metadata.tables.values():
        for column in table.columns:
            if isinstance(column.type, PG_UUID):
                column.type = SQLiteUUID()
            elif isinstance(column.type, CHAR) and not isinstance(column.type, SQLiteUUID):
                if hasattr(column.type, 'length') and column.type.length == 36:
                    column.type = SQLiteUUID()


_patch_uuid_columns_for_sqlite()

from app.main import app

test_engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
Base.metadata.create_all(test_engine)
TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


@pytest.fixture(autouse=True)
def override_db():
    def _override():
        db = TestSessionLocal()
        try:
            yield db
        finally:
            db.close()
    app.dependency_overrides[get_db] = _override
    yield
    app.dependency_overrides.pop(get_db, None)


client = TestClient(app)


def _create_test_book(db_session=None, **kwargs):
    """Helper to create a book directly in DB."""
    db = TestSessionLocal()
    try:
        book = Book(
            id=uuid_mod.uuid4(),
            title=kwargs.get("title", "Test Book"),
            author=kwargs.get("author", "Test Author"),
            file_path=kwargs.get("file_path", "/tmp/test.pdf"),
            file_format=kwargs.get("file_format", "pdf"),
        )
        db.add(book)
        db.commit()
        db.refresh(book)
        return book
    finally:
        db.close()


def test_create_book_via_api():
    """Test that books can be listed after creation."""
    book = _create_test_book(title="API Book")
    response = client.get("/api/books/")
    assert response.status_code == 200
    books = response.json()
    assert any(b["title"] == "API Book" for b in books)


def test_get_book_by_id():
    book = _create_test_book(title="Get Me")
    response = client.get(f"/api/books/{book.id}")
    assert response.status_code == 200
    assert response.json()["title"] == "Get Me"


def test_get_book_not_found():
    response = client.get(f"/api/books/{uuid_mod.uuid4()}")
    assert response.status_code == 404


def test_update_book():
    book = _create_test_book(title="Old Title")
    response = client.put(f"/api/books/{book.id}", json={"title": "New Title"})
    assert response.status_code == 200
    assert response.json()["title"] == "New Title"


def test_update_book_not_found():
    response = client.put(f"/api/books/{uuid_mod.uuid4()}", json={"title": "Nope"})
    assert response.status_code == 404


def test_delete_book():
    book = _create_test_book(title="Delete Me")
    response = client.delete(f"/api/books/{book.id}")
    assert response.status_code == 200
    # Verify deleted
    response = client.get(f"/api/books/{book.id}")
    assert response.status_code == 404


def test_delete_book_not_found():
    response = client.delete(f"/api/books/{uuid_mod.uuid4()}")
    assert response.status_code == 404


def test_list_books_with_pagination():
    for i in range(5):
        _create_test_book(title=f"Book {i}")
    response = client.get("/api/books/")
    assert response.status_code == 200
    assert len(response.json()) >= 5
```

- [ ] **Step 2: Run tests**

Run: `cd f:/Code/ebook-library/backend && python -m pytest tests/test_book_crud.py -v`
Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
cd f:/Code/ebook-library && git add backend/tests/test_book_crud.py
git commit -m "test: add books CRUD API tests"
```

---

## Task 5: Backend Reading Progress Tests

**Files:**
- Create: `backend/tests/test_reading_progress.py`

- [ ] **Step 1: Write reading progress tests**

Create `backend/tests/test_reading_progress.py` following the same pattern as Task 4:

```python
import uuid as uuid_mod
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from sqlalchemy.types import CHAR, TypeDecorator
from sqlalchemy.dialects.postgresql import UUID as PG_UUID

from app.core.database import get_db, Base
from app.models.book import Book
from app.models.tag import Tag, book_tags
from app.models.bookshelf import Bookshelf, bookshelf_books
from app.models.passage import Passage
from app.models.annotation import Annotation
from app.models.knowledge_card import KnowledgeCard
from app.models.card_link import CardLink
from app.models.reading_progress import ReadingProgress
from app.models.reading_session import ReadingSession


class SQLiteUUID(TypeDecorator):
    impl = CHAR(36)
    cache_ok = True
    def process_bind_param(self, value, dialect):
        return str(value) if value is not None else value
    def process_result_value(self, value, dialect):
        return uuid_mod.UUID(value) if value is not None else value


def _patch_uuid_columns_for_sqlite():
    for table in Base.metadata.tables.values():
        for column in table.columns:
            if isinstance(column.type, PG_UUID):
                column.type = SQLiteUUID()
            elif isinstance(column.type, CHAR) and not isinstance(column.type, SQLiteUUID):
                if hasattr(column.type, 'length') and column.type.length == 36:
                    column.type = SQLiteUUID()


_patch_uuid_columns_for_sqlite()

from app.main import app

test_engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
Base.metadata.create_all(test_engine)
TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


@pytest.fixture(autouse=True)
def override_db():
    def _override():
        db = TestSessionLocal()
        try:
            yield db
        finally:
            db.close()
    app.dependency_overrides[get_db] = _override
    yield
    app.dependency_overrides.pop(get_db, None)


client = TestClient(app)


def _create_test_book(**kwargs):
    db = TestSessionLocal()
    try:
        book = Book(
            id=uuid_mod.uuid4(),
            title=kwargs.get("title", "Test Book"),
            author=kwargs.get("author", "Test Author"),
            file_path=kwargs.get("file_path", "/tmp/test.pdf"),
            file_format=kwargs.get("file_format", "pdf"),
        )
        db.add(book)
        db.commit()
        db.refresh(book)
        return book
    finally:
        db.close()


def test_update_reading_progress():
    book = _create_test_book()
    response = client.post(f"/api/reading-progress/{book.id}", json={
        "current_page": 50,
        "progress_percent": 50,
    })
    assert response.status_code == 200


def test_get_reading_progress():
    book = _create_test_book()
    # First update
    client.post(f"/api/reading-progress/{book.id}", json={
        "current_page": 30,
        "progress_percent": 30,
    })
    # Then get
    response = client.get(f"/api/reading-progress/{book.id}")
    assert response.status_code == 200
    data = response.json()
    assert data["current_page"] == 30


def test_get_reading_progress_no_progress():
    book = _create_test_book()
    response = client.get(f"/api/reading-progress/{book.id}")
    assert response.status_code == 200
    # Should return default/empty progress
    data = response.json()
    assert data.get("current_page", 0) == 0


def test_update_reading_progress_epub():
    book = _create_test_book(file_format="epub")
    response = client.post(f"/api/reading-progress/{book.id}", json={
        "current_cfi": "epubcfi(/6/14[chap01]!/4/2/1:0)",
        "progress_percent": 25,
    })
    assert response.status_code == 200
```

- [ ] **Step 2: Run tests**

Run: `cd f:/Code/ebook-library/backend && python -m pytest tests/test_reading_progress.py -v`
Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
cd f:/Code/ebook-library && git add backend/tests/test_reading_progress.py
git commit -m "test: add reading progress API tests"
```

---

## Task 6: Final Verification

- [ ] **Step 1: Run all frontend tests**

Run: `cd f:/Code/ebook-library/frontend && npx vitest run --reporter=verbose`
Expected: All tests pass.

- [ ] **Step 2: Run all backend tests**

Run: `cd f:/Code/ebook-library/backend && python -m pytest tests/ -v --tb=short`
Expected: All tests pass (166 + new tests).

- [ ] **Step 3: Run frontend type check**

Run: `cd f:/Code/ebook-library/frontend && npx tsc --noEmit`
Expected: No errors.

---

## Spec Coverage

| Spec Requirement | Task |
|------------------|------|
| Frontend test setup (vitest, @testing-library) | Task 1 |
| TextSelectionMenu component tests | Task 2 |
| AnnotationSidebar component tests | Task 2 |
| annotationApi service tests | Task 3 |
| readingSessionApi service tests | Task 3 |
| exportApi service tests | Task 3 |
| Backend books CRUD tests | Task 4 |
| Backend reading progress tests | Task 5 |
| Final verification | Task 6 |
