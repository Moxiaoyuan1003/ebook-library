import chardet
from pathlib import Path

from app.services.parser.base import BaseParser, ParsedBook


class TXTParser(BaseParser):
    def supports(self, extension: str) -> bool:
        return extension.lower() == ".txt"

    def parse(self, file_path: str) -> ParsedBook:
        raw_bytes = Path(file_path).read_bytes()
        detected = chardet.detect(raw_bytes)
        encoding = detected.get("encoding", "utf-8") or "utf-8"

        try:
            text = raw_bytes.decode(encoding)
        except (UnicodeDecodeError, LookupError):
            text = raw_bytes.decode("utf-8", errors="replace")

        # Simple chapter splitting by common patterns
        chapters = self._split_chapters(text)

        metadata = {
            "title": Path(file_path).stem,
            "author": "",
            "isbn": "",
            "publisher": "",
        }

        return ParsedBook(
            metadata=metadata,
            chapters=chapters,
            full_text=text,
            page_count=len(chapters),
            cover_image=None,
        )

    def _split_chapters(self, text: str) -> list[dict]:
        """Split text into chapters by common patterns."""
        import re
        pattern = r'\n(?=第[一二三四五六七八九十百千\d]+[章节回卷]|Chapter\s+\d+)'
        parts = re.split(pattern, text)

        if len(parts) <= 1:
            # No chapters found, split by fixed size
            chunk_size = 3000
            parts = [text[i:i + chunk_size] for i in range(0, len(text), chunk_size)]

        chapters = []
        for i, part in enumerate(parts):
            if part.strip():
                chapters.append({
                    "title": f"Part {i + 1}",
                    "content": part.strip(),
                    "page_start": i + 1,
                    "page_end": i + 1,
                })

        return chapters
