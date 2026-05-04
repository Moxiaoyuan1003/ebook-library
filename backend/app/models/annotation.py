from sqlalchemy import Column, String, Integer, Text, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

from app.core.database import Base


class Annotation(Base):
    __tablename__ = "annotations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    book_id = Column(UUID(as_uuid=True), ForeignKey("books.id"), nullable=False, index=True)
    type = Column(String(20), nullable=False)  # bookmark, highlight, note
    page_number = Column(Integer)
    selected_text = Column(Text)
    note_content = Column(Text)
    color = Column(String(7), default="#ffeb3b")
    highlight_color = Column(String(20), default="yellow")  # yellow/green/blue/pink/purple
    start_cfi = Column(Text)  # EPUB start CFI
    end_cfi = Column(Text)    # EPUB end CFI
    rect_data = Column(Text)  # JSON string for PDF highlight rectangles
    created_at = Column(DateTime, default=datetime.utcnow)

    book = relationship("Book", back_populates="annotations")
