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
        from app.models.bookshelf import bookshelf_books

        query = self.db.query(Book)

        if search:
            query = query.filter(Book.title.ilike(f"%{search}%") | Book.author.ilike(f"%{search}%"))
        if reading_status:
            query = query.filter(Book.reading_status == reading_status)
        if is_favorite is not None:
            query = query.filter(Book.is_favorite == is_favorite)
        if bookshelf_id:
            query = query.join(bookshelf_books, Book.id == bookshelf_books.c.book_id).filter(
                bookshelf_books.c.bookshelf_id == bookshelf_id
            )

        if reading_status:
            query = query.order_by(Book.updated_at.desc())
        else:
            query = query.order_by(Book.created_at.desc())

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
        # Delete all related records first (FK constraints without cascade)
        from app.models.reading_progress import ReadingProgress
        from app.models.bookmark import Bookmark
        from app.models.annotation import Annotation
        from app.models.passage import Passage
        from app.models.reading_session import ReadingSession
        from app.models.knowledge_card import KnowledgeCard

        self.db.query(ReadingProgress).filter(ReadingProgress.book_id == book_id).delete()
        self.db.query(Bookmark).filter(Bookmark.book_id == book_id).delete()
        self.db.query(Annotation).filter(Annotation.book_id == book_id).delete()
        self.db.query(Passage).filter(Passage.book_id == book_id).delete()
        self.db.query(ReadingSession).filter(ReadingSession.book_id == book_id).delete()
        self.db.query(KnowledgeCard).filter(KnowledgeCard.source_book_id == book_id).delete(synchronize_session=False)
        # Clear association tables
        book.tags.clear()
        book.bookshelves.clear()
        self.db.flush()

        self.db.delete(book)
        self.db.commit()
        return True
