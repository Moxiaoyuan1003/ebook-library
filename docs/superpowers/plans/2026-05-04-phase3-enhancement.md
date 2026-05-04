# Phase 3 Enhancement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add dialogue-based deep reading, notes/annotations enhancement, data export, and auto-update.

**Architecture:** Extends Phase 2 with new backend models (ReadingSession), extended annotation API, export service, and new frontend components (TextSelectionMenu, AnnotationSidebar, ReadingChatPanel, ExportPage, UpdateChecker).

**Tech Stack:** FastAPI, SQLAlchemy, react-pdf, epubjs, reportlab, Ant Design, Zustand

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `backend/app/models/reading_session.py` | ReadingSession model |
| `backend/app/schemas/annotation.py` | Annotation CRUD schemas |
| `backend/app/schemas/reading_session.py` | ReadingSession schemas |
| `backend/app/schemas/export.py` | Export request/response schemas |
| `backend/app/services/export_service.py` | Export to Markdown/PDF/CSV |
| `backend/app/services/update_checker.py` | GitHub Release version check |
| `backend/app/api/export.py` | Export API router |
| `backend/app/api/system.py` | System/update API router |
| `backend/tests/test_annotations.py` | Annotation API tests |
| `backend/tests/test_reading_sessions.py` | Reading session tests |
| `backend/tests/test_export.py` | Export API tests |
| `backend/tests/test_update_checker.py` | Update checker tests |
| `frontend/src/services/annotationApi.ts` | Annotation API client |
| `frontend/src/services/readingSessionApi.ts` | Reading session API client |
| `frontend/src/services/exportApi.ts` | Export API client |
| `frontend/src/components/TextSelectionMenu.tsx` | Floating menu on text select |
| `frontend/src/components/AnnotationSidebar.tsx` | Annotation list sidebar |
| `frontend/src/components/ReadingChatPanel.tsx` | AI chat side panel |
| `frontend/src/pages/Export/ExportPage.tsx` | Data export page |
| `frontend/src/components/UpdateChecker.tsx` | Update check component |

### Modified Files

| File | Changes |
|------|---------|
| `backend/app/models/annotation.py` | Add highlight_color, start_cfi, end_cfi, rect_data fields |
| `backend/app/models/__init__.py` | Register ReadingSession |
| `backend/app/api/annotations.py` | Full CRUD implementation |
| `backend/app/api/ai.py` | Add reading-chat endpoint |
| `backend/app/main.py` | Register export, system routers |
| `frontend/src/components/PdfViewer.tsx` | Add onTextSelect callback |
| `frontend/src/components/EpubViewer.tsx` | Add onTextSelect callback |
| `frontend/src/pages/Reader/ReaderPage.tsx` | Add chat panel, annotation sidebar, text selection |
| `frontend/src/pages/Settings/SettingsPage.tsx` | Add UpdateChecker in update tab |
| `frontend/src/App.tsx` | Add /export route |
| `frontend/src/components/Layout/Sidebar.tsx` | Add export menu entry |

---

## Task 1: Annotation Model Extension + Schemas

**Files:**
- Modify: `backend/app/models/annotation.py`
- Create: `backend/app/schemas/annotation.py`
- Test: `backend/tests/test_annotations.py`

- [ ] **Step 1: Extend annotation model**

```python
# backend/app/models/annotation.py — add these columns after existing ones
highlight_color = Column(String(20), default="yellow")  # yellow/green/blue/pink/purple
start_cfi = Column(Text)  # EPUB start CFI
end_cfi = Column(Text)    # EPUB end CFI
rect_data = Column(Text)  # JSON string for PDF highlight rectangles
```

- [ ] **Step 2: Create annotation schemas**

```python
# backend/app/schemas/annotation.py
from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional
from uuid import UUID

class AnnotationCreate(BaseModel):
    book_id: UUID
    type: str = Field(..., max_length=20)
    page_number: Optional[int] = None
    selected_text: Optional[str] = None
    note_content: Optional[str] = None
    color: Optional[str] = Field(None, max_length=7)
    highlight_color: Optional[str] = Field(None, max_length=20)
    start_cfi: Optional[str] = None
    end_cfi: Optional[str] = None
    rect_data: Optional[str] = None

class AnnotationUpdate(BaseModel):
    note_content: Optional[str] = None
    color: Optional[str] = Field(None, max_length=7)
    highlight_color: Optional[str] = Field(None, max_length=20)

class AnnotationResponse(BaseModel):
    id: UUID
    book_id: UUID
    type: str
    page_number: Optional[int] = None
    selected_text: Optional[str] = None
    note_content: Optional[str] = None
    color: Optional[str] = None
    highlight_color: Optional[str] = None
    start_cfi: Optional[str] = None
    end_cfi: Optional[str] = None
    rect_data: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
```

- [ ] **Step 3: Implement annotation CRUD API**

