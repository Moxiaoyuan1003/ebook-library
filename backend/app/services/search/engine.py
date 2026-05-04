from uuid import UUID

from sqlalchemy.orm import Session

from app.models import Book, Passage
from app.schemas.search import CrossBookPassage, CrossBookSource, SearchResult


def _is_postgres(db: Session) -> bool:
    """Check if the session is connected to PostgreSQL."""
    return db.bind.dialect.name == "postgresql"


class SearchEngine:
    """Hybrid search engine with keyword and semantic search."""

    def __init__(self, db: Session, ai_service=None):
        self.db = db
        self.ai_service = ai_service

    async def search(
        self,
        query: str,
        search_type: str = "keyword",
        top_k: int = 10,
    ) -> list[SearchResult]:
        if search_type == "semantic":
            return await self._semantic_search(query, top_k)
        return self._keyword_search(query, top_k)

    def _keyword_search(self, query: str, top_k: int) -> list[SearchResult]:
        """PostgreSQL full-text search on book titles and authors."""
        results = (
            self.db.query(Book)
            .filter(Book.title.ilike(f"%{query}%") | Book.author.ilike(f"%{query}%") | Book.isbn.ilike(f"%{query}%"))
            .limit(top_k)
            .all()
        )

        return [
            SearchResult(
                book_id=book.id,
                book_title=book.title,
                chapter=None,
                page_number=None,
                content=book.summary or "",
                score=1.0,
            )
            for book in results
        ]

    def _content_keyword_search(self, query: str, top_k: int) -> list[SearchResult]:
        """Fallback text search on passage content (used when pgvector unavailable)."""
        results = self.db.query(Passage).filter(Passage.content.ilike(f"%{query}%")).limit(top_k).all()

        search_results = []
        for passage in results:
            book = self.db.query(Book).filter(Book.id == passage.book_id).first()
            if book:
                search_results.append(
                    SearchResult(
                        book_id=book.id,
                        book_title=book.title,
                        chapter=passage.chapter,
                        page_number=passage.page_number,
                        content=passage.content,
                        score=0.5,
                    )
                )

        return search_results

    async def _semantic_search(self, query: str, top_k: int) -> list[SearchResult]:
        """Vector similarity search using pgvector.

        Falls back to content keyword search on non-PostgreSQL databases.
        """
        if not _is_postgres(self.db):
            return self._content_keyword_search(query, top_k)

        if not self.ai_service:
            raise ValueError("AI service required for semantic search")

        query_embedding = await self.ai_service.get_embedding(query)

        # Use pgvector cosine similarity
        results = self.db.query(Passage).order_by(Passage.embedding.cosine_distance(query_embedding)).limit(top_k).all()

        search_results = []
        for passage in results:
            book = self.db.query(Book).filter(Book.id == passage.book_id).first()
            if book:
                search_results.append(
                    SearchResult(
                        book_id=book.id,
                        book_title=book.title,
                        chapter=passage.chapter,
                        page_number=passage.page_number,
                        content=passage.content,
                        score=0.0,  # pgvector doesn't return score directly
                    )
                )

        return search_results

    async def index_book(self, book_id: UUID, full_text: str, chapters: list[dict]) -> int:
        """Index a book's content for semantic search."""
        if not self.ai_service:
            raise ValueError("AI service required for indexing")

        # Delete existing passages for this book
        self.db.query(Passage).filter(Passage.book_id == book_id).delete()

        # Split text into chunks
        chunk_size = 2000
        overlap = 200
        chunks = []
        for i in range(0, len(full_text), chunk_size - overlap):
            chunk = full_text[i : i + chunk_size]
            if chunk.strip():
                chunks.append(chunk)

        is_pg = _is_postgres(self.db)

        # Generate embeddings and store passages
        indexed = 0
        for i, chunk in enumerate(chunks):
            try:
                embedding = await self.ai_service.get_embedding(chunk)

                # Find which chapter this chunk belongs to
                chapter_name = None
                page_num = None
                char_pos = 0
                for ch in chapters:
                    ch_content = ch.get("content", "")
                    if char_pos <= i < char_pos + len(ch_content):
                        chapter_name = ch.get("title")
                        page_num = ch.get("page_start")
                        break
                    char_pos += len(ch_content)

                # On PostgreSQL, store embedding as vector;
                # on SQLite, store as JSON list
                stored_embedding = embedding if is_pg else list(embedding) if embedding else None

                passage = Passage(
                    book_id=book_id,
                    chapter=chapter_name,
                    page_number=page_num,
                    content=chunk,
                    embedding=stored_embedding,
                )
                self.db.add(passage)
                indexed += 1
            except Exception:
                continue

        self.db.commit()
        return indexed

    async def cross_book_query(self, query: str, top_k: int = 20) -> tuple[str, list[CrossBookSource]]:
        """Search across books and synthesize an AI answer with citations."""
        if not self.ai_service:
            raise ValueError("AI service required for cross-book query")

        # Get semantic search results
        results = await self._semantic_search(query, top_k)

        # Group by book_id, keep top 3 passages per book
        from collections import defaultdict

        book_passages: dict[UUID, list[SearchResult]] = defaultdict(list)
        for result in results:
            if len(book_passages[result.book_id]) < 3:
                book_passages[result.book_id].append(result)

        # Build sources
        sources = []
        for book_id, passages in book_passages.items():
            cross_passages = [
                CrossBookPassage(
                    page_number=p.page_number,
                    content=p.content,
                    score=p.score,
                )
                for p in passages
            ]
            sources.append(
                CrossBookSource(
                    book_id=book_id,
                    book_title=passages[0].book_title,
                    passages=cross_passages,
                )
            )

        # Build context string for AI
        context_parts = []
        for source in sources:
            for passage in source.passages:
                page_info = f", Page {passage.page_number}" if passage.page_number else ""
                context_parts.append(f"[{source.book_title}{page_info}]: {passage.content}")
        context = "\n\n".join(context_parts)

        # Get AI-synthesized answer
        answer = await self.ai_service.chat(
            messages=[{"role": "user", "content": query}],
            context=context,
        )

        return answer, sources
