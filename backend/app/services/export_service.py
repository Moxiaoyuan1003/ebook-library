"""Export service for knowledge cards, annotations, and books."""

import csv
import io
from datetime import datetime

from sqlalchemy.orm import Session

from app.models.annotation import Annotation
from app.models.book import Book
from app.models.knowledge_card import KnowledgeCard


def _apply_card_filters(query, filters: dict):
    """Apply filters to a KnowledgeCard query."""
    if filters.get("book_id"):
        query = query.filter(KnowledgeCard.source_book_id == filters["book_id"])
    if filters.get("date_from"):
        query = query.filter(KnowledgeCard.created_at >= filters["date_from"])
    if filters.get("date_to"):
        query = query.filter(KnowledgeCard.created_at <= filters["date_to"])
    if filters.get("tags"):
        # Filter cards that contain any of the specified tags
        tag = filters["tags"]
        if isinstance(tag, list):
            tag = tag[0] if tag else None
        if tag:
            query = query.filter(KnowledgeCard.tags.contains(tag))
    return query


def _apply_annotation_filters(query, filters: dict):
    """Apply filters to an Annotation query."""
    if filters.get("book_id"):
        query = query.filter(Annotation.book_id == filters["book_id"])
    if filters.get("date_from"):
        query = query.filter(Annotation.created_at >= filters["date_from"])
    if filters.get("date_to"):
        query = query.filter(Annotation.created_at <= filters["date_to"])
    return query


def _apply_book_filters(query, filters: dict):
    """Apply filters to a Book query."""
    if filters.get("date_from"):
        query = query.filter(Book.created_at >= filters["date_from"])
    if filters.get("date_to"):
        query = query.filter(Book.created_at <= filters["date_to"])
    return query


# ── Knowledge Cards ──


def export_cards_md(db: Session, filters: dict) -> tuple[str, bytes]:
    """Export knowledge cards as Markdown."""
    query = db.query(KnowledgeCard)
    query = _apply_card_filters(query, filters)
    cards = query.order_by(KnowledgeCard.created_at.desc()).all()

    lines = ["# Knowledge Cards Export\n"]
    lines.append(f"Exported: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')} UTC\n")
    lines.append(f"Total cards: {len(cards)}\n\n")

    for card in cards:
        lines.append(f"## {card.title}\n\n")
        lines.append(f"- **Type:** {card.card_type}\n")
        if card.tags:
            lines.append(f"- **Tags:** {', '.join(card.tags)}\n")
        if card.source_book_id:
            lines.append(f"- **Source Book ID:** {card.source_book_id}\n")
        lines.append(f"\n{card.content}\n\n")
        if card.annotation:
            lines.append(f"> {card.annotation}\n\n")
        if card.source_passage:
            lines.append(f"**Source Passage:**\n> {card.source_passage}\n\n")
        lines.append("---\n\n")

    return "knowledge_cards.md", "\n".join(lines).encode("utf-8")


def export_cards_csv(db: Session, filters: dict) -> tuple[str, bytes]:
    """Export knowledge cards as CSV."""
    query = db.query(KnowledgeCard)
    query = _apply_card_filters(query, filters)
    cards = query.order_by(KnowledgeCard.created_at.desc()).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(
        [
            "id",
            "title",
            "content",
            "card_type",
            "tags",
            "annotation",
            "source_book_id",
            "source_passage",
            "created_at",
            "updated_at",
        ]
    )

    for card in cards:
        writer.writerow(
            [
                str(card.id),
                card.title,
                card.content,
                card.card_type,
                ",".join(card.tags) if card.tags else "",
                card.annotation or "",
                str(card.source_book_id) if card.source_book_id else "",
                card.source_passage or "",
                card.created_at.isoformat() if card.created_at else "",
                card.updated_at.isoformat() if card.updated_at else "",
            ]
        )

    return "knowledge_cards.csv", output.getvalue().encode("utf-8")


def export_cards_pdf(db: Session, filters: dict) -> tuple[str, bytes]:
    """Export knowledge cards as PDF."""
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import getSampleStyleSheet
        from reportlab.lib.units import cm
        from reportlab.pdfbase import pdfmetrics
        from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer
    except ImportError:
        raise RuntimeError("reportlab is not installed. Install it with: pip install reportlab")

    query = db.query(KnowledgeCard)
    query = _apply_card_filters(query, filters)
    cards = query.order_by(KnowledgeCard.created_at.desc()).all()

    # Try to register a Chinese font
    _register_chinese_font(pdfmetrics)

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4)
    styles = getSampleStyleSheet()
    story = []

    story.append(Paragraph("Knowledge Cards Export", styles["Title"]))
    story.append(Spacer(1, 0.5 * cm))
    story.append(
        Paragraph(
            f"Exported: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')} UTC | Total cards: {len(cards)}",
            styles["Normal"],
        )
    )
    story.append(Spacer(1, 1 * cm))

    for card in cards:
        story.append(Paragraph(card.title, styles["Heading2"]))
        story.append(Paragraph(f"Type: {card.card_type}", styles["Normal"]))
        if card.tags:
            story.append(Paragraph(f"Tags: {', '.join(card.tags)}", styles["Normal"]))
        story.append(Spacer(1, 0.2 * cm))
        # Escape special characters for reportlab
        safe_content = _escape_xml(card.content)
        story.append(Paragraph(safe_content, styles["Normal"]))
        if card.annotation:
            story.append(Spacer(1, 0.2 * cm))
            story.append(Paragraph(f"Annotation: {_escape_xml(card.annotation)}", styles["Normal"]))
        story.append(Spacer(1, 0.5 * cm))

    doc.build(story)
    return "knowledge_cards.pdf", buffer.getvalue()


