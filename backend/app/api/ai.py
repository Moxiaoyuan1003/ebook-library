from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.schemas.ai import ChatMessage, ChatRequest, ChatResponse, SummaryRequest, SummaryResponse
from app.schemas.reading_session import ReadingChatRequest, ReadingChatResponse, ReadingSessionResponse
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


@router.post("/config")
def save_ai_config(body: dict):
    import os

    env_path = os.path.join(settings.DATA_DIR or ".", ".env")
    os.makedirs(os.path.dirname(env_path) if os.path.dirname(env_path) else ".", exist_ok=True)

    lines = []
    if os.path.exists(env_path):
        with open(env_path) as f:
            lines = f.readlines()

    def set_env(lines, key, value):
        found = False
        for i, line in enumerate(lines):
            if line.strip().startswith(f"{key}="):
                lines[i] = f"{key}={value}\n"
                found = True
                break
        if not found:
            lines.append(f"{key}={value}\n")
        return lines

    if "provider" in body:
        lines = set_env(lines, "AI_PROVIDER", body["provider"])
        settings.AI_PROVIDER = body["provider"]
    if "openai_api_key" in body:
        lines = set_env(lines, "OPENAI_API_KEY", body["openai_api_key"])
        settings.OPENAI_API_KEY = body["openai_api_key"]
    if "claude_api_key" in body:
        lines = set_env(lines, "CLAUDE_API_KEY", body["claude_api_key"])
        settings.CLAUDE_API_KEY = body["claude_api_key"]
    if "ollama_url" in body:
        lines = set_env(lines, "OLLAMA_BASE_URL", body["ollama_url"])
        settings.OLLAMA_BASE_URL = body["ollama_url"]

    with open(env_path, "w") as f:
        f.writelines(lines)

    return {"status": "ok"}


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


@router.post("/reading-chat", response_model=ReadingChatResponse)
async def reading_chat(
    request: ReadingChatRequest,
    db: Session = Depends(get_db),
):
    from app.models.reading_session import ReadingSession

    # Load or create session
    if request.session_id:
        session = db.query(ReadingSession).filter(ReadingSession.id == request.session_id).first()
        if not session:
            raise HTTPException(status_code=404, detail="Reading session not found")
    else:
        from app.models import Book

        book = db.query(Book).filter(Book.id == request.book_id).first()
        if not book:
            raise HTTPException(status_code=404, detail="Book not found")

        session = ReadingSession(
            book_id=request.book_id,
            messages=[],
            context_passages=request.context_passages,
        )
        db.add(session)
        db.flush()

    # Append user message
    session.messages = session.messages or []
    session.messages.append(
        {
            "role": "user",
            "content": request.message,
            "timestamp": datetime.utcnow().isoformat(),
        }
    )

    # Build context from passages
    context = None
    if request.context_passages:
        context = "\n\n".join(p.get("text", str(p)) for p in request.context_passages)

    # Call AI service
    factory = _get_ai_factory()
    try:
        ai_service, _ = await factory.get_service()
    except AIServiceUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc))

    response_text = await ai_service.chat(
        messages=[{"role": m["role"], "content": m["content"]} for m in session.messages],
        context=context,
    )

    # Append assistant reply
    session.messages.append(
        {
            "role": "assistant",
            "content": response_text,
            "timestamp": datetime.utcnow().isoformat(),
        }
    )

    # Update context passages if provided
    if request.context_passages:
        session.context_passages = request.context_passages

    db.commit()
    db.refresh(session)

    return ReadingChatResponse(reply=response_text, session_id=session.id)


@router.get("/reading-sessions/{book_id}", response_model=list[ReadingSessionResponse])
async def list_reading_sessions(
    book_id: UUID,
    db: Session = Depends(get_db),
):
    from app.models.reading_session import ReadingSession

    sessions = db.query(ReadingSession).filter(ReadingSession.book_id == book_id).all()
    return sessions


@router.delete("/reading-sessions/{session_id}")
async def delete_reading_session(
    session_id: str,
    db: Session = Depends(get_db),
):
    from app.models.reading_session import ReadingSession

    session = db.query(ReadingSession).filter(ReadingSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Reading session not found")
    db.delete(session)
    db.commit()
    return {"status": "deleted"}


@router.post("/recommendations")
async def get_recommendations(db: Session = Depends(get_db)):
    from app.models import Book

    books = db.query(Book).filter(Book.reading_status.in_(["reading", "finished"])).all()
    if not books:
        return {"recommendations": []}

    favorites = [b for b in books if b.is_favorite]
    recent = sorted(books, key=lambda b: b.created_at or datetime.min, reverse=True)[:10]

    book_list = []
    for b in (favorites + recent)[:15]:
        book_list.append(f"- {b.title}" + (f" ({b.author})" if b.author else ""))

    context = "用户最近阅读和收藏的书籍：\n" + "\n".join(book_list)

    factory = _get_ai_factory()
    try:
        ai_service, _ = await factory.get_service()
    except AIServiceUnavailableError:
        return {"recommendations": []}

    prompt = (
        "基于用户阅读偏好，推荐5本可能感兴趣的书。"
        "请严格按以下JSON数组格式返回，不要包含其他文字：\n"
        '[{"title":"书名","author":"作者","reason":"推荐理由"}]'
    )

    try:
        response = await ai_service.chat(
            messages=[{"role": "user", "content": prompt}],
            context=context,
        )
        import json

        # Extract JSON from response
        start = response.find("[")
        end = response.rfind("]") + 1
        if start >= 0 and end > start:
            recommendations = json.loads(response[start:end])
        else:
            recommendations = []
    except Exception:
        recommendations = []

    return {"recommendations": recommendations}
