from pathlib import Path

from app.services.parser.base import BaseParser, ParsedBook


class DOCXParser(BaseParser):
    def supports(self, extension: str) -> bool:
        return extension.lower() == ".docx"

    def parse(self, file_path: str) -> ParsedBook:
        from docx import Document

        doc = Document(file_path)

        chapters = []
        full_text_parts = []
        current_chapter = {"title": "Document Start", "content": "", "page_start": 1, "page_end": 1}

        for para in doc.paragraphs:
            text = para.text.strip()
            if not text:
                continue

            # Detect headings as chapter boundaries
            if para.style.name.startswith("Heading"):
                if current_chapter["content"]:
                    chapters.append(current_chapter)
                current_chapter = {
                    "title": text,
                    "content": "",
                    "page_start": len(chapters) + 1,
                    "page_end": len(chapters) + 1,
                }
            else:
                current_chapter["content"] += text + "\n"
                full_text_parts.append(text)

        if current_chapter["content"]:
            chapters.append(current_chapter)

        if not chapters:
            full_text = "\n".join(full_text_parts)
            chapters = [{"title": "Full Text", "content": full_text, "page_start": 1, "page_end": 1}]

        # Extract core properties
        core = doc.core_properties
        metadata = {
            "title": core.title or Path(file_path).stem,
            "author": core.author or "",
            "isbn": "",
            "publisher": "",
        }

        return ParsedBook(
            metadata=metadata,
            chapters=chapters,
            full_text="\n".join(full_text_parts),
            page_count=len(chapters),
            cover_image=None,
        )
