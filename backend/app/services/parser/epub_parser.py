from pathlib import Path

import ebooklib
from bs4 import BeautifulSoup
from ebooklib import epub

from app.services.parser.base import BaseParser, ParsedBook


class EPUBParser(BaseParser):
    def supports(self, extension: str) -> bool:
        return extension.lower() == ".epub"

    def _extract_cover(self, book: epub.EpubBook) -> bytes | None:
        """Extract cover image using multiple strategies."""
        # Strategy 1: Standard cover item
        for item in book.get_items_of_type(ebooklib.ITEM_COVER):
            content = item.get_content()
            if content and len(content) > 1000:
                return content

        # Strategy 2: Look for image with "cover" in name
        for item in book.get_items_of_type(ebooklib.ITEM_IMAGE):
            name = item.get_name().lower()
            if "cover" in name or "封面" in name:
                content = item.get_content()
                if content and len(content) > 1000:
                    return content

        # Strategy 3: Look for cover in OPF metadata
        try:
            opf = book.get_metadata("OPF", "cover")
            if opf:
                cover_id = opf[0][0]
                for item in book.get_items():
                    if item.get_id() == cover_id:
                        content = item.get_content()
                        if content and len(content) > 1000:
                            return content
        except Exception:
            pass

        # Strategy 4: Find the largest image (likely the cover)
        largest_img = None
        largest_size = 0
        for item in book.get_items_of_type(ebooklib.ITEM_IMAGE):
            content = item.get_content()
            if content and len(content) > largest_size:
                largest_size = len(content)
                largest_img = content

        if largest_img and largest_size > 5000:  # Skip tiny images
            return largest_img

        # Strategy 5: Look for cover page HTML and extract image from it
        for item in book.get_items_of_type(ebooklib.ITEM_DOCUMENT):
            name = item.get_name().lower()
            if "cover" in name or "封面" in name:
                soup = BeautifulSoup(item.get_content(), "html.parser")
                img = soup.find("img")
                if img and img.get("src"):
                    img_src = img["src"]
                    # Resolve relative path
                    for img_item in book.get_items_of_type(ebooklib.ITEM_IMAGE):
                        if img_item.get_name().endswith(img_src.split("/")[-1]):
                            content = img_item.get_content()
                            if content and len(content) > 1000:
                                return content

        return None

    def parse(self, file_path: str) -> ParsedBook:
        book = epub.read_epub(file_path)

        # Extract metadata
        title = book.get_metadata("DC", "title")
        author = book.get_metadata("DC", "creator")
        isbn = book.get_metadata("DC", "identifier")
        publisher = book.get_metadata("DC", "publisher")

        metadata = {
            "title": title[0][0] if title else Path(file_path).stem,
            "author": author[0][0] if author else "",
            "isbn": isbn[0][0] if isbn else "",
            "publisher": publisher[0][0] if publisher else "",
        }

        # Extract cover
        cover_image = self._extract_cover(book)

        # Extract chapters
        chapters = []
        full_text_parts = []
        page_num = 1

        for item in book.get_items_of_type(ebooklib.ITEM_DOCUMENT):
            soup = BeautifulSoup(item.get_content(), "html.parser")
            text = soup.get_text(separator="\n", strip=True)

            if text.strip():
                chapters.append(
                    {
                        "title": item.get_name() or f"Chapter {len(chapters) + 1}",
                        "content": text,
                        "page_start": page_num,
                        "page_end": page_num,
                    }
                )
                full_text_parts.append(text)
                page_num += 1

        return ParsedBook(
            metadata=metadata,
            chapters=chapters,
            full_text="\n".join(full_text_parts),
            page_count=len(chapters),
            cover_image=cover_image,
        )
