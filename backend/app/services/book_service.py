from uuid import UUID

from sqlalchemy.orm import Session

from app.models import Book
from app.schemas.book import BookCreate, BookUpdate


class BookService:
    def __init__(self, db: Session):
        self.db = db

    def list_books(
        self,
        page: int = 1,
        page_size: int = 20,
        search: str | None = None,
        reading_status: str | None = None,
        is_favorite: bool | None = None,
        tag_id: UUID | None = None,
        bookshelf_id: UUID | None = None,
    ) -> tuple[list[Book], int]:
        query = self.db.query(Book)

        if search:
            query = query.filter(Book.title.ilike(f"%{search}%") | Book.author.ilike(f"%{search}%"))
        if reading_status:
            query = query.filter(Book.reading_status == reading_status)
        if is_favorite is not None:
            query = query.filter(Book.is_favorite == is_favorite)

        total = query.count()
        books = query.offset((page - 1) * page_size).limit(page_size).all()
        return books, total

    def get_book(self, book_id: UUID) -> Book | None:
        return self.db.query(Book).filter(Book.id == book_id).first()

    def create_book(self, data: BookCreate) -> Book:
        book = Book(**data.model_dump())
        self.db.add(book)
        self.db.commit()
        self.db.refresh(book)
        return book

    def update_book(self, book_id: UUID, data: BookUpdate) -> Book | None:
        book = self.get_book(book_id)
        if not book:
            return None
        for key, value in data.model_dump(exclude_unset=True).items():
            setattr(book, key, value)
        self.db.commit()
        self.db.refresh(book)
        return book

    def delete_book(self, book_id: UUID) -> bool:
        book = self.get_book(book_id)
        if not book:
            return False
        self.db.delete(book)
        self.db.commit()
        return True
