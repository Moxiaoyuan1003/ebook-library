from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import ReadingProgress
from app.models.bookmark import Bookmark
from app.models.tag import Tag
from app.schemas.book import BookCreate, BookListResponse, BookResponse, BookUpdate
from app.schemas.tag import TagResponse
from app.services.book_service import BookService
from app.services.import_service import ImportService


class FilePathBody(BaseModel):
    file_path: str


class DirectoryBody(BaseModel):
    directory: str


class BookmarkBody(BaseModel):
    page_number: int


class TagBody(BaseModel):
    tag: str

router = APIRouter()


@router.get("/", response_model=BookListResponse)
def list_books(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str | None = None,
    reading_status: str | None = None,
    is_favorite: bool | None = None,
    bookshelf_id: UUID | None = None,
    db: Session = Depends(get_db),
):
    service = BookService(db)
    books, total = service.list_books(
        page=page,
        page_size=page_size,
        search=search,
        reading_status=reading_status,
        is_favorite=is_favorite,
        bookshelf_id=bookshelf_id,
    )
    return BookListResponse(
        items=[BookResponse.model_validate(b) for b in books],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/file")
def serve_book_file(file_path: str):
    """Serve a book file for reading (PDF/EPUB readers)."""
    p = Path(file_path)
    if not p.exists() or not p.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(p)


@router.get("/{book_id}", response_model=BookResponse)
def get_book(book_id: UUID, db: Session = Depends(get_db)):
    service = BookService(db)
    book = service.get_book(book_id)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    return BookResponse.model_validate(book)


@router.post("/", response_model=BookResponse)
def create_book(data: BookCreate, db: Session = Depends(get_db)):
    service = BookService(db)
    book = service.create_book(data)
    return BookResponse.model_validate(book)


@router.put("/{book_id}", response_model=BookResponse)
def update_book(book_id: UUID, data: BookUpdate, db: Session = Depends(get_db)):
    service = BookService(db)
    book = service.update_book(book_id, data)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    return BookResponse.model_validate(book)


@router.delete("/{book_id}")
def delete_book(book_id: UUID, db: Session = Depends(get_db)):
    service = BookService(db)
    if not service.delete_book(book_id):
        raise HTTPException(status_code=404, detail="Book not found")
    return {"status": "deleted"}


@router.post("/import/file")
def import_file(body: FilePathBody, db: Session = Depends(get_db)):
    service = ImportService(db)
    try:
        book = service.import_file(body.file_path)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not book:
        raise HTTPException(status_code=400, detail="Unsupported file format")
    return BookResponse.model_validate(book)


@router.post("/import/directory")
def import_directory(body: DirectoryBody, db: Session = Depends(get_db)):
    service = ImportService(db)
    files = service.scan_directory(body.directory)
    if not files:
        raise HTTPException(status_code=400, detail="No supported files found")
    return {"files_found": len(files), "files": files}


@router.get("/{book_id}/progress")
def get_reading_progress(book_id: UUID, db: Session = Depends(get_db)):
    """Get reading progress for a book."""
    progress = db.query(ReadingProgress).filter(ReadingProgress.book_id == book_id).first()
    if not progress:
        return {"current_page": 0, "current_cfi": None, "progress_percent": 0.0}
    return {
        "current_page": progress.current_page,
        "current_cfi": progress.current_cfi,
        "progress_percent": progress.progress_percent,
    }


@router.put("/{book_id}/progress")
def update_reading_progress(
    book_id: UUID,
    current_page: int | None = None,
    current_cfi: str | None = None,
    progress_percent: float | None = None,
    db: Session = Depends(get_db),
):
    """Update reading progress for a book."""
    progress = db.query(ReadingProgress).filter(ReadingProgress.book_id == book_id).first()
    if not progress:
        progress = ReadingProgress(book_id=book_id)
        db.add(progress)
    if current_page is not None:
        progress.current_page = current_page
    if current_cfi is not None:
        progress.current_cfi = current_cfi
    if progress_percent is not None:
        progress.progress_percent = progress_percent
    db.commit()
    return {"status": "ok"}


@router.get("/{book_id}/bookmarks")
def get_bookmarks(book_id: UUID, db: Session = Depends(get_db)):
    bms = db.query(Bookmark).filter(Bookmark.book_id == book_id).order_by(Bookmark.page_number).all()
    return [{"id": str(b.id), "page_number": b.page_number, "created_at": b.created_at.isoformat()} for b in bms]


@router.post("/{book_id}/bookmarks")
def add_bookmark(book_id: UUID, body: BookmarkBody, db: Session = Depends(get_db)):
    existing = db.query(Bookmark).filter(
        Bookmark.book_id == book_id, Bookmark.page_number == body.page_number
    ).first()
    if existing:
        return {"id": str(existing.id), "page_number": existing.page_number}
    bm = Bookmark(book_id=book_id, page_number=body.page_number)
    db.add(bm)
    db.commit()
    return {"id": str(bm.id), "page_number": bm.page_number}


@router.delete("/{book_id}/bookmarks/{page_number}")
def delete_bookmark(book_id: UUID, page_number: int, db: Session = Depends(get_db)):
    db.query(Bookmark).filter(
        Bookmark.book_id == book_id, Bookmark.page_number == page_number
    ).delete()
    db.commit()
    return {"ok": True}


@router.get("/{book_id}/notes/export")
def export_notes(book_id: UUID, db: Session = Depends(get_db)):
    from fastapi.responses import PlainTextResponse

    from app.models import Annotation

    service = BookService(db)
    book = service.get_book(book_id)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    annotations = (
        db.query(Annotation)
        .filter(Annotation.book_id == book_id)
        .order_by(Annotation.page_number)
        .all()
    )

    lines = [f"# 《{book.title}》读书笔记\n"]

    highlights = [a for a in annotations if a.type == "highlight"]
    notes = [a for a in annotations if a.type == "note"]

    if highlights:
        lines.append("## 高亮\n")
        for h in highlights:
            lines.append(f"- **P.{h.page_number}** \"{h.selected_text}\"\n")

    if notes:
        lines.append("## 批注\n")
        for n in notes:
            lines.append(f"- **P.{n.page_number}** \"{n.selected_text}\"\n")
            if n.note_content:
                lines.append(f"  > {n.note_content}\n")

    return PlainTextResponse(
        "".join(lines),
        media_type="text/markdown",
        headers={"Content-Disposition": f"attachment; filename={book.title}_notes.md"},
    )


@router.get("/{book_id}/tags")
def get_book_tags(book_id: UUID, db: Session = Depends(get_db)):
    service = BookService(db)
    book = service.get_book(book_id)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    return {"tags": [{"id": str(t.id), "name": t.name, "color": t.color} for t in book.tags]}


@router.post("/{book_id}/tags")
def add_book_tag(book_id: UUID, body: TagBody, db: Session = Depends(get_db)):
    service = BookService(db)
    book = service.get_book(book_id)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    tag = db.query(Tag).filter(Tag.name == body.tag).first()
    if not tag:
        tag = Tag(name=body.tag)
        db.add(tag)
        db.flush()
    if tag not in book.tags:
        book.tags.append(tag)
        db.commit()
    return {"id": str(tag.id), "name": tag.name, "color": tag.color}


@router.delete("/{book_id}/tags/{tag_name}")
def remove_book_tag(book_id: UUID, tag_name: str, db: Session = Depends(get_db)):
    service = BookService(db)
    book = service.get_book(book_id)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    tag = db.query(Tag).filter(Tag.name == tag_name).first()
    if tag and tag in book.tags:
        book.tags.remove(tag)
        db.commit()
    return {"ok": True}
