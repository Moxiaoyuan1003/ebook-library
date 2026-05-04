from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional
from uuid import UUID


class AnnotationCreate(BaseModel):
    book_id: UUID
    type: str = Field(..., max_length=20)
    page_number: Optional[int] = None
    selected_text: Optional[str] = None
    note_content: Optional[str] = None
    color: Optional[str] = Field(None, max_length=7)
    highlight_color: Optional[str] = Field(None, max_length=20)
    start_cfi: Optional[str] = None
    end_cfi: Optional[str] = None
    rect_data: Optional[str] = None


class AnnotationUpdate(BaseModel):
    note_content: Optional[str] = None
    color: Optional[str] = Field(None, max_length=7)
    highlight_color: Optional[str] = Field(None, max_length=20)


class AnnotationResponse(BaseModel):
    id: UUID
    book_id: UUID
    type: str
    page_number: Optional[int] = None
    selected_text: Optional[str] = None
    note_content: Optional[str] = None
    color: Optional[str] = None
    highlight_color: Optional[str] = None
    start_cfi: Optional[str] = None
    end_cfi: Optional[str] = None
    rect_data: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
