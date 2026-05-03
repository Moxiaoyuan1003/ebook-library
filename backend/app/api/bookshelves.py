from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from uuid import UUID

from app.core.database import get_db
from app.models import Bookshelf
from app.schemas.bookshelf import BookshelfCreate, BookshelfUpdate, BookshelfResponse

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
