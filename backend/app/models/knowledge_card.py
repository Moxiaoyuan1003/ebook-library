import uuid
from datetime import datetime

from sqlalchemy import JSON, Column, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.core.database import Base


class KnowledgeCard(Base):
    __tablename__ = "knowledge_cards"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String(300), nullable=False)
    content = Column(Text, nullable=False)
    source_book_id = Column(UUID(as_uuid=True), ForeignKey("books.id"))
    source_passage = Column(Text)
    annotation = Column(Text)
    card_type = Column(String(30), default="note")
    tags = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    book = relationship("Book", foreign_keys=[source_book_id])
