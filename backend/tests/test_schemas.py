import pytest
from app.schemas.book import BookCreate, BookUpdate, BookResponse
from app.schemas.tag import TagCreate, TagResponse
from app.schemas.bookshelf import BookshelfCreate, BookshelfResponse
from app.schemas.search import SearchQuery, SearchResponse
from app.schemas.ai import SummaryRequest, SummaryResponse


def test_book_create_schema():
    book = BookCreate(title="Test Book", file_path="/test.pdf", file_format="pdf")
    assert book.title == "Test Book"


def test_book_update_schema():
    book = BookUpdate(title="Updated Title")
    assert book.title == "Updated Title"


def test_tag_create_schema():
    tag = TagCreate(name="Programming")
    assert tag.name == "Programming"


def test_bookshelf_create_schema():
    shelf = BookshelfCreate(name="Tech Books")
    assert shelf.name == "Tech Books"


def test_search_query_schema():
    query = SearchQuery(query="machine learning", search_type="semantic")
    assert query.query == "machine learning"


def test_summary_request_schema():
    req = SummaryRequest(book_id="test-id")
    assert req.book_id == "test-id"
