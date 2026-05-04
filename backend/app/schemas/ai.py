from uuid import UUID

from pydantic import BaseModel, Field


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
    book_id: str | None = None
    context_passages: list[str] | None = None


class ChatResponse(BaseModel):
    message: ChatMessage
    sources: list[dict] = []
