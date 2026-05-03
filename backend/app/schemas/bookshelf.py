from pydantic import BaseModel, Field
from typing import Optional
from uuid import UUID


class BookshelfCreate(BaseModel):
    name: str = Field(..., max_length=200)
    description: Optional[str] = None
    sort_order: Optional[int] = 0


class BookshelfUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=200)
    description: Optional[str] = None
    sort_order: Optional[int] = None


class BookshelfResponse(BaseModel):
    id: UUID
    name: str
    description: Optional[str]
    sort_order: int

    class Config:
        from_attributes = True
