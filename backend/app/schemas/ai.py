from pydantic import BaseModel, Field
from typing import Optional
from uuid import UUID


class SummaryRequest(BaseModel):
    book_id: str
    force_regenerate: bool = False


class SummaryResponse(BaseModel):
    book_id: UUID
    summary: str
    tags: list[str]


class ChatMessage(BaseModel):
    role: str = Field(..., pattern="^(user|assistant|system)$")
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    book_id: Optional[str] = None
    context_passages: Optional[list[str]] = None


class ChatResponse(BaseModel):
    message: ChatMessage
    sources: list[dict] = []
