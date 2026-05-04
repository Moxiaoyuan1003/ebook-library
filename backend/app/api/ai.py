from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.config import settings
from app.schemas.ai import SummaryRequest, SummaryResponse, ChatRequest, ChatResponse, ChatMessage
from app.services.ai.base import AIServiceInterface
from app.services.ai.factory import AIServiceFactory, AIServiceUnavailableError
from app.services.network_checker import NetworkChecker

router = APIRouter()

# Module-level singletons
_network_checker = NetworkChecker()


def _get_ai_factory() -> AIServiceFactory:
    """Create an AIServiceFactory wired to the current settings."""
    return AIServiceFactory(settings=settings, network_checker=_network_checker)


@router.get("/config")
def get_ai_config():
    return {
        "provider": settings.AI_PROVIDER,
        "has_openai_key": bool(settings.OPENAI_API_KEY),
        "has_claude_key": bool(settings.CLAUDE_API_KEY),
        "ollama_url": settings.OLLAMA_BASE_URL,
    }


@router.get("/status")
async def ai_status():
    """Return current network state and which AI provider would be used."""
    online = await _network_checker.is_online()
    provider = settings.AI_PROVIDER

    if online:
        available = provider  # configured cloud provider is reachable
    else:
        # Check if Ollama is reachable
        factory = _get_ai_factory()
        try:
            _, resolved_provider = await factory.get_service()
            available = resolved_provider
        except AIServiceUnavailableError:
            available = None

    return {
        "provider": provider,
        "online": online,
        "available": available,
    }


@router.post("/summary", response_model=SummaryResponse)
async def generate_summary(
    request: SummaryRequest,
    db: Session = Depends(get_db),
):
    from app.models import Book
    book = db.query(Book).filter(Book.id == request.book_id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    if book.summary and not request.force_regenerate:
        return SummaryResponse(book_id=book.id, summary=book.summary, tags=[])

    factory = _get_ai_factory()
    try:
        ai_service, _ = await factory.get_service()
    except AIServiceUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc))

    # Read book content for AI processing
    from app.services.parser.registry import ParserRegistry
    parser = ParserRegistry()
    parsed = parser.parse(book.file_path)

    if not parsed:
        raise HTTPException(status_code=400, detail="Could not parse book file")

    summary = await ai_service.generate_summary(parsed.full_text)
    tags = await ai_service.generate_tags(parsed.full_text)

    book.summary = summary
    db.commit()

    return SummaryResponse(book_id=book.id, summary=summary, tags=tags)


@router.post("/chat", response_model=ChatResponse)
async def chat_with_ai(
    request: ChatRequest,
):
    factory = _get_ai_factory()
    try:
        ai_service, _ = await factory.get_service()
    except AIServiceUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc))

    context = "\n\n".join(request.context_passages) if request.context_passages else None

    response_text = await ai_service.chat(
        messages=[{"role": m.role, "content": m.content} for m in request.messages],
        context=context,
    )

    return ChatResponse(
        message=ChatMessage(role="assistant", content=response_text),
        sources=[],
    )