```python
# backend/app/api/annotations.py
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from uuid import UUID

from app.core.database import get_db
from app.models.annotation import Annotation
from app.schemas.annotation import AnnotationCreate, AnnotationUpdate, AnnotationResponse

router = APIRouter()

@router.get("/", response_model=list[AnnotationResponse])
def list_annotations(book_id: UUID = Query(...), db: Session = Depends(get_db)):
    return db.query(Annotation).filter(Annotation.book_id == book_id).order_by(Annotation.page_number, Annotation.created_at).all()

@router.post("/", response_model=AnnotationResponse)
def create_annotation(data: AnnotationCreate, db: Session = Depends(get_db)):
    ann = Annotation(**data.model_dump())
    db.add(ann); db.commit(); db.refresh(ann)
    return ann

@router.put("/{annotation_id}", response_model=AnnotationResponse)
def update_annotation(annotation_id: UUID, data: AnnotationUpdate, db: Session = Depends(get_db)):
    ann = db.query(Annotation).filter(Annotation.id == annotation_id).first()
    if not ann: raise HTTPException(status_code=404, detail="Annotation not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(ann, key, value)
    db.commit(); db.refresh(ann)
    return ann

@router.delete("/{annotation_id}")
def delete_annotation(annotation_id: UUID, db: Session = Depends(get_db)):
    ann = db.query(Annotation).filter(Annotation.id == annotation_id).first()
    if not ann: raise HTTPException(status_code=404, detail="Annotation not found")
    db.delete(ann); db.commit()
    return {"status": "deleted"}
```

- [ ] **Step 4: Write tests**

```python
# backend/tests/test_annotations.py — follow existing test pattern with SQLite UUID patching
# Test: create annotation, list by book_id, update note, delete, 404 on missing
```

- [ ] **Step 5: Run tests and commit**

```bash
cd backend && python -m pytest tests/test_annotations.py -v
git add backend/app/models/annotation.py backend/app/schemas/annotation.py backend/app/api/annotations.py backend/tests/test_annotations.py
git commit -m "feat: extend annotation model with highlight colors and position data"
```

---

## Task 2: ReadingSession Model + API

**Files:**
- Create: `backend/app/models/reading_session.py`
- Modify: `backend/app/models/__init__.py`
- Create: `backend/app/schemas/reading_session.py`
- Add reading-chat endpoint to: `backend/app/api/ai.py`
- Test: `backend/tests/test_reading_sessions.py`

- [ ] **Step 1: Create ReadingSession model**

```python
# backend/app/models/reading_session.py
from sqlalchemy import Column, String, Text, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSON
from datetime import datetime
import uuid
from app.core.database import Base

class ReadingSession(Base):
    __tablename__ = "reading_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    book_id = Column(UUID(as_uuid=True), ForeignKey("books.id"), nullable=False, index=True)
    messages = Column(JSON, default=list)  # [{role, content, timestamp}]
    context_passages = Column(JSON, default=list)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
```

- [ ] **Step 2: Register in __init__.py**

Add `from app.models.reading_session import ReadingSession` and add to `__all__`.

- [ ] **Step 3: Create schemas**

```python
# backend/app/schemas/reading_session.py
from pydantic import BaseModel
from datetime import datetime
from typing import Optional
from uuid import UUID

class ReadingChatRequest(BaseModel):
    book_id: UUID
    message: str
    context_passages: list[dict] = []
    session_id: Optional[UUID] = None

class ReadingChatResponse(BaseModel):
    reply: str
    session_id: UUID

class ReadingSessionResponse(BaseModel):
    id: UUID
    book_id: UUID
    messages: list[dict]
    context_passages: list[dict]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
```

- [ ] **Step 4: Add reading-chat endpoint to ai.py**

Add `POST /api/ai/reading-chat` — uses AIServiceFactory, appends to session messages.

- [ ] **Step 5: Add session list/delete endpoints to ai.py**

```
GET /api/ai/reading-sessions/{book_id} → list sessions
DELETE /api/reading-sessions/{id} → delete session
```

- [ ] **Step 6: Write tests and commit**

---

## Task 3: Export Service + API

**Files:**
- Create: `backend/app/services/export_service.py`
- Create: `backend/app/schemas/export.py`
- Create: `backend/app/api/export.py`
- Modify: `backend/app/main.py`
- Test: `backend/tests/test_export.py`

- [ ] **Step 1: Create export service**

```python
# backend/app/services/export_service.py
# Functions: export_cards_md, export_cards_csv, export_cards_pdf
#            export_annotations_md, export_annotations_csv, export_annotations_pdf
#            export_books_md, export_books_csv, export_books_pdf
# Each returns bytes content for FileResponse
```

- [ ] **Step 2: Create schemas and router**

```python
# backend/app/schemas/export.py
class ExportRequest(BaseModel):
    data_type: str  # "cards" | "annotations" | "books"
    format: str     # "markdown" | "pdf" | "csv"
    filters: dict = {}
```

- [ ] **Step 3: Register export router in main.py**

- [ ] **Step 4: Write tests and commit**

---

## Task 4: Update Checker Service + API

