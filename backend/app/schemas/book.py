from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional
from uuid import UUID


class BookCreate(BaseModel):
    title: str = Field(..., max_length=500)
    author: Optional[str] = Field(None, max_length=300)
    isbn: Optional[str] = Field(None, max_length=20)
    publisher: Optional[str] = Field(None, max_length=200)
    publish_date: Optional[datetime] = None
    file_path: str
    file_format: str = Field(..., max_length=10)


class BookUpdate(BaseModel):
    title: Optional[str] = Field(None, max_length=500)
    author: Optional[str] = Field(None, max_length=300)
    isbn: Optional[str] = Field(None, max_length=20)
    publisher: Optional[str] = Field(None, max_length=200)
    publish_date: Optional[datetime] = None
    reading_status: Optional[str] = None
    rating: Optional[int] = Field(None, ge=1, le=5)
    is_favorite: Optional[bool] = None
    summary: Optional[str] = None


class BookResponse(BaseModel):
    id: UUID
    title: str
    author: Optional[str]
    isbn: Optional[str]
    publisher: Optional[str]
    publish_date: Optional[datetime]
    cover_url: Optional[str]
    file_path: str
    file_format: str
    file_size: Optional[int]
    page_count: Optional[int]
    reading_status: str
    rating: Optional[int]
    is_favorite: bool
    summary: Optional[str]
    metadata_enriched: bool
    metadata_source: str
    open_library_id: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class BookListResponse(BaseModel):
    items: list[BookResponse]
    total: int
    page: int
    page_size: int
