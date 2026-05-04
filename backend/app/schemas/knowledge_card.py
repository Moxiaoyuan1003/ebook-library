from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional
from uuid import UUID


class KnowledgeCardCreate(BaseModel):
    title: str = Field(..., max_length=300)
    content: str
    source_book_id: Optional[UUID] = None
    source_passage: Optional[str] = None
    annotation: Optional[str] = None
    card_type: Optional[str] = Field("note", max_length=30)
    tags: Optional[list[str]] = None


class KnowledgeCardUpdate(BaseModel):
    title: Optional[str] = Field(None, max_length=300)
    content: Optional[str] = None
    source_passage: Optional[str] = None
    annotation: Optional[str] = None
    card_type: Optional[str] = Field(None, max_length=30)
    tags: Optional[list[str]] = None


class KnowledgeCardResponse(BaseModel):
    id: UUID
    title: str
    content: str
    source_book_id: Optional[UUID]
    source_passage: Optional[str]
    annotation: Optional[str]
    card_type: str
    tags: Optional[list[str]]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class CardLinkCreate(BaseModel):
    source_card_id: UUID
    target_card_id: UUID
    link_type: Optional[str] = Field("related", max_length=30)


class CardLinkResponse(BaseModel):
    id: UUID
    source_card_id: UUID
    target_card_id: UUID
    link_type: str
    created_at: datetime

    class Config:
        from_attributes = True


class KnowledgeCardListResponse(BaseModel):
    items: list[KnowledgeCardResponse]
    total: int
    page: int
    page_size: int
