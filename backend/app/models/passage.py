import uuid
from datetime import datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.core.database import Base


class Passage(Base):
    __tablename__ = "passages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    book_id = Column(UUID(as_uuid=True), ForeignKey("books.id"), nullable=False, index=True)
    chapter = Column(String(200))
    page_number = Column(Integer)
    content = Column(Text, nullable=False)
    embedding = Column(Vector(1536))
    created_at = Column(DateTime, default=datetime.utcnow)

    book = relationship("Book", back_populates="passages")