# ── Annotations ──


def export_annotations_md(db: Session, filters: dict) -> tuple[str, bytes]:
    """Export annotations as Markdown."""
    query = db.query(Annotation)
    query = _apply_annotation_filters(query, filters)
    annotations = query.order_by(Annotation.created_at.desc()).all()

    lines = ["# Annotations Export\n"]
    lines.append(f"Exported: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')} UTC\n")
    lines.append(f"Total annotations: {len(annotations)}\n\n")

    for ann in annotations:
        lines.append(f"## {ann.type} - {str(ann.id)[:8]}\n\n")
        lines.append(f"- **Book ID:** {ann.book_id}\n")
        if ann.page_number is not None:
            lines.append(f"- **Page:** {ann.page_number}\n")
        if ann.color:
            lines.append(f"- **Color:** {ann.color}\n")
        if ann.highlight_color:
            lines.append(f"- **Highlight:** {ann.highlight_color}\n")
        lines.append(f"- **Created:** {ann.created_at}\n\n")
        if ann.selected_text:
            lines.append(f"**Selected Text:**\n> {ann.selected_text}\n\n")
        if ann.note_content:
            lines.append(f"**Note:**\n{ann.note_content}\n\n")
        lines.append("---\n\n")

    return "annotations.md", "\n".join(lines).encode("utf-8")


def export_annotations_csv(db: Session, filters: dict) -> tuple[str, bytes]:
    """Export annotations as CSV."""
    query = db.query(Annotation)
    query = _apply_annotation_filters(query, filters)
    annotations = query.order_by(Annotation.created_at.desc()).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(
        [
            "id",
            "book_id",
            "type",
            "page_number",
            "selected_text",
            "note_content",
            "color",
            "highlight_color",
            "start_cfi",
            "end_cfi",
            "created_at",
        ]
    )

    for ann in annotations:
        writer.writerow(
            [
                str(ann.id),
                str(ann.book_id),
                ann.type,
                ann.page_number if ann.page_number is not None else "",
                ann.selected_text or "",
                ann.note_content or "",
                ann.color or "",
                ann.highlight_color or "",
                ann.start_cfi or "",
                ann.end_cfi or "",
                ann.created_at.isoformat() if ann.created_at else "",
            ]
        )

    return "annotations.csv", output.getvalue().encode("utf-8")


def export_annotations_pdf(db: Session, filters: dict) -> tuple[str, bytes]:
    """Export annotations as PDF."""
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import getSampleStyleSheet
        from reportlab.lib.units import cm
        from reportlab.pdfbase import pdfmetrics
        from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer
    except ImportError:
        raise RuntimeError("reportlab is not installed. Install it with: pip install reportlab")

    query = db.query(Annotation)
    query = _apply_annotation_filters(query, filters)
    annotations = query.order_by(Annotation.created_at.desc()).all()

    _register_chinese_font(pdfmetrics)

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4)
    styles = getSampleStyleSheet()
    story = []

    story.append(Paragraph("Annotations Export", styles["Title"]))
    story.append(Spacer(1, 0.5 * cm))
    story.append(
        Paragraph(
            f"Exported: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')} UTC | Total annotations: {len(annotations)}",
            styles["Normal"],
        )
    )
    story.append(Spacer(1, 1 * cm))

    for ann in annotations:
        story.append(Paragraph(f"{ann.type} - {str(ann.id)[:8]}", styles["Heading2"]))
        story.append(Paragraph(f"Book ID: {ann.book_id}", styles["Normal"]))
        if ann.page_number is not None:
            story.append(Paragraph(f"Page: {ann.page_number}", styles["Normal"]))
        story.append(Spacer(1, 0.2 * cm))
        if ann.selected_text:
            story.append(Paragraph(f"Selected: {_escape_xml(ann.selected_text)}", styles["Normal"]))
        if ann.note_content:
            story.append(Paragraph(f"Note: {_escape_xml(ann.note_content)}", styles["Normal"]))
        story.append(Spacer(1, 0.5 * cm))

    doc.build(story)
    return "annotations.pdf", buffer.getvalue()


# ── Books ──


