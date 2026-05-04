"""Tests for NetworkChecker and AIServiceFactory."""
import asyncio
from unittest.mock import AsyncMock, patch, MagicMock

import pytest
import httpx

from app.services.network_checker import NetworkChecker
from app.services.ai.factory import AIServiceFactory, AIServiceUnavailableError
from app.services.ai.base import AIServiceInterface


# ---------------------------------------------------------------------------
# NetworkChecker tests
# ---------------------------------------------------------------------------


class TestNetworkChecker:
    """Tests for the NetworkChecker class."""

    @pytest.fixture
    def checker(self):
        return NetworkChecker(check_url="https://www.google.com", timeout=3)

    @pytest.mark.asyncio
    async def test_online_returns_true(self, checker):
        """When HEAD request succeeds, is_online returns True."""
        mock_response = MagicMock()
        mock_response.status_code = 200

        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.head = AsyncMock(return_value=mock_response)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client_cls.return_value = mock_client

            result = await checker.is_online()
            assert result is True

    @pytest.mark.asyncio
    async def test_offline_returns_false_on_exception(self, checker):
        """When HEAD request raises, is_online returns False."""
        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.head = AsyncMock(side_effect=httpx.ConnectError("fail"))
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client_cls.return_value = mock_client

            result = await checker.is_online()
            assert result is False

    @pytest.mark.asyncio
    async def test_offline_returns_false_on_non_200(self, checker):
        """When HEAD returns non-2xx, is_online returns False."""
        mock_response = MagicMock()
        mock_response.status_code = 503

        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.head = AsyncMock(return_value=mock_response)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client_cls.return_value = mock_client

            result = await checker.is_online()
            assert result is False

    @pytest.mark.asyncio
    async def test_cache_hit_within_ttl(self, checker):
        """Second call within TTL uses cached result (no extra network call)."""
        mock_response = MagicMock()
        mock_response.status_code = 200

        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.head = AsyncMock(return_value=mock_response)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client_cls.return_value = mock_client

            result1 = await checker.is_online()
            result2 = await checker.is_online()

            assert result1 is True
            assert result2 is True
            # head should only have been called once because of caching
            assert mock_client.head.call_count == 1

    @pytest.mark.asyncio
    async def test_invalidate_cache(self, checker):
        """After invalidation, is_online makes a fresh request."""
        mock_response = MagicMock()
        mock_response.status_code = 200

        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.head = AsyncMock(return_value=mock_response)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client_cls.return_value = mock_client

            await checker.is_online()
            checker.invalidate_cache()
            await checker.is_online()

            assert mock_client.head.call_count == 2

    @pytest.mark.asyncio
    async def test_cache_expires_after_ttl(self, checker):
        """After TTL expires, a fresh network request is made."""
        # Use a very short TTL for testing
        checker._ttl = 0  # immediate expiry

        mock_response = MagicMock()
        mock_response.status_code = 200

        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.head = AsyncMock(return_value=mock_response)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client_cls.return_value = mock_client

            await checker.is_online()
            # TTL is 0, so cache is already expired
            await checker.is_online()

            assert mock_client.head.call_count == 2


# ---------------------------------------------------------------------------
# AIServiceFactory tests
# ---------------------------------------------------------------------------


class FakeSettings:
    """Minimal settings object for testing."""
    AI_PROVIDER = "openai"
    OPENAI_API_KEY = "test-key"
    OPENAI_BASE_URL = "https://api.openai.com/v1"
    CLAUDE_API_KEY = "test-claude-key"
    OLLAMA_BASE_URL = "http://localhost:11434"


