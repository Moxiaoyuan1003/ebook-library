from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class BookCreate(BaseModel):
    title: str = Field(..., max_length=500)
    author: str | None = Field(None, max_length=300)
    isbn: str | None = Field(None, max_length=20)
    publisher: str | None = Field(None, max_length=200)
    publish_date: datetime | None = None
    file_path: str
    file_format: str = Field(..., max_length=10)


class BookUpdate(BaseModel):
    title: str | None = Field(None, max_length=500)
    author: str | None = Field(None, max_length=300)
    isbn: str | None = Field(None, max_length=20)
    publisher: str | None = Field(None, max_length=200)
    publish_date: datetime | None = None
    reading_status: str | None = None
    rating: int | None = Field(None, ge=1, le=5)
    is_favorite: bool | None = None
    summary: str | None = None


class BookResponse(BaseModel):
    id: UUID
    title: str
    author: str | None
    isbn: str | None
    publisher: str | None
    publish_date: datetime | None
    cover_url: str | None
    file_path: str
    file_format: str
    file_size: int | None
    page_count: int | None
    reading_status: str
    rating: int | None
    is_favorite: bool
    summary: str | None
    metadata_enriched: bool
    metadata_source: str
    open_library_id: str | None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class BookListResponse(BaseModel):
    items: list[BookResponse]
    total: int
    page: int
    page_size: int
