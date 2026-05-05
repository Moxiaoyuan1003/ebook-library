import uuid

from sqlalchemy import Column, ForeignKey, Integer, String, Table, Text
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import relationship

from app.core.database import Base

bookshelf_books = Table(
    "bookshelf_books",
    Base.metadata,
    Column("bookshelf_id", UUID(as_uuid=True), ForeignKey("bookshelves.id"), primary_key=True),
    Column("book_id", UUID(as_uuid=True), ForeignKey("books.id"), primary_key=True),
)


class Bookshelf(Base):
    __tablename__ = "bookshelves"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(200), nullable=False)
    description = Column(Text)
    sort_order = Column(Integer, default=0)
    rules = Column(JSON, nullable=True)  # {"format":"epub","status":"reading","min_rating":4,"is_favorite":true}

    books = relationship("Book", secondary="bookshelf_books", back_populates="bookshelves")
