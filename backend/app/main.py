from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import ai, annotations, books, bookshelves, export, knowledge_cards, search, system, tags, ws
from app.core.config import settings

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(books.router, prefix="/api/books", tags=["books"])
app.include_router(tags.router, prefix="/api/tags", tags=["tags"])
app.include_router(bookshelves.router, prefix="/api/bookshelves", tags=["bookshelves"])
app.include_router(search.router, prefix="/api/search", tags=["search"])
app.include_router(ai.router, prefix="/api/ai", tags=["ai"])
app.include_router(annotations.router, prefix="/api/annotations", tags=["annotations"])
app.include_router(ws.router, prefix="/ws", tags=["websocket"])
app.include_router(knowledge_cards.router, prefix="/api/knowledge-cards", tags=["knowledge-cards"])
app.include_router(system.router, prefix="/api/system", tags=["system"])
app.include_router(export.router, prefix="/api/export", tags=["export"])


@app.get("/api/health")
async def health_check():
    return {"status": "ok", "version": settings.APP_VERSION}


if __name__ == "__main__":
    from app.core.cli import main
    main()
