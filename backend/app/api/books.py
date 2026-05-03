from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from uuid import UUID

from app.core.database import get_db
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