class TestAIServiceFactory:
    """Tests for the AIServiceFactory class."""

    @pytest.fixture
    def mock_checker_online(self):
        checker = AsyncMock(spec=NetworkChecker)
        checker.is_online = AsyncMock(return_value=True)
        return checker

    @pytest.fixture
    def mock_checker_offline(self):
        checker = AsyncMock(spec=NetworkChecker)
        checker.is_online = AsyncMock(return_value=False)
        return checker

    @pytest.mark.asyncio
    async def test_online_openai_returns_openai_adapter(self, mock_checker_online):
        settings = FakeSettings()
        settings.AI_PROVIDER = "openai"
        factory = AIServiceFactory(settings=settings, network_checker=mock_checker_online)

        service, provider_name = await factory.get_service()

        assert provider_name == "openai"
        assert isinstance(service, AIServiceInterface)

    @pytest.mark.asyncio
    async def test_online_claude_returns_claude_adapter(self, mock_checker_online):
        settings = FakeSettings()
        settings.AI_PROVIDER = "claude"
        factory = AIServiceFactory(settings=settings, network_checker=mock_checker_online)

        service, provider_name = await factory.get_service()

        assert provider_name == "claude"
        assert isinstance(service, AIServiceInterface)

    @pytest.mark.asyncio
    async def test_online_ollama_returns_ollama_adapter(self, mock_checker_online):
        settings = FakeSettings()
        settings.AI_PROVIDER = "ollama"
        factory = AIServiceFactory(settings=settings, network_checker=mock_checker_online)

        service, provider_name = await factory.get_service()

        assert provider_name == "ollama"
        assert isinstance(service, AIServiceInterface)

    @pytest.mark.asyncio
    async def test_offline_ollama_available(self, mock_checker_offline):
        """When offline but Ollama is healthy, use Ollama."""
        settings = FakeSettings()
        settings.AI_PROVIDER = "openai"  # configured for cloud, but offline
        factory = AIServiceFactory(settings=settings, network_checker=mock_checker_offline)

        mock_response = MagicMock()
        mock_response.status_code = 200

        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.get = AsyncMock(return_value=mock_response)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client_cls.return_value = mock_client

            service, provider_name = await factory.get_service()

            assert provider_name == "ollama"
            assert isinstance(service, AIServiceInterface)

    @pytest.mark.asyncio
    async def test_offline_ollama_unavailable_raises(self, mock_checker_offline):
        """When offline and Ollama is down, raise AIServiceUnavailableError."""
        settings = FakeSettings()
        settings.AI_PROVIDER = "openai"
        factory = AIServiceFactory(settings=settings, network_checker=mock_checker_offline)

        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.get = AsyncMock(side_effect=httpx.ConnectError("fail"))
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client_cls.return_value = mock_client

            with pytest.raises(AIServiceUnavailableError):
                await factory.get_service()

    @pytest.mark.asyncio
    async def test_offline_ollama_non_200_raises(self, mock_checker_offline):
        """When offline and Ollama returns non-200, raise AIServiceUnavailableError."""
        settings = FakeSettings()
        settings.AI_PROVIDER = "openai"
        factory = AIServiceFactory(settings=settings, network_checker=mock_checker_offline)

        mock_response = MagicMock()
        mock_response.status_code = 503

        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.get = AsyncMock(return_value=mock_response)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client_cls.return_value = mock_client

            with pytest.raises(AIServiceUnavailableError):
                await factory.get_service()

    @pytest.mark.asyncio
    async def test_online_unknown_provider_raises(self, mock_checker_online):
        """When online with an unknown provider, raise ValueError."""
        settings = FakeSettings()
        settings.AI_PROVIDER = "unknown"
        factory = AIServiceFactory(settings=settings, network_checker=mock_checker_online)

        with pytest.raises(ValueError, match="Unknown AI provider"):
            await factory.get_service()

    @pytest.mark.asyncio
    async def test_offline_configured_for_ollama_and_healthy(self, mock_checker_offline):
        """When offline and provider is ollama, check Ollama health and return."""
        settings = FakeSettings()
        settings.AI_PROVIDER = "ollama"
        factory = AIServiceFactory(settings=settings, network_checker=mock_checker_offline)

        mock_response = MagicMock()
        mock_response.status_code = 200

        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.get = AsyncMock(return_value=mock_response)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client_cls.return_value = mock_client

            service, provider_name = await factory.get_service()

            assert provider_name == "ollama"
            assert isinstance(service, AIServiceInterface)
