from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

from app.core.database import Base


class CardLink(Base):
    __tablename__ = "card_links"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source_card_id = Column(UUID(as_uuid=True), ForeignKey("knowledge_cards.id"), nullable=False)
    target_card_id = Column(UUID(as_uuid=True), ForeignKey("knowledge_cards.id"), nullable=False)
    link_type = Column(String(30), default="related")
    created_at = Column(DateTime, default=datetime.utcnow)

    source_card = relationship("KnowledgeCard", foreign_keys=[source_card_id])
    target_card = relationship("KnowledgeCard", foreign_keys=[target_card_id])
