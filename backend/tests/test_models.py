import pytest
from app.models import Book, Tag, Bookshelf, Passage, Annotation, KnowledgeCard


def test_book_model_exists():
    assert Book.__tablename__ == "books"


def test_tag_model_exists():
    assert Tag.__tablename__ == "tags"


def test_bookshelf_model_exists():
    assert Bookshelf.__tablename__ == "bookshelves"


def test_passage_model_exists():
    assert Passage.__tablename__ == "passages"


def test_annotation_model_exists():
    assert Annotation.__tablename__ == "annotations"


def test_knowledge_card_model_exists():
    assert KnowledgeCard.__tablename__ == "knowledge_cards"
