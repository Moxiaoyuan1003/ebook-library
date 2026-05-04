from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class AnnotationCreate(BaseModel):
    book_id: UUID
    type: str = Field(..., max_length=20)
    page_number: int | None = None
    selected_text: str | None = None
    note_content: str | None = None
    color: str | None = Field(None, max_length=7)
    highlight_color: str | None = Field(None, max_length=20)
    start_cfi: str | None = None
    end_cfi: str | None = None
    rect_data: str | None = None


class AnnotationUpdate(BaseModel):
    note_content: str | None = None
    color: str | None = Field(None, max_length=7)
    highlight_color: str | None = Field(None, max_length=20)


class AnnotationResponse(BaseModel):
    id: UUID
    book_id: UUID
    type: str
    page_number: int | None = None
    selected_text: str | None = None
    note_content: str | None = None
    color: str | None = None
    highlight_color: str | None = None
    start_cfi: str | None = None
    end_cfi: str | None = None
    rect_data: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True
