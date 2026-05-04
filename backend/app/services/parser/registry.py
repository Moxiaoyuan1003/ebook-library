from pathlib import Path

from app.services.parser.base import BaseParser, ParsedBook
from app.services.parser.docx_parser import DOCXParser
from app.services.parser.epub_parser import EPUBParser
from app.services.parser.mobi_parser import MOBIParser
from app.services.parser.pdf_parser import PDFParser
from app.services.parser.txt_parser import TXTParser


class ParserRegistry:
    """Registry of file parsers."""

    def __init__(self):
        self._parsers: list[BaseParser] = [
            PDFParser(),
            EPUBParser(),
            TXTParser(),
            MOBIParser(),
            DOCXParser(),
        ]

    def get_parser(self, extension: str) -> BaseParser | None:
        """Get a parser for the given file extension."""
        for parser in self._parsers:
            if parser.supports(extension):
                return parser
        return None

    def parse(self, file_path: str) -> ParsedBook | None:
        """Parse a file using the appropriate parser."""
        ext = Path(file_path).suffix.lower()
        parser = self.get_parser(ext)
        if parser is None:
            return None
        return parser.parse(file_path)

    def supported_extensions(self) -> list[str]:
        """Return list of supported file extensions."""
        return [".pdf", ".epub", ".txt", ".mobi", ".docx"]
