from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import Optional
from uuid import UUID
from pathlib import Path

from app.core.database import get_db
from app.models import ReadingProgress
from app.schemas.book import BookCreate, BookUpdate, BookResponse, BookListResponse
from app.services.book_service import BookService
from app.services.import_service import ImportService

router = APIRouter()


@router.get("/", response_model=BookListResponse)
def list_books(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    reading_status: Optional[str] = None,
    is_favorite: Optional[bool] = None,
    db: Session = Depends(get_db),
):
    service = BookService(db)
    books, total = service.list_books(
        page=page,
        page_size=page_size,
        search=search,
        reading_status=reading_status,
        is_favorite=is_favorite,
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
def import_file(file_path: str, db: Session = Depends(get_db)):
    service = ImportService(db)
    book = service.import_file(file_path)
    if not book:
        raise HTTPException(status_code=400, detail="Unsupported file format")
    return BookResponse.model_validate(book)


@router.post("/import/directory")
def import_directory(directory: str, db: Session = Depends(get_db)):
    service = ImportService(db)
    files = service.scan_directory(directory)
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
    current_page: Optional[int] = None,
    current_cfi: Optional[str] = None,
    progress_percent: Optional[float] = None,
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
