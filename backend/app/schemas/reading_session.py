from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class ReadingChatRequest(BaseModel):
    book_id: UUID
    message: str
    context_passages: list[dict] = []
    session_id: UUID | None = None


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
