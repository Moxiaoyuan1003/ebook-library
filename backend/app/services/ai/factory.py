"""AI service factory with network-aware provider selection."""

from __future__ import annotations

import httpx

from app.services.ai.base import AIServiceInterface
from app.services.ai.claude_adapter import ClaudeAdapter
from app.services.ai.ollama_adapter import OllamaAdapter
from app.services.ai.openai_adapter import OpenAIAdapter
from app.services.network_checker import NetworkChecker


class AIServiceUnavailableError(Exception):
    """Raised when no AI service can be reached."""


class AIServiceFactory:
    """Creates AI service adapters based on network availability.

    * When online the configured cloud provider is used.
    * When offline Ollama is tried (with a health check).
    * If nothing is available :class:`AIServiceUnavailableError` is raised.
    """

    def __init__(self, settings, network_checker: NetworkChecker):
        self._settings = settings
        self._checker = network_checker

    async def get_service(self) -> tuple[AIServiceInterface, str]:
        """Return ``(service, provider_name)`` for the best available provider.

        Raises
        ------
        AIServiceUnavailableError
            If no provider can be reached.
        ValueError
            If the configured provider name is unknown.
        """
        online = await self._checker.is_online()

        if online:
            return self._create_cloud_service(self._settings.AI_PROVIDER)

        # Offline -- try Ollama
        if await self._is_ollama_healthy():
            return OllamaAdapter(base_url=self._settings.OLLAMA_BASE_URL), "ollama"

        raise AIServiceUnavailableError("No AI service available: offline and Ollama is not reachable.")

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _create_cloud_service(self, provider: str) -> tuple[AIServiceInterface, str]:
        """Instantiate the adapter for the named cloud provider."""
        if provider == "openai":
            return (
                OpenAIAdapter(
                    api_key=self._settings.OPENAI_API_KEY,
                    base_url=self._settings.OPENAI_BASE_URL,
                    model=self._settings.OPENAI_MODEL,
                ),
                "openai",
            )
        if provider == "claude":
            return (
                ClaudeAdapter(
                    api_key=self._settings.CLAUDE_API_KEY,
                    model=self._settings.CLAUDE_MODEL,
                ),
                "claude",
            )
        if provider == "ollama":
            return (
                OllamaAdapter(
                    base_url=self._settings.OLLAMA_BASE_URL,
                    model=self._settings.OLLAMA_MODEL,
                ),
                "ollama",
            )
        if provider == "custom":
            return (
                OpenAIAdapter(
                    api_key=self._settings.CUSTOM_API_KEY,
                    base_url=self._settings.CUSTOM_BASE_URL,
                    model=self._settings.CUSTOM_MODEL,
                ),
                "custom",
            )
        raise ValueError(f"Unknown AI provider: {provider}")

    async def _is_ollama_healthy(self) -> bool:
        """Check whether Ollama responds to ``GET /api/tags``."""
        url = f"{self._settings.OLLAMA_BASE_URL.rstrip('/')}/api/tags"
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(url, timeout=3)
                return 200 <= response.status_code < 300
        except Exception:
            return False
