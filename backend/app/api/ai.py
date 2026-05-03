from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.config import settings
from app.schemas.ai import SummaryRequest, SummaryResponse, ChatRequest, ChatResponse, ChatMessage
from app.services.ai.openai_adapter import OpenAIAdapter
from app.services.ai.claude_adapter import ClaudeAdapter
from app.services.ai.ollama_adapter import OllamaAdapter
from app.services.ai.base import AIServiceInterface

router = APIRouter()


def get_ai_service() -> AIServiceInterface:
    """Get the configured AI service."""
    provider = settings.AI_PROVIDER
    if provider == "openai":
        return OpenAIAdapter(api_key=settings.OPENAI_API_KEY, base_url=settings.OPENAI_BASE_URL)
    elif provider == "claude":
        return ClaudeAdapter(api_key=settings.CLAUDE_API_KEY)
    elif provider == "ollama":
        return OllamaAdapter(base_url=settings.OLLAMA_BASE_URL)
    else:
        raise ValueError(f"Unknown AI provider: {provider}")


@router.get("/config")
def get_ai_config():
    return {
        "provider": settings.AI_PROVIDER,
        "has_openai_key": bool(settings.OPENAI_API_KEY),
        "has_claude_key": bool(settings.CLAUDE_API_KEY),
        "ollama_url": settings.OLLAMA_BASE_URL,
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

    ai_service = get_ai_service()

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
    ai_service = get_ai_service()
    context = "\n\n".join(request.context_passages) if request.context_passages else None

    response_text = await ai_service.chat(
        messages=[{"role": m.role, "content": m.content} for m in request.messages],
        context=context,
    )

    return ChatResponse(
        message=ChatMessage(role="assistant", content=response_text),
        sources=[],
    )
