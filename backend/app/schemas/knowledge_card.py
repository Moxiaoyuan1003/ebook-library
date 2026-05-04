from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class KnowledgeCardCreate(BaseModel):
    title: str = Field(..., max_length=300)
    content: str
    source_book_id: UUID | None = None
    source_passage: str | None = None
    annotation: str | None = None
    card_type: str | None = Field("note", max_length=30)
    tags: list[str] | None = None


class KnowledgeCardUpdate(BaseModel):
    title: str | None = Field(None, max_length=300)
    content: str | None = None
    source_passage: str | None = None
    annotation: str | None = None
    card_type: str | None = Field(None, max_length=30)
    tags: list[str] | None = None


class KnowledgeCardResponse(BaseModel):
    id: UUID
    title: str
    content: str
    source_book_id: UUID | None
    source_passage: str | None
    annotation: str | None
    card_type: str
    tags: list[str] | None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class CardLinkCreate(BaseModel):
    source_card_id: UUID
    target_card_id: UUID
    link_type: str | None = Field("related", max_length=30)


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
