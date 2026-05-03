import ebooklib
from ebooklib import epub
from bs4 import BeautifulSoup
from pathlib import Path

from app.services.parser.base import BaseParser, ParsedBook


class EPUBParser(BaseParser):
    def supports(self, extension: str) -> bool:
        return extension.lower() == ".epub"

    def parse(self, file_path: str) -> ParsedBook:
        book = epub.read_epub(file_path)

        # Extract metadata
        title = book.get_metadata("DC", "title")
        author = book.get_metadata("DC", "creator")
        isbn = book.get_metadata("DC", "identifier")

        metadata = {
            "title": title[0][0] if title else Path(file_path).stem,
            "author": author[0][0] if author else "",
            "isbn": isbn[0][0] if isbn else "",
            "publisher": "",
        }

        # Extract cover
        cover_image = None
        for item in book.get_items_of_type(ebooklib.ITEM_COVER):
            cover_image = item.get_content()
            break

        # Extract chapters
        chapters = []
        full_text_parts = []
        page_num = 1

        for item in book.get_items_of_type(ebooklib.ITEM_DOCUMENT):
            soup = BeautifulSoup(item.get_content(), "html.parser")
            text = soup.get_text(separator="\n", strip=True)

            if text.strip():
                chapters.append({
                    "title": item.get_name() or f"Chapter {len(chapters) + 1}",
                    "content": text,
                    "page_start": page_num,
                    "page_end": page_num,
                })
                full_text_parts.append(text)
                page_num += 1

        return ParsedBook(
            metadata=metadata,
            chapters=chapters,
            full_text="\n".join(full_text_parts),
            page_count=len(chapters),
            cover_image=cover_image,
        )
