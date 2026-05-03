from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.search import SearchQuery, SearchResponse
from app.services.search.engine import SearchEngine
from app.api.ai import get_ai_service

router = APIRouter()


@router.post("/", response_model=SearchResponse)
async def search(
    query: SearchQuery,
    db: Session = Depends(get_db),
):
    ai_service = get_ai_service() if query.search_type == "semantic" else None
    engine = SearchEngine(db, ai_service)

    results = await engine.search(
        query=query.query,
        search_type=query.search_type,
        top_k=query.top_k,
    )

    return SearchResponse(
        results=results,
        total=len(results),
        query=query.query,
        search_type=query.search_type,
    )
