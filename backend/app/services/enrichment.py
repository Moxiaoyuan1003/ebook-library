import asyncio
import logging
from pathlib import Path
from typing import Any
from urllib.parse import quote_plus

import httpx
from sqlalchemy.orm import Session

from app.models.book import Book

logger = logging.getLogger(__name__)

COVERS_DIR = Path("data/covers")


class MetadataEnrichmentService:
    """Enriches book metadata from Google Books and Open Library APIs."""

    COVERS_DIR = COVERS_DIR

    def _google_books_url(self, isbn: str) -> str:
        """Build Google Books API URL for ISBN lookup."""
        return f"https://www.googleapis.com/books/v1/volumes?q=isbn:{isbn}"

    def _open_library_search_url(self, title: str, author: str) -> str:
        """Build Open Library search API URL."""
        params = f"title={quote_plus(title)}&limit=1"
        if author and author.strip():
            params += f"&author={quote_plus(author)}"
        return f"https://openlibrary.org/search.json?{params}"

    async def _http_get(self, url: str) -> dict[str, Any] | None:
        """HTTP GET with retry logic and exponential backoff for 429 responses.

        Max 3 retries total. Doubles the wait time on each 429 retry.
        """
        max_retries = 3
        backoff = 1.0  # initial backoff in seconds

        for attempt in range(max_retries):
            try:
                async with httpx.AsyncClient() as client:
                    response = await client.get(url, timeout=5.0)

                    if response.status_code == 200:
                        return response.json()

                    if response.status_code == 429:
                        if attempt < max_retries - 1:
                            logger.warning(
                                "Rate limited (429) on %s, retrying in %.1fs",
                                url,
                                backoff,
                            )
                            await asyncio.sleep(backoff)
                            backoff *= 2
                            continue
                        else:
                            logger.error("Rate limited (429) on %s after %d retries", url, max_retries)
                            return None

                    logger.warning("HTTP %d from %s", response.status_code, url)
                    return None

            except httpx.TimeoutException:
                logger.warning("Timeout fetching %s (attempt %d/%d)", url, attempt + 1, max_retries)
                if attempt < max_retries - 1:
                    await asyncio.sleep(backoff)
                    backoff *= 2
                    continue
                return None
            except Exception as exc:
                logger.error("Error fetching %s: %s", url, exc)
                return None

        return None

    async def _download_cover(self, url: str, book_id) -> str | None:
        """Download a cover image and save it locally.

        Returns the local file path relative to the project, or None on failure.
        """
        try:
            COVERS_DIR.mkdir(parents=True, exist_ok=True)

            async with httpx.AsyncClient() as client:
                response = await client.get(url, timeout=5.0)
                if response.status_code != 200:
                    logger.warning("Failed to download cover from %s: HTTP %d", url, response.status_code)
                    return None

                content_type = response.headers.get("content-type", "")
                if "jpeg" in content_type or "jpg" in content_type:
                    ext = "jpg"
                elif "png" in content_type:
                    ext = "png"
                elif "webp" in content_type:
                    ext = "webp"
                else:
                    # Default: try to detect from URL or fall back to jpg
                    url_lower = url.lower()
                    if ".png" in url_lower:
                        ext = "png"
                    elif ".webp" in url_lower:
                        ext = "webp"
                    else:
                        ext = "jpg"

                cover_path = COVERS_DIR / f"{book_id}.{ext}"
                cover_path.write_bytes(response.content)
                logger.info("Downloaded cover for book %s to %s", book_id, cover_path)
                return f"{book_id}.{ext}"

        except Exception as exc:
            logger.error("Error downloading cover from %s: %s", url, exc)
            return None

    async def enrich(self, db: Session, book: Book) -> bool:
        """Enrich a book's metadata from external APIs.

        Returns False if the book is already enriched.
        Returns True after attempting enrichment (whether or not new data was found).
        """
        if book.metadata_enriched:
            return False

        found_publisher = None
        found_publish_date = None
        found_cover_url = None
        source = "none"

        # Strategy 1: Google Books by ISBN
        if book.isbn and book.isbn.strip():
            try:
                google_data = await self._http_get(self._google_books_url(book.isbn))
                if google_data and google_data.get("totalItems", 0) > 0:
                    volume_info = google_data["items"][0].get("volumeInfo", {})
                    found_publisher = volume_info.get("publisher")
                    found_publish_date = volume_info.get("publishedDate")
                    image_links = volume_info.get("imageLinks", {})
                    found_cover_url = image_links.get("thumbnail")
                    if found_publisher or found_publish_date or found_cover_url:
                        source = "google"
            except Exception as exc:
                logger.warning("Google Books lookup failed for %s: %s", book.isbn, exc)

        # Strategy 2: Open Library (if no ISBN or Google didn't return enough)
        if source == "none":
            try:
                ol_url = self._open_library_search_url(book.title or "", book.author or "")
                ol_data = await self._http_get(ol_url)
                if ol_data and ol_data.get("numFound", 0) > 0:
                    doc = ol_data["docs"][0]
                    publishers = doc.get("publisher", [])
                    found_publisher = publishers[0] if isinstance(publishers, list) and publishers else None
                    first_year = doc.get("first_publish_year")
                    if first_year:
                        found_publish_date = str(first_year)
                    cover_i = doc.get("cover_i")
                    if cover_i:
                        found_cover_url = f"https://covers.openlibrary.org/b/id/{cover_i}-L.jpg"
                    ol_key = doc.get("open_library_key") or doc.get("key", "")
                    if ol_key:
                        book.open_library_id = ol_key
                    if found_publisher or found_publish_date or found_cover_url:
                        source = "open_library"
            except Exception as exc:
                logger.warning("Open Library lookup failed for %s: %s", book.title, exc)

        # Apply discovered fields only where the book currently lacks data
        if found_publisher and not book.publisher:
            book.publisher = found_publisher
        if found_publish_date and not book.publish_date:
            # publish_date is a DateTime column; store as a date string parsed best-effort
            try:
                from datetime import datetime

                # publishedDate can be "2023", "2023-01", or "2023-01-15"
                for fmt in ("%Y-%m-%d", "%Y-%m", "%Y"):
                    try:
                        book.publish_date = datetime.strptime(found_publish_date, fmt)
                        break
                    except ValueError:
                        continue
            except Exception:
                pass  # If parsing fails, skip setting publish_date

        # Download cover if we got a URL and the book doesn't have a local cover yet
        if found_cover_url and (not book.cover_url):
            local_path = await self._download_cover(found_cover_url, book.id)
            if local_path:
                book.cover_url = local_path
            else:
                # Fall back to storing the remote URL
                book.cover_url = found_cover_url

        book.metadata_enriched = True
        book.metadata_source = source

        db.flush()
        return True
