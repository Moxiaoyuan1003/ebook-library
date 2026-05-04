from app.models import Annotation, Book, Bookshelf, KnowledgeCard, Passage, Tag
from app.models.card_link import CardLink
from app.models.reading_progress import ReadingProgress


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


def test_book_has_metadata_enriched_column():
    assert hasattr(Book, "metadata_enriched")
    col = Book.__table__.columns["metadata_enriched"]
    assert col.default.arg is False


def test_book_has_metadata_source_column():
    assert hasattr(Book, "metadata_source")
    col = Book.__table__.columns["metadata_source"]
    assert col.default.arg == "file"


def test_book_has_open_library_id_column():
    assert hasattr(Book, "open_library_id")
    col = Book.__table__.columns["open_library_id"]
    assert col.type.length == 50


def test_knowledge_card_has_card_type_column():
    assert hasattr(KnowledgeCard, "card_type")


def test_knowledge_card_has_tags_column():
    assert hasattr(KnowledgeCard, "tags")


def test_knowledge_card_has_updated_at_column():
    assert hasattr(KnowledgeCard, "updated_at")


def test_card_link_model_exists():
    assert CardLink.__tablename__ == "card_links"


def test_card_link_has_source_card_id():
    assert hasattr(CardLink, "source_card_id")


def test_card_link_has_target_card_id():
    assert hasattr(CardLink, "target_card_id")


def test_card_link_has_link_type():
    assert hasattr(CardLink, "link_type")


def test_card_link_has_relationships():
    assert hasattr(CardLink, "source_card")
    assert hasattr(CardLink, "target_card")


def test_reading_progress_model_exists():
    assert ReadingProgress.__tablename__ == "reading_progress"


def test_reading_progress_has_book_id_unique():
    col = ReadingProgress.__table__.columns["book_id"]
    assert col.unique is True


def test_reading_progress_has_current_page():
    assert hasattr(ReadingProgress, "current_page")


def test_reading_progress_has_current_cfi():
    assert hasattr(ReadingProgress, "current_cfi")


def test_reading_progress_has_progress_percent():
    assert hasattr(ReadingProgress, "progress_percent")


def test_reading_progress_insert(db_session):
    book = Book(
        title="Test Book",
        file_path="/test.epub",
        file_format="epub",
    )
    db_session.add(book)
    db_session.flush()

    progress = ReadingProgress(
        book_id=book.id,
        current_page=42,
        progress_percent=50.5,
    )
    db_session.add(progress)
    db_session.flush()

    assert progress.id is not None
    assert progress.current_page == 42
    assert progress.progress_percent == 50.5


def test_card_link_insert(db_session):
    book = Book(
        title="Test Book",
        file_path="/test.epub",
        file_format="epub",
    )
    db_session.add(book)
    db_session.flush()

    card1 = KnowledgeCard(
        title="Card 1",
        content="Content 1",
        source_book_id=book.id,
        card_type="note",
    )
    card2 = KnowledgeCard(
        title="Card 2",
        content="Content 2",
        source_book_id=book.id,
        card_type="concept",
    )
    db_session.add_all([card1, card2])
    db_session.flush()

    link = CardLink(
        source_card_id=card1.id,
        target_card_id=card2.id,
        link_type="related",
    )
    db_session.add(link)
    db_session.flush()

    assert link.id is not None
    assert link.source_card_id == card1.id
    assert link.target_card_id == card2.id


def test_knowledge_card_new_fields(db_session):
    import json

    book = Book(
        title="Test Book",
        file_path="/test.epub",
        file_format="epub",
    )
    db_session.add(book)
    db_session.flush()

    card = KnowledgeCard(
        title="Test Card",
        content="Test content",
        source_book_id=book.id,
        card_type="quote",
        tags=json.dumps(["python", "testing"]),
    )
    db_session.add(card)
    db_session.flush()

    assert card.card_type == "quote"
    assert card.tags is not None
    assert card.updated_at is not None
