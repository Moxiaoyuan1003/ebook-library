from abc import ABC, abstractmethod
from typing import Optional


class AIServiceInterface(ABC):
    """Abstract interface for AI services."""

    @abstractmethod
    async def generate_summary(self, text: str, max_tokens: int = 500) -> str:
        """Generate a summary of the given text."""
        ...

    @abstractmethod
    async def generate_tags(self, text: str, max_tags: int = 5) -> list[str]:
        """Generate tags for the given text."""
        ...

    @abstractmethod
    async def get_embedding(self, text: str) -> list[float]:
        """Get the embedding vector for the given text."""
        ...

    @abstractmethod
    async def chat(
        self,
        messages: list[dict],
        context: Optional[str] = None,
        max_tokens: int = 1000,
    ) -> str:
        """Chat with the AI model."""
        ...
