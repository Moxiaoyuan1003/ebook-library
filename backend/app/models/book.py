from sqlalchemy import Column, String, Integer, SmallInteger, Boolean, DateTime, Text, BigInteger
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

from app.core.database import Base


class Book(Base):
    __tablename__ = "books"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String(500), nullable=False, index=True)
    author = Column(String(300), index=True)
    isbn = Column(String(20), index=True)
    publisher = Column(String(200))
    publish_date = Column(DateTime)
    cover_url = Column(Text)
    file_path = Column(Text, nullable=False)
    file_format = Column(String(10), nullable=False)
    file_size = Column(BigInteger)
    page_count = Column(Integer)
    reading_status = Column(String(20), default="unread", index=True)
    rating = Column(SmallInteger)
    is_favorite = Column(Boolean, default=False, index=True)
    summary = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    tags = relationship("Tag", secondary="book_tags", back_populates="books")
    bookshelves = relationship("Bookshelf", secondary="bookshelf_books", back_populates="books")
    passages = relationship("Passage", back_populates="book", cascade="all, delete-orphan")
    annotations = relationship("Annotation", back_populates="book", cascade="all, delete-orphan")