def export_books_md(db: Session, filters: dict) -> tuple[str, bytes]:
    """Export books as Markdown."""
    query = db.query(Book)
    query = _apply_book_filters(query, filters)
    books = query.order_by(Book.created_at.desc()).all()

    lines = ["# Books Export\n"]
    lines.append(f"Exported: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')} UTC\n")
    lines.append(f"Total books: {len(books)}\n\n")

    for book in books:
        lines.append(f"## {book.title}\n\n")
        if book.author:
            lines.append(f"- **Author:** {book.author}\n")
        if book.isbn:
            lines.append(f"- **ISBN:** {book.isbn}\n")
        if book.publisher:
            lines.append(f"- **Publisher:** {book.publisher}\n")
        lines.append(f"- **Format:** {book.file_format}\n")
        lines.append(f"- **Status:** {book.reading_status}\n")
        if book.rating is not None:
            lines.append(f"- **Rating:** {book.rating}/5\n")
        lines.append(f"- **Favorite:** {'Yes' if book.is_favorite else 'No'}\n")
        lines.append(f"- **Created:** {book.created_at}\n\n")
        if book.summary:
            lines.append(f"**Summary:**\n{book.summary}\n\n")
        lines.append("---\n\n")

    return "books.md", "\n".join(lines).encode("utf-8")


def export_books_csv(db: Session, filters: dict) -> tuple[str, bytes]:
    """Export books as CSV."""
    query = db.query(Book)
    query = _apply_book_filters(query, filters)
    books = query.order_by(Book.created_at.desc()).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(
        [
            "id",
            "title",
            "author",
            "isbn",
            "publisher",
            "file_format",
            "reading_status",
            "rating",
            "is_favorite",
            "summary",
            "created_at",
        ]
    )

    for book in books:
        writer.writerow(
            [
                str(book.id),
                book.title,
                book.author or "",
                book.isbn or "",
                book.publisher or "",
                book.file_format,
                book.reading_status,
                book.rating if book.rating is not None else "",
                "Yes" if book.is_favorite else "No",
                book.summary or "",
                book.created_at.isoformat() if book.created_at else "",
            ]
        )

    return "books.csv", output.getvalue().encode("utf-8")


def export_books_pdf(db: Session, filters: dict) -> tuple[str, bytes]:
    """Export books as PDF."""
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import getSampleStyleSheet
        from reportlab.lib.units import cm
        from reportlab.pdfbase import pdfmetrics
        from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer
    except ImportError:
        raise RuntimeError("reportlab is not installed. Install it with: pip install reportlab")

    query = db.query(Book)
    query = _apply_book_filters(query, filters)
    books = query.order_by(Book.created_at.desc()).all()

    _register_chinese_font(pdfmetrics)

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4)
    styles = getSampleStyleSheet()
    story = []

    story.append(Paragraph("Books Export", styles["Title"]))
    story.append(Spacer(1, 0.5 * cm))
    story.append(
        Paragraph(
            f"Exported: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')} UTC | Total books: {len(books)}",
            styles["Normal"],
        )
    )
    story.append(Spacer(1, 1 * cm))

    for book in books:
        story.append(Paragraph(_escape_xml(book.title), styles["Heading2"]))
        if book.author:
            story.append(Paragraph(f"Author: {_escape_xml(book.author)}", styles["Normal"]))
        story.append(Paragraph(f"Format: {book.file_format} | Status: {book.reading_status}", styles["Normal"]))
        if book.rating is not None:
            story.append(Paragraph(f"Rating: {book.rating}/5", styles["Normal"]))
        story.append(Spacer(1, 0.2 * cm))
        if book.summary:
            story.append(Paragraph(_escape_xml(book.summary), styles["Normal"]))
        story.append(Spacer(1, 0.5 * cm))

    doc.build(story)
    return "books.pdf", buffer.getvalue()


# ── Helpers ──


def _escape_xml(text: str) -> str:
    """Escape special XML characters for reportlab Paragraph."""
    if not text:
        return ""
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
        .replace("'", "&apos;")
    )


def _register_chinese_font(pdfmetrics):
    """Try to register a Chinese-capable font. Falls back to Helvetica if unavailable."""
    import os

    from reportlab.pdfbase.ttfonts import TTFont

    # Common Chinese font paths on different platforms
    font_paths = [
        # Windows
        "C:/Windows/Fonts/simsun.ttc",
        "C:/Windows/Fonts/msyh.ttc",
        "C:/Windows/Fonts/simhei.ttf",
        # macOS
        "/System/Library/Fonts/STHeiti Medium.ttc",
        "/System/Library/Fonts/PingFang.ttc",
        # Linux
        "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc",
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
    ]

    for path in font_paths:
        if os.path.exists(path):
            try:
                pdfmetrics.registerFont(TTFont("ChineseFont", path))
                return
            except Exception:
                continue
    # If no Chinese font found, default fonts will be used (may not render Chinese)
