import asyncio
import os
from pathlib import Path
from typing import Callable, Optional
from uuid import UUID
from sqlalchemy.orm import Session

from app.models import Book
from app.services.enrichment import MetadataEnrichmentService
from app.services.parser.registry import ParserRegistry
from app.schemas.book import BookCreate


class ImportService:
    def __init__(self, db: Session, on_progress: Optional[Callable] = None):
        self.db = db
        self.parser_registry = ParserRegistry()
        self.on_progress = on_progress

    def scan_directory(self, directory: str) -> list[str]:
        """Scan a directory for supported book files."""
        supported = set(self.parser_registry.supported_extensions())
        files = []
        for root, _, filenames in os.walk(directory):
            for filename in filenames:
                if Path(filename).suffix.lower() in supported:
                    files.append(os.path.join(root, filename))
        return files

    def import_file(self, file_path: str) -> Optional[Book]:
        """Import a single file."""
        parsed = self.parser_registry.parse(file_path)
        if parsed is None:
            return None

        file_stat = os.stat(file_path)
        book_data = BookCreate(
            title=parsed.metadata.get("title", Path(file_path).stem),
            author=parsed.metadata.get("author", ""),
            isbn=parsed.metadata.get("isbn", ""),
            publisher=parsed.metadata.get("publisher", ""),
            file_path=file_path,
            file_format=Path(file_path).suffix.lower().lstrip("."),
        )

        book = Book(
            **book_data.model_dump(),
            file_size=file_stat.st_size,
            page_count=parsed.page_count,
            summary="",  # Will be filled by AI later
        )

        self.db.add(book)
        self.db.commit()
        self.db.refresh(book)

        # Save cover image if available
        if parsed.cover_image:
            cover_dir = Path("data/covers")
            cover_dir.mkdir(parents=True, exist_ok=True)
            cover_path = cover_dir / f"{book.id}.png"
            cover_path.write_bytes(parsed.cover_image)
            book.cover_url = str(cover_path)
            self.db.commit()

        return book

    async def import_file_enriched(self, file_path: str) -> Optional[Book]:
        """Import a single file and enrich metadata from external APIs."""
        book = self.import_file(file_path)
        if book:
            enricher = MetadataEnrichmentService()
            await enricher.enrich(self.db, book)
        return book

    async def import_batch(self, file_paths: list[str]) -> list[Book]:
        """Import multiple files with progress reporting."""
        results = []
        for i, file_path in enumerate(file_paths):
            try:
                book = self.import_file(file_path)
                if book:
                    results.append(book)
                if self.on_progress:
                    self.on_progress(i + 1, len(file_paths), file_path, None)
            except Exception as e:
                if self.on_progress:
                    self.on_progress(i + 1, len(file_paths), file_path, str(e))
        return results
