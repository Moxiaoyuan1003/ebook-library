import asyncio
import logging
import re
from pathlib import Path
from typing import Any
from urllib.parse import quote_plus

import httpx
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.book import Book

logger = logging.getLogger(__name__)

_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept-Language": "zh-CN,zh;q=0.9",
}


class MetadataEnrichmentService:
    """Enriches book metadata and covers from multiple sources (China-first)."""

    @property
    def COVERS_DIR(self) -> Path:
        return Path(settings.get_covers_dir())

    # ── HTTP helpers ──

    async def _http_get_json(self, url: str, timeout: float = 10.0) -> dict[str, Any] | None:
        try:
            async with httpx.AsyncClient(follow_redirects=True, headers=_HEADERS) as client:
                r = await client.get(url, timeout=timeout)
                if r.status_code == 200:
                    return r.json()
        except Exception:
            pass
        return None

    async def _http_get_text(self, url: str, timeout: float = 10.0) -> str | None:
        try:
            async with httpx.AsyncClient(follow_redirects=True, headers=_HEADERS) as client:
                r = await client.get(url, timeout=timeout)
                if r.status_code == 200:
                    return r.text
        except Exception:
            pass
        return None

    async def _http_get_bytes(self, url: str, timeout: float = 15.0) -> bytes | None:
        try:
            async with httpx.AsyncClient(follow_redirects=True, headers=_HEADERS) as client:
                r = await client.get(url, timeout=timeout)
                if r.status_code == 200 and len(r.content) > 1000:
                    return r.content
        except Exception:
            pass
        return None

    async def _download_cover(self, url: str, book_id) -> str | None:
        data = await self._http_get_bytes(url, timeout=15.0)
        if not data:
            return None
        try:
            self.COVERS_DIR.mkdir(parents=True, exist_ok=True)
            ext = "jpg"
            url_lower = url.lower()
            if ".png" in url_lower:
                ext = "png"
            elif ".webp" in url_lower:
                ext = "webp"
            cover_path = self.COVERS_DIR / f"{book_id}.{ext}"
            cover_path.write_bytes(data)
            logger.info("Downloaded cover for book %s", book_id)
            return f"{book_id}.{ext}"
        except Exception as exc:
            logger.error("Error saving cover for %s: %s", book_id, exc)
            return None

    # ── Local file extraction ──

    def _extract_cover_from_file(self, book: Book) -> str | None:
        try:
            if not book.file_path or not Path(book.file_path).exists():
                return None
            from app.services.parser.registry import ParserRegistry
            parsed = ParserRegistry().parse(book.file_path)
            if parsed and parsed.cover_image and len(parsed.cover_image) > 1000:
                self.COVERS_DIR.mkdir(parents=True, exist_ok=True)
                cover_path = self.COVERS_DIR / f"{book.id}.png"
                cover_path.write_bytes(parsed.cover_image)
                logger.info("Extracted cover from file for book %s", book.id)
                return f"{book.id}.png"
        except Exception as exc:
            logger.warning("File cover extraction failed for %s: %s", book.title, exc)
        return None

    # ── Douban (primary online source, works in China) ──

    async def _cover_from_douban(self, title: str, author: str, book_id) -> str | None:
        """Search Douban for book cover by ISBN or title+author."""
        # Try ISBN first if available
        for query in [f"{title} {author}".strip(), title]:
            if not query:
                continue
            html = await self._http_get_text(
                f"https://www.douban.com/search?cat=1001&q={quote_plus(query)}",
                timeout=10.0,
            )
            if not html:
                continue
            # Extract cover image URLs from search results
            imgs = re.findall(
                r'src="(https?://[^"]*?doubanio[^"]*?subject[^"]*?\.(?:jpg|png|webp))"',
                html,
            )
            if imgs:
                # Get large version
                cover_url = imgs[0].replace("/s/public/", "/l/public/")
                result = await self._download_cover(cover_url, book_id)
                if result:
                    return result
        return None

    # ── Google Books (fallback, may not work in China) ──

    async def _cover_from_google_books(self, isbn: str, book_id) -> str | None:
        data = await self._http_get_json(
            f"https://www.googleapis.com/books/v1/volumes?q=isbn:{isbn}", timeout=8.0
        )
        if data and data.get("totalItems", 0) > 0:
            il = data["items"][0].get("volumeInfo", {}).get("imageLinks", {})
            thumb = il.get("thumbnail")
            if thumb:
                return await self._download_cover(thumb.replace("http://", "https://"), book_id)
        return None

    # ── Open Library (fallback) ──

    async def _cover_from_open_library(self, title: str, author: str, book_id) -> str | None:
        params = f"title={quote_plus(title)}&limit=1"
        if author and author.strip():
            params += f"&author={quote_plus(author)}"
        data = await self._http_get_json(
            f"https://openlibrary.org/search.json?{params}", timeout=10.0
        )
        if data and data.get("numFound", 0) > 0:
            cover_i = data["docs"][0].get("cover_i")
            if cover_i:
                return await self._download_cover(
                    f"https://covers.openlibrary.org/b/id/{cover_i}-L.jpg", book_id
                )
        return None

    # ── Main enrichment ──

    async def enrich(self, db: Session, book: Book) -> bool:
        if book.metadata_enriched:
            return False

        found_publisher = None
        found_publish_date = None
        source = "none"

        # ── 1. Local file extraction (no network) ──
        if not book.cover_url:
            local = self._extract_cover_from_file(book)
            if local:
                book.cover_url = local
                source = "file"

        # ── 2. Douban (works in China, primary online source) ──
        if not book.cover_url:
            try:
                douban = await self._cover_from_douban(
                    book.title or "", book.author or "", book.id
                )
                if douban:
                    book.cover_url = douban
                    source = "douban"
            except Exception:
                pass

        # ── 3. Google Books (may timeout in China) ──
        if not book.cover_url and book.isbn and book.isbn.strip():
            try:
                gcover = await self._cover_from_google_books(book.isbn, book.id)
                if gcover:
                    book.cover_url = gcover
                    source = "google"
                # Also get metadata
                data = await self._http_get_json(
                    f"https://www.googleapis.com/books/v1/volumes?q=isbn:{book.isbn}", timeout=8.0
                )
                if data and data.get("totalItems", 0) > 0:
                    vi = data["items"][0].get("volumeInfo", {})
                    if not book.publisher:
                        found_publisher = vi.get("publisher")
                    if not book.publish_date:
                        found_publish_date = vi.get("publishedDate")
                    if source == "google" or (not book.cover_url):
                        il = vi.get("imageLinks", {})
                        t = il.get("thumbnail")
                        if t and not book.cover_url:
                            c = await self._download_cover(t.replace("http://", "https://"), book.id)
                            if c:
                                book.cover_url = c
                                source = "google"
            except Exception:
                pass

        # ── 4. Open Library (fallback) ──
        if not book.cover_url:
            try:
                ol = await self._cover_from_open_library(
                    book.title or "", book.author or "", book.id
                )
                if ol:
                    book.cover_url = ol
                    source = "open_library"
            except Exception:
                pass

        # ── Apply metadata ──
        if found_publisher and not book.publisher:
            book.publisher = found_publisher
        if found_publish_date and not book.publish_date:
            try:
                from datetime import datetime
                for fmt in ("%Y-%m-%d", "%Y-%m", "%Y"):
                    try:
                        book.publish_date = datetime.strptime(found_publish_date, fmt)
                        break
                    except ValueError:
                        continue
            except Exception:
                pass

        book.metadata_enriched = True
        book.metadata_source = source
        db.flush()
        return True
