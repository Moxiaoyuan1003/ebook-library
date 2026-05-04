from pathlib import Path

import fitz  # PyMuPDF

from app.services.parser.base import BaseParser, ParsedBook


class PDFParser(BaseParser):
    def supports(self, extension: str) -> bool:
        return extension.lower() == ".pdf"

    def parse(self, file_path: str) -> ParsedBook:
        doc = fitz.open(file_path)
        chapters = []
        full_text_parts = []

        for page_num in range(len(doc)):
            page = doc[page_num]
            text = page.get_text()
            full_text_parts.append(text)

            chapters.append(
                {
                    "title": f"Page {page_num + 1}",
                    "content": text,
                    "page_start": page_num + 1,
                    "page_end": page_num + 1,
                }
            )

        # Extract metadata
        meta = doc.metadata or {}
        metadata = {
            "title": meta.get("title", Path(file_path).stem),
            "author": meta.get("author", ""),
            "isbn": "",
            "publisher": meta.get("producer", ""),
        }

        # Extract cover (first page as image)
        cover_image = None
        if len(doc) > 0:
            page = doc[0]
            pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))
            cover_image = pix.tobytes("png")

        doc.close()

        return ParsedBook(
            metadata=metadata,
            chapters=chapters,
            full_text="\n".join(full_text_parts),
            page_count=len(chapters),
            cover_image=cover_image,
        )