**Files:**
- Create: `backend/app/services/update_checker.py`
- Create: `backend/app/api/system.py`
- Modify: `backend/app/main.py`
- Test: `backend/tests/test_update_checker.py`

- [ ] **Step 1: Create update checker service**

```python
# backend/app/services/update_checker.py
# Uses httpx to call GitHub API, compares semver, returns update info
```

- [ ] **Step 2: Create system router**

```
GET /api/system/update-check → {current_version, latest_version, has_update, release_url, release_notes}
```

- [ ] **Step 3: Register in main.py, write tests, commit**

---

## Task 5: Text Selection Callbacks for Viewers

**Files:**
- Modify: `frontend/src/components/PdfViewer.tsx`
- Modify: `frontend/src/components/EpubViewer.tsx`

- [ ] **Step 1: Add onTextSelect to PdfViewer**

Add `onTextSelect?: (text: string, rect: DOMRect) => void` prop. Use `window.getSelection()` on mouseup inside the document container.

- [ ] **Step 2: Add onTextSelect to EpubViewer**

Add `onTextSelect` prop. Use `rendition.on('selected', (cfiRange, contents) => { ... })` to capture selection.

- [ ] **Step 3: Run type check and commit**

---

## Task 6: Annotation Frontend (Sidebar + Highlight UI)

**Files:**
- Create: `frontend/src/services/annotationApi.ts`
- Create: `frontend/src/components/TextSelectionMenu.tsx`
- Create: `frontend/src/components/AnnotationSidebar.tsx`
- Modify: `frontend/src/pages/Reader/ReaderPage.tsx`

- [ ] **Step 1: Create annotationApi.ts**

```typescript
const api = axios.create({ baseURL: '/api/annotations' });
export const annotationApi = {
  list: (bookId: string) => api.get('/', { params: { book_id: bookId } }),
  create: (data) => api.post('/', data),
  update: (id, data) => api.put(`/${id}`, data),
  delete: (id) => api.delete(`/${id}`),
};
```

- [ ] **Step 2: Create TextSelectionMenu**

Floating Popover with buttons: "Ask AI", "Highlight" (with color picker), "Copy".

- [ ] **Step 3: Create AnnotationSidebar**

Drawer showing annotation list, click to jump, edit/delete.

- [ ] **Step 4: Integrate into ReaderPage**

Add TextSelectionMenu on viewer text select, add AnnotationSidebar toggle button.

- [ ] **Step 5: Run type check and commit**

---

## Task 7: Reading Chat Panel

**Files:**
- Create: `frontend/src/services/readingSessionApi.ts`
- Create: `frontend/src/components/ReadingChatPanel.tsx`
- Modify: `frontend/src/pages/Reader/ReaderPage.tsx`

- [ ] **Step 1: Create readingSessionApi.ts**

- [ ] **Step 2: Create ReadingChatPanel**

Side drawer with message list, input box, context indicator. Multi-turn conversation.

- [ ] **Step 3: Integrate into ReaderPage**

Add chat panel toggle button in toolbar, wire up selected text as context.

- [ ] **Step 4: Run type check and commit**

---

## Task 8: Export Page + Update Checker UI

**Files:**
- Create: `frontend/src/services/exportApi.ts`
- Create: `frontend/src/pages/Export/ExportPage.tsx`
- Create: `frontend/src/components/UpdateChecker.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/Layout/Sidebar.tsx`
- Modify: `frontend/src/pages/Settings/SettingsPage.tsx`

- [ ] **Step 1: Create exportApi.ts and ExportPage**

Data type selector, format selector, filter options, export button → download file.

- [ ] **Step 2: Create UpdateChecker component**

Shows current version, check button, latest version info, download link.

- [ ] **Step 3: Add route and sidebar entry for /export**

- [ ] **Step 4: Integrate UpdateChecker into SettingsPage update tab**

- [ ] **Step 5: Run type check and commit**

---

## Task 9: Final Integration and Verification

- [ ] **Step 1: Install backend deps** — `cd backend && pip install reportlab`
- [ ] **Step 2: Run all backend tests** — `python -m pytest tests/ -v`
- [ ] **Step 3: Run frontend type check** — `cd frontend && npx tsc --noEmit`
- [ ] **Step 4: Verify all new endpoints registered**
- [ ] **Step 5: Commit final state**

---

## Spec Coverage

| Spec Requirement | Task |
|------------------|------|
| Annotation model: highlight_color, selected_text, cfi, rect_data | Task 1 |
| Annotation CRUD API | Task 1 |
| ReadingSession model | Task 2 |
| Reading chat API | Task 2 |
| Session list/delete API | Task 2 |
| Export to Markdown/PDF/CSV | Task 3 |
| Update checker service | Task 4 |
| Update check API | Task 4 |
| PDF text selection callback | Task 5 |
| EPUB text selection callback | Task 5 |
| TextSelectionMenu (Ask AI / Highlight / Copy) | Task 6 |
| AnnotationSidebar | Task 6 |
| ReadingChatPanel | Task 7 |
| Export page | Task 8 |
| UpdateChecker UI | Task 8 |
