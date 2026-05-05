# Phase 4: Data Features — Notes Export, Backup, Goals, Timeline

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add notes export (Markdown), data backup/restore, duplicate detection, reading goals, and annotation timeline.

**Depends on:** Phase 3 (backend APIs, reading sessions, bookmarks).

---

### Task 1: Notes export API + frontend button

**Files:**
- Modify: `backend/app/api/books.py` (add notes export endpoint)
- Modify: `frontend/src/pages/BookDetail/BookDetailPage.tsx` (add export button)

- [ ] **Step 1: Add export endpoint to backend**

```python
@router.get("/{book_id}/notes/export")
def export_notes(book_id: UUID, db=Depends(get_db)):
    book = db.query(Book).get(str(book_id))
    annotations = db.query(Annotation).filter(Annotation.book_id == str(book_id)).order_by(Annotation.page_number).all()

    lines = [f"# 《{book.title}》读书笔记\n"]

    highlights = [a for a in annotations if a.type == 'highlight']
    notes = [a for a in annotations if a.type == 'note']

    if highlights:
        lines.append("## 高亮\n")
        for h in highlights:
            lines.append(f"- **P.{h.page_number}** \"{h.selected_text}\"\n")

    if notes:
        lines.append("## 批注\n")
        for n in notes:
            lines.append(f"- **P.{n.page_number}** \"{n.selected_text}\"\n")
            lines.append(f"  > {n.note_content}\n")

    from fastapi.responses import PlainTextResponse
    return PlainTextResponse("".join(lines), media_type="text/markdown",
        headers={"Content-Disposition": f"attachment; filename={book.title}_notes.md"})
```

- [ ] **Step 2: Add export button to BookDetailPage**

In the notes tab, add:
```typescript
<Button icon={<ExportOutlined />} onClick={() => window.open(`http://127.0.0.1:8000/api/books/${bookId}/notes/export`)}>
  导出 Markdown
</Button>
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/api/books.py frontend/src/pages/BookDetail/
git commit -m "feat: add notes export to Markdown"
```

---

### Task 2: Duplicate detection on import

**Files:**
- Modify: `backend/app/api/books.py` (check before import)

- [ ] **Step 1: Add duplicate check to import endpoint**

```python
@router.post("/import/file")
def import_file(body: FilePathBody, db=Depends(get_db)):
    import os
    file_path = body.file_path
    file_name = os.path.basename(file_path)
    file_size = os.path.getsize(file_path) if os.path.exists(file_path) else 0

    # Check for duplicates
    existing = db.query(Book).filter(
        Book.file_path == file_path
    ).first()
    if existing:
        return {"duplicate": True, "existing_id": str(existing.id), "existing_title": existing.title}

    # ... rest of import logic
```

- [ ] **Step 2: Handle duplicate response in frontend**

In ImportDialog, when response has `duplicate: true`:
```typescript
Modal.confirm({
  title: '书籍可能已存在',
  content: `已存在《${response.data.existing_title}》，是否继续导入？`,
  onOk: () => { /* force import */ },
});
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/api/books.py frontend/src/components/ImportDialog.tsx
git commit -m "feat: detect duplicate books on import"
```

---

### Task 3: Data backup/restore

**Files:**
- Create: `backend/app/api/backup.py`
- Create: `frontend/src/pages/Settings/BackupSettings.tsx`
- Modify: `frontend/src/pages/Settings/SettingsPage.tsx` (add backup tab)

- [ ] **Step 1: Create backup API**

```python
# backend/app/api/backup.py
from fastapi import APIRouter, UploadFile, File
from fastapi.responses import FileResponse
import zipfile, io, os, shutil

router = APIRouter(prefix="/api/backup", tags=["backup"])

@router.get("/export")
def export_backup():
    zip_path = "backup.zip"
    with zipfile.ZipFile(zip_path, 'w') as zf:
        # Database
        if os.path.exists("data/ebook.db"):
            zf.write("data/ebook.db", "ebook.db")
        # Covers
        if os.path.exists("covers"):
            for f in os.listdir("covers"):
                zf.write(f"covers/{f}", f"covers/{f}")
        # .env
        if os.path.exists(".env"):
            zf.write(".env", ".env")
    return FileResponse(zip_path, filename="ebook-library-backup.zip")

