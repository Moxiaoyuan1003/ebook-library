from sqlalchemy import Column, String, Text, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

from app.core.database import Base


class KnowledgeCard(Base):
    __tablename__ = "knowledge_cards"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String(300), nullable=False)
    content = Column(Text, nullable=False)
    source_book_id = Column(UUID(as_uuid=True), ForeignKey("books.id"))
    source_passage = Column(Text)
    annotation = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    book = relationship("Book", foreign_keys=[source_book_id])
