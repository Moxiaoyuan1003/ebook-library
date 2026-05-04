from uuid import uuid4

import pytest

from app.schemas.search import (
    CrossBookPassage,
    CrossBookQuery,
    CrossBookResponse,
    CrossBookSource,
)


class TestCrossBookQuerySchema:
    def test_valid_query(self):
        query = CrossBookQuery(query="machine learning")
        assert query.query == "machine learning"
        assert query.top_k == 20  # default

    def test_custom_top_k(self):
        query = CrossBookQuery(query="AI ethics", top_k=50)
        assert query.top_k == 50

    def test_query_too_short(self):
        with pytest.raises(Exception):
            CrossBookQuery(query="")

    def test_query_too_long(self):
        with pytest.raises(Exception):
            CrossBookQuery(query="x" * 501)

    def test_top_k_below_minimum(self):
        with pytest.raises(Exception):
            CrossBookQuery(query="test", top_k=0)

    def test_top_k_above_maximum(self):
        with pytest.raises(Exception):
            CrossBookQuery(query="test", top_k=101)


class TestCrossBookPassageSchema:
    def test_valid_passage(self):
        passage = CrossBookPassage(
            content="Some passage text",
            score=0.95,
            page_number=42,
        )
        assert passage.content == "Some passage text"
        assert passage.score == 0.95
        assert passage.page_number == 42

    def test_passage_without_page(self):
        passage = CrossBookPassage(
            content="Text",
            score=0.5,
        )
        assert passage.page_number is None


class TestCrossBookSourceSchema:
    def test_valid_source(self):
        book_id = uuid4()
        source = CrossBookSource(
            book_id=book_id,
            book_title="Deep Learning",
            passages=[
                CrossBookPassage(content="p1", score=0.9),
                CrossBookPassage(content="p2", score=0.8, page_number=10),
            ],
        )
        assert source.book_id == book_id
        assert source.book_title == "Deep Learning"
        assert len(source.passages) == 2

    def test_empty_passages(self):
        source = CrossBookSource(
            book_id=uuid4(),
            book_title="Empty Book",
            passages=[],
        )
        assert source.passages == []


class TestCrossBookResponseSchema:
    def test_valid_response(self):
        book_id = uuid4()
        response = CrossBookResponse(
            answer="AI is a field of computer science.",
            sources=[
                CrossBookSource(
                    book_id=book_id,
                    book_title="AI Textbook",
                    passages=[
                        CrossBookPassage(content="AI is...", score=0.9, page_number=1),
                    ],
                ),
            ],
            query="What is AI?",
        )
        assert response.answer == "AI is a field of computer science."
        assert len(response.sources) == 1
        assert response.query == "What is AI?"

    def test_empty_sources(self):
        response = CrossBookResponse(
            answer="No results found.",
            sources=[],
            query="unknown topic",
        )
        assert response.sources == []
