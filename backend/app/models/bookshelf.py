from sqlalchemy import Column, String, Text, Integer, Table, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid

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

    books = relationship("Book", secondary="bookshelf_books", back_populates="bookshelves")
