from uuid import UUID

from pydantic import BaseModel, Field


class SearchQuery(BaseModel):
    query: str = Field(..., min_length=1, max_length=500)
    search_type: str = Field("keyword", pattern="^(keyword|semantic)$")
    top_k: int = Field(10, ge=1, le=100)


class SearchResult(BaseModel):
    book_id: UUID
    book_title: str
    chapter: str | None
    page_number: int | None
    content: str
    score: float


class SearchResponse(BaseModel):
    results: list[SearchResult]
    total: int
    query: str
    search_type: str


class CrossBookQuery(BaseModel):
    query: str = Field(..., min_length=1, max_length=500)
    top_k: int = Field(20, ge=1, le=100)


class CrossBookPassage(BaseModel):
    page_number: int | None = None
    content: str
    score: float


class CrossBookSource(BaseModel):
    book_id: UUID
    book_title: str
    passages: list[CrossBookPassage]


class CrossBookResponse(BaseModel):
    answer: str
    sources: list[CrossBookSource]
    query: str
