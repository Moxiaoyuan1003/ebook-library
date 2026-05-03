import pytest
from app.services.parser.base import ParsedBook, BaseParser
from app.services.parser.registry import ParserRegistry


def test_parsed_book_structure():
    book = ParsedBook(
        metadata={"title": "Test"},
        chapters=[{"title": "Ch1", "content": "Hello", "page_start": 1, "page_end": 1}],
        full_text="Hello",
        page_count=1,
    )
    assert book.metadata["title"] == "Test"
    assert len(book.chapters) == 1


def test_parser_registry_returns_none_for_unknown():
    registry = ParserRegistry()
    parser = registry.get_parser(".xyz")
    assert parser is None


def test_parser_registry_returns_parser_for_pdf():
    registry = ParserRegistry()
    parser = registry.get_parser(".pdf")
    assert parser is not None
