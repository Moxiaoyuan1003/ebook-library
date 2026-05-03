from pydantic import BaseModel, Field
from typing import Optional
from uuid import UUID


class SearchQuery(BaseModel):
    query: str = Field(..., min_length=1, max_length=500)
    search_type: str = Field("keyword", pattern="^(keyword|semantic)$")
    top_k: int = Field(10, ge=1, le=100)


class SearchResult(BaseModel):
    book_id: UUID
    book_title: str
    chapter: Optional[str]
    page_number: Optional[int]
    content: str
    score: float


class SearchResponse(BaseModel):
    results: list[SearchResult]
    total: int
    query: str
    search_type: str
