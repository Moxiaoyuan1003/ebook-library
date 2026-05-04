from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.search import SearchQuery, SearchResponse, CrossBookQuery, CrossBookResponse
from app.services.search.engine import SearchEngine
from app.api.ai import _get_ai_factory

router = APIRouter()


@router.post("/", response_model=SearchResponse)
async def search(
    query: SearchQuery,
    db: Session = Depends(get_db),
):
    ai_service = None
    if query.search_type == "semantic":
        from app.services.ai.factory import AIServiceUnavailableError
        factory = _get_ai_factory()
        try:
            ai_service, _ = await factory.get_service()
        except AIServiceUnavailableError:
            pass  # proceed without AI service
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


@router.post("/cross-book", response_model=CrossBookResponse)
async def cross_book_query(
    query: CrossBookQuery,
    db: Session = Depends(get_db),
):
    from app.services.ai.factory import AIServiceUnavailableError
    factory = _get_ai_factory()
    try:
        ai_service, _ = await factory.get_service()
    except AIServiceUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc))

    engine = SearchEngine(db, ai_service)
    answer, sources = await engine.cross_book_query(
        query=query.query,
        top_k=query.top_k,
    )

    return CrossBookResponse(
        answer=answer,
        sources=sources,
        query=query.query,
    )