@router.post("/import")
async def import_backup(file: UploadFile = File(...)):
    content = await file.read()
    with zipfile.ZipFile(io.BytesIO(content)) as zf:
        zf.extractall(".")
    return {"ok": True, "message": "备份已恢复，请重启应用"}
```

- [ ] **Step 2: Create BackupSettings component**

```typescript
// frontend/src/pages/Settings/BackupSettings.tsx
import { Button, message, Upload } from 'antd';
import { DownloadOutlined, UploadOutlined } from '@ant-design/icons';
import API_BASE from '../../services/apiConfig';

export default function BackupSettings() {
  return (
    <div>
      <p style={{ marginBottom: 16 }}>导出或导入您的全部书库数据（数据库、封面、配置）。</p>
      <div style={{ display: 'flex', gap: 12 }}>
        <Button icon={<DownloadOutlined />} onClick={() => window.open(`${API_BASE}/api/backup/export`)}>
          导出备份
        </Button>
        <Upload
          action={`${API_BASE}/api/backup/import`}
          showUploadList={false}
          accept=".zip"
          onSuccess={() => message.success('备份已恢复，请重启应用')}
          onError={() => message.error('恢复失败')}
        >
          <Button icon={<UploadOutlined />}>导入备份</Button>
        </Upload>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Add backup tab to SettingsPage**

```typescript
import BackupSettings from './BackupSettings';
// In tabs array:
{ key: 'backup', label: '数据管理', children: <BackupSettings /> },
```

- [ ] **Step 4: Commit**

```bash
git add backend/app/api/backup.py frontend/src/pages/Settings/BackupSettings.tsx frontend/src/pages/Settings/SettingsPage.tsx
git commit -m "feat: add data backup/restore functionality"
```

---

### Task 4: Reading goals

**Files:**
- Modify: `frontend/src/pages/Stats/StatsPage.tsx` (add goals section)
- Create: `frontend/src/stores/goalStore.ts`

- [ ] **Step 1: Create goalStore**

```typescript
// frontend/src/stores/goalStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface GoalState {
  dailyGoalMinutes: number;
  setDailyGoal: (minutes: number) => void;
}

export const useGoalStore = create<GoalState>()(
  persist(
    (set) => ({
      dailyGoalMinutes: 30,
      setDailyGoal: (minutes) => set({ dailyGoalMinutes: minutes }),
    }),
    { name: 'ebook-goals' },
  ),
);
```

- [ ] **Step 2: Add goals section to StatsPage**

Show a circular progress ring for today's reading goal progress, based on `daily_reading` data from stats API.

- [ ] **Step 3: Add goal settings to SettingsPage**

Add a slider/input in settings to configure daily reading goal (5-120 minutes).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/stores/goalStore.ts frontend/src/pages/Stats/ frontend/src/pages/Settings/
git commit -m "feat: add daily reading goals with progress tracking"
```

---

### Task 5: Annotation timeline

**Files:**
- Create: `frontend/src/pages/Timeline/TimelinePage.tsx`
- Modify: `frontend/src/App.tsx` (add route)
- Modify: `frontend/src/components/Layout/Sidebar.tsx` (add nav item)

- [ ] **Step 1: Add backend endpoint for all annotations**

```python
@router.get("/api/annotations/timeline")
def annotation_timeline(limit: int = 50, db=Depends(get_db)):
    annotations = db.query(Annotation).order_by(Annotation.created_at.desc()).limit(limit).all()
    return [
        {
            "id": str(a.id),
            "book_id": str(a.book_id),
            "type": a.type,
            "selected_text": a.selected_text,
            "note_content": a.note_content,
            "page_number": a.page_number,
            "highlight_color": a.highlight_color,
            "created_at": a.created_at.isoformat(),
        }
        for a in annotations
    ]
```

- [ ] **Step 2: Create TimelinePage**

A list view showing all annotations across all books, sorted by date, with book title lookup and click-to-navigate.

- [ ] **Step 3: Add route and sidebar nav item**

```typescript
// App.tsx
<Route path="/timeline" element={<TimelinePage />} />

// Sidebar.tsx — add menu item
{ key: 'timeline', icon: <ClockCircleOutlined />, label: '批注时间线' },
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/Timeline/ frontend/src/App.tsx frontend/src/components/Layout/Sidebar.tsx backend/app/api/
git commit -m "feat: add annotation timeline page"
```
