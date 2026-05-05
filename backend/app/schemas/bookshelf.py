from uuid import UUID

from pydantic import BaseModel, Field


class BookshelfCreate(BaseModel):
    name: str = Field(..., max_length=200)
    description: str | None = None
    sort_order: int | None = 0
    rules: dict | None = None


class BookshelfUpdate(BaseModel):
    name: str | None = Field(None, max_length=200)
    description: str | None = None
    sort_order: int | None = None
    rules: dict | None = None


class BookshelfResponse(BaseModel):
    id: UUID
    name: str
    description: str | None
    sort_order: int
    rules: dict | None = None

    class Config:
        from_attributes = True
