from uuid import UUID

from pydantic import BaseModel, Field


class TagCreate(BaseModel):
    name: str = Field(..., max_length=100)
    color: str | None = Field("#1677ff", pattern=r"^#[0-9a-fA-F]{6}$")


class TagUpdate(BaseModel):
    name: str | None = Field(None, max_length=100)
    color: str | None = Field(None, pattern=r"^#[0-9a-fA-F]{6}$")


class TagResponse(BaseModel):
    id: UUID
    name: str
    color: str

    class Config:
        from_attributes = True
