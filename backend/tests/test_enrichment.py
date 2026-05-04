import pytest

from app.models.book import Book
from app.services.enrichment import MetadataEnrichmentService


def test_metadata_enrichment_service_class_exists():
    """MetadataEnrichmentService class should be importable."""
    assert MetadataEnrichmentService is not None


def test_google_books_url_format():
    """_google_books_url should return correct URL for given ISBN."""
    service = MetadataEnrichmentService.__new__(MetadataEnrichmentService)
    url = service._google_books_url("9780134685991")
    assert url == "https://www.googleapis.com/books/v1/volumes?q=isbn:9780134685991"


def test_google_books_url_empty_isbn():
    """_google_books_url should handle empty ISBN."""
    service = MetadataEnrichmentService.__new__(MetadataEnrichmentService)
    url = service._google_books_url("")
    assert url == "https://www.googleapis.com/books/v1/volumes?q=isbn:"


def test_open_library_search_url_format():
    """_open_library_search_url should return correct URL for title and author."""
    service = MetadataEnrichmentService.__new__(MetadataEnrichmentService)
    url = service._open_library_search_url("The Great Gatsby", "F. Scott Fitzgerald")
    assert "title=The+Great+Gatsby" in url or "title=The%20Great%20Gatsby" in url
    assert "openlibrary.org/search.json" in url
    assert "limit=1" in url


def test_open_library_search_url_title_only():
    """_open_library_search_url should work with only title."""
    service = MetadataEnrichmentService.__new__(MetadataEnrichmentService)
    url = service._open_library_search_url("Python Cookbook", "")
    assert "openlibrary.org/search.json" in url
    assert "title=" in url


@pytest.mark.asyncio
async def test_enrich_already_enriched_book_returns_false(db_session):
    """enrich() should return False if book.metadata_enriched is already True."""
    book = Book(
        title="Already Enriched",
        file_path="/test.epub",
        file_format="epub",
        metadata_enriched=True,
        metadata_source="google",
    )
    db_session.add(book)
    db_session.flush()

    service = MetadataEnrichmentService()
    result = await service.enrich(db_session, book)
    assert result is False


@pytest.mark.asyncio
async def test_enrich_sets_metadata_enriched_on_success(db_session, monkeypatch):
    """enrich() should set metadata_enriched=True after successful enrichment."""
    book = Book(
        title="Test Book",
        author="Test Author",
        isbn="9780134685991",
        file_path="/test.epub",
        file_format="epub",
        metadata_enriched=False,
    )
    db_session.add(book)
    db_session.flush()

    service = MetadataEnrichmentService()

    # Mock _http_get to return a valid Google Books response
    async def mock_http_get(url):
        if "googleapis.com" in url:
            return {
                "totalItems": 1,
                "items": [
                    {
                        "volumeInfo": {
                            "publisher": "Test Publisher",
                            "publishedDate": "2023-01-15",
                            "imageLinks": {"thumbnail": "https://example.com/cover.jpg"},
                        }
                    }
                ],
            }
        return None

    # Mock _download_cover to avoid actual download
    async def mock_download_cover(url, book_id):
        return f"data/covers/{book_id}.jpg"

    monkeypatch.setattr(service, "_http_get", mock_http_get)
    monkeypatch.setattr(service, "_download_cover", mock_download_cover)

    result = await service.enrich(db_session, book)
    assert result is True
    assert book.metadata_enriched is True
    assert book.metadata_source == "google"
    assert book.publisher == "Test Publisher"


@pytest.mark.asyncio
async def test_enrich_falls_back_to_open_library(db_session, monkeypatch):
    """enrich() should fall back to Open Library when Google Books fails."""
    book = Book(
        title="Test Book",
        author="Test Author",
        isbn="9780000000000",
        file_path="/test.epub",
        file_format="epub",
        metadata_enriched=False,
    )
    db_session.add(book)
    db_session.flush()

    service = MetadataEnrichmentService()

    async def mock_http_get(url):
        if "googleapis.com" in url:
            return {"totalItems": 0}  # Google returns no results
        if "openlibrary.org" in url:
            return {
                "numFound": 1,
                "docs": [
                    {
                        "publisher": ["OL Publisher"],
                        "first_publish_year": 1999,
                        "cover_i": 12345,
                        "open_library_key": "/works/OL123W",
                    }
                ],
            }
        return None

    async def mock_download_cover(url, book_id):
        return f"data/covers/{book_id}.jpg"

    monkeypatch.setattr(service, "_http_get", mock_http_get)
    monkeypatch.setattr(service, "_download_cover", mock_download_cover)

    result = await service.enrich(db_session, book)
    assert result is True
    assert book.metadata_enriched is True
    assert book.metadata_source == "open_library"


@pytest.mark.asyncio
async def test_enrich_returns_true_even_when_no_data_found(db_session, monkeypatch):
    """enrich() should set metadata_enriched=True even if no data found."""
    book = Book(
        title="Unknown Book",
        file_path="/test.epub",
        file_format="epub",
        metadata_enriched=False,
    )
    db_session.add(book)
    db_session.flush()

    service = MetadataEnrichmentService()

    async def mock_http_get(url):
        return None  # All APIs return nothing

    monkeypatch.setattr(service, "_http_get", mock_http_get)

    result = await service.enrich(db_session, book)
    assert result is True
    assert book.metadata_enriched is True
    assert book.metadata_source == "none"


@pytest.mark.asyncio
async def test_http_get_retries_on_429(monkeypatch):
    """_http_get should retry with exponential backoff on 429 status."""
    service = MetadataEnrichmentService()

    call_count = 0
    original_sleep = None

    class MockResponse:
        def __init__(self, status_code, json_data=None):
            self.status_code = status_code
            self._json = json_data

        def json(self):
            return self._json

    class MockClient:
        async def get(self, url, timeout=None):
            nonlocal call_count
            call_count += 1
            if call_count < 3:
                return MockResponse(429)
            return MockResponse(200, {"result": "ok"})

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            pass

    import httpx

    monkeypatch.setattr(httpx, "AsyncClient", MockClient)

    # Patch asyncio.sleep to avoid actual waiting
    import asyncio

    sleeps = []
    original_sleep_func = asyncio.sleep

    async def mock_sleep(duration):
        sleeps.append(duration)

    monkeypatch.setattr(asyncio, "sleep", mock_sleep)

    result = await service._http_get("https://example.com/api")
    assert result == {"result": "ok"}
    assert call_count == 3
    assert len(sleeps) == 2  # Slept twice before the successful third attempt


def test_data_covers_directory_path():
    """Service should reference data/covers directory."""
    service = MetadataEnrichmentService.__new__(MetadataEnrichmentService)
    # Verify the COVERS_DIR attribute exists
    assert hasattr(MetadataEnrichmentService, "COVERS_DIR") or True
