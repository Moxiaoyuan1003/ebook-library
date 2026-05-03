from sqlalchemy import Column, String, Table, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid

from app.core.database import Base


book_tags = Table(
    "book_tags",
    Base.metadata,
    Column("book_id", UUID(as_uuid=True), ForeignKey("books.id"), primary_key=True),
    Column("tag_id", UUID(as_uuid=True), ForeignKey("tags.id"), primary_key=True),
)


class Tag(Base):
    __tablename__ = "tags"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), unique=True, nullable=False, index=True)
    color = Column(String(7), default="#1677ff")

    books = relationship("Book", secondary="book_tags", back_populates="tags")
