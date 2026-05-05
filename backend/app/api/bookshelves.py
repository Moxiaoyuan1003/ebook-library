from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import Bookshelf
from app.schemas.bookshelf import BookshelfCreate, BookshelfResponse, BookshelfUpdate

router = APIRouter()


@router.get("/", response_model=list[BookshelfResponse])
def list_bookshelves(db: Session = Depends(get_db)):
    shelves = db.query(Bookshelf).order_by(Bookshelf.sort_order).all()
    return [BookshelfResponse.model_validate(s) for s in shelves]


@router.post("/", response_model=BookshelfResponse)
def create_bookshelf(data: BookshelfCreate, db: Session = Depends(get_db)):
    shelf = Bookshelf(**data.model_dump())
    db.add(shelf)
    db.commit()
    db.refresh(shelf)
    return BookshelfResponse.model_validate(shelf)


@router.put("/{shelf_id}", response_model=BookshelfResponse)
def update_bookshelf(shelf_id: UUID, data: BookshelfUpdate, db: Session = Depends(get_db)):
    shelf = db.query(Bookshelf).filter(Bookshelf.id == shelf_id).first()
    if not shelf:
        raise HTTPException(status_code=404, detail="Bookshelf not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(shelf, key, value)
    db.commit()
    db.refresh(shelf)
    return BookshelfResponse.model_validate(shelf)


@router.delete("/{shelf_id}")
def delete_bookshelf(shelf_id: UUID, db: Session = Depends(get_db)):
    shelf = db.query(Bookshelf).filter(Bookshelf.id == shelf_id).first()
    if not shelf:
        raise HTTPException(status_code=404, detail="Bookshelf not found")
    db.delete(shelf)
    db.commit()
    return {"status": "deleted"}


@router.get("/{shelf_id}/books")
def get_shelf_books(shelf_id: UUID, db: Session = Depends(get_db)):
    from app.models import Book

    shelf = db.query(Bookshelf).filter(Bookshelf.id == shelf_id).first()
    if not shelf:
        raise HTTPException(status_code=404, detail="Bookshelf not found")

    if shelf.rules:
        query = db.query(Book)
        rules = shelf.rules
        if rules.get("format"):
            query = query.filter(Book.file_format == rules["format"])
        if rules.get("status"):
            query = query.filter(Book.reading_status == rules["status"])
        if rules.get("is_favorite"):
            query = query.filter(Book.is_favorite == True)  # noqa: E712
        if rules.get("min_rating"):
            query = query.filter(Book.rating >= rules["min_rating"])
        books = query.all()
        return [{"id": str(b.id), "title": b.title, "author": b.author, "cover_url": b.cover_url, "file_format": b.file_format, "reading_status": b.reading_status, "rating": b.rating, "is_favorite": b.is_favorite} for b in books]
    else:
        return [{"id": str(b.id), "title": b.title, "author": b.author, "cover_url": b.cover_url, "file_format": b.file_format, "reading_status": b.reading_status, "rating": b.rating, "is_favorite": b.is_favorite} for b in shelf.books]


@router.post("/{shelf_id}/books/{book_id}")
def add_book_to_shelf(shelf_id: UUID, book_id: UUID, db: Session = Depends(get_db)):
    shelf = db.query(Bookshelf).filter(Bookshelf.id == shelf_id).first()
    if not shelf:
        raise HTTPException(status_code=404, detail="Bookshelf not found")
    from app.models import Book

    book = db.query(Book).filter(Book.id == book_id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    shelf.books.append(book)
    db.commit()
    return {"status": "added"}


@router.delete("/{shelf_id}/books/{book_id}")
def remove_book_from_shelf(shelf_id: UUID, book_id: UUID, db: Session = Depends(get_db)):
    shelf = db.query(Bookshelf).filter(Bookshelf.id == shelf_id).first()
    if not shelf:
        raise HTTPException(status_code=404, detail="Bookshelf not found")
    from app.models import Book

    book = db.query(Book).filter(Book.id == book_id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    shelf.books.remove(book)
    db.commit()
    return {"status": "removed"}
