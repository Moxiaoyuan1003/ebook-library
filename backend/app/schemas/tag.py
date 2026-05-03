from pydantic import BaseModel, Field
from typing import Optional
from uuid import UUID


class TagCreate(BaseModel):
    name: str = Field(..., max_length=100)
    color: Optional[str] = Field("#1677ff", pattern=r"^#[0-9a-fA-F]{6}$")


class TagUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=100)
    color: Optional[str] = Field(None, pattern=r"^#[0-9a-fA-F]{6}$")


class TagResponse(BaseModel):
    id: UUID
    name: str
    color: str

    class Config:
        from_attributes = True
