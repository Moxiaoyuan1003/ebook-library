from abc import ABC, abstractmethod
from dataclasses import dataclass, field


@dataclass
class ParsedBook:
    """Unified result from all parsers."""

    metadata: dict = field(default_factory=dict)
    chapters: list[dict] = field(default_factory=list)
    full_text: str = ""
    page_count: int = 0
    cover_image: bytes | None = None


class BaseParser(ABC):
    """Abstract base class for file parsers."""

    @abstractmethod
    def parse(self, file_path: str) -> ParsedBook:
        """Parse a file and return a ParsedBook."""
        ...

    @abstractmethod
    def supports(self, extension: str) -> bool:
        """Check if this parser supports the given file extension."""
        ...
