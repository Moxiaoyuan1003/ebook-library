from pydantic import BaseModel
from datetime import datetime
from typing import Optional
from uuid import UUID


class ReadingChatRequest(BaseModel):
    book_id: UUID
    message: str
    context_passages: list[dict] = []
    session_id: Optional[UUID] = None


class ReadingChatResponse(BaseModel):
    reply: str
    session_id: UUID


class ReadingSessionResponse(BaseModel):
    id: UUID
    book_id: UUID
    messages: list[dict]
    context_passages: list[dict]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
