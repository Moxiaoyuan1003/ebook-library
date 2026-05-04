"""Tests for the update checker service and system API endpoint."""

from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from app.services.update_checker import _compare_versions, check_for_update

# ---------------------------------------------------------------------------
# _compare_versions unit tests
# ---------------------------------------------------------------------------


class TestCompareVersions:
    """Direct tests for the semver comparison helper."""

    def test_newer_version_returns_true(self):
        assert _compare_versions("1.2.0", "1.1.0") is True

    def test_same_version_returns_false(self):
        assert _compare_versions("1.2.0", "1.2.0") is False

    def test_older_version_returns_false(self):
        assert _compare_versions("1.1.0", "1.2.0") is False

    def test_major_version_difference(self):
        assert _compare_versions("2.0.0", "1.9.9") is True

    def test_patch_version_difference(self):
        assert _compare_versions("1.0.1", "1.0.0") is True

    def test_invalid_latest_returns_false(self):
        assert _compare_versions("bad", "1.0.0") is False

    def test_invalid_current_returns_false(self):
        assert _compare_versions("1.0.0", "bad") is False

    def test_both_invalid_returns_false(self):
        assert _compare_versions("bad", "also-bad") is False

    def test_none_inputs_returns_false(self):
        assert _compare_versions(None, "1.0.0") is False
        assert _compare_versions("1.0.0", None) is False


# ---------------------------------------------------------------------------
# check_for_update integration tests (mocked HTTP)
# ---------------------------------------------------------------------------


class TestCheckForUpdate:
    """Tests for the async check_for_update function."""

    @pytest.mark.asyncio
    async def test_newer_release_available(self):
        """When GitHub returns a newer version, has_update is True."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "tag_name": "v99.0.0",
            "html_url": "https://github.com/user/ebook-library/releases/tag/v99.0.0",
            "body": "Release notes here",
            "published_at": "2026-01-01T00:00:00Z",
        }

        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.get = AsyncMock(return_value=mock_response)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client_cls.return_value = mock_client

            result = await check_for_update()

        assert result["has_update"] is True
        assert result["latest_version"] == "99.0.0"
        assert result["current_version"] is not None
        assert result["release_url"] is not None
        assert result["published_at"] == "2026-01-01T00:00:00Z"

    @pytest.mark.asyncio
    async def test_already_up_to_date(self):
        """When GitHub returns the same version, has_update is False."""
        # Import settings to get the real current version
        from app.core.config import settings

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "tag_name": f"v{settings.APP_VERSION}",
            "html_url": "https://example.com",
            "body": "Same version",
            "published_at": "2025-01-01T00:00:00Z",
        }

        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.get = AsyncMock(return_value=mock_response)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client_cls.return_value = mock_client

            result = await check_for_update()

        assert result["has_update"] is False
        assert result["latest_version"] == settings.APP_VERSION

    @pytest.mark.asyncio
    async def test_github_returns_non_200(self):
        """When GitHub returns a non-200 status, falls back to no-update response."""
        mock_response = MagicMock()
        mock_response.status_code = 404

        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.get = AsyncMock(return_value=mock_response)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client_cls.return_value = mock_client

            result = await check_for_update()

        assert result["has_update"] is False
        assert result["latest_version"] is None
        assert result["release_url"] is None

    @pytest.mark.asyncio
    async def test_network_error_graceful_fallback(self):
        """When the HTTP request raises, returns the no-update fallback."""
        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.get = AsyncMock(side_effect=httpx.ConnectError("fail"))
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client_cls.return_value = mock_client

            result = await check_for_update()

        assert result["has_update"] is False
        assert result["latest_version"] is None

    @pytest.mark.asyncio
    async def test_release_notes_truncated_to_500_chars(self):
        """Release notes are truncated to 500 characters."""
        long_body = "x" * 1000
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "tag_name": "v99.0.0",
            "html_url": "https://example.com",
            "body": long_body,
            "published_at": "2026-01-01T00:00:00Z",
        }

        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.get = AsyncMock(return_value=mock_response)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client_cls.return_value = mock_client

            result = await check_for_update()

        assert len(result["release_notes"]) == 500

    @pytest.mark.asyncio
    async def test_tag_name_v_prefix_stripped(self):
        """The 'v' prefix is stripped from tag_name."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "tag_name": "v99.0.0",
            "html_url": "https://example.com",
            "body": "",
            "published_at": "2026-01-01T00:00:00Z",
        }

        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.get = AsyncMock(return_value=mock_response)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client_cls.return_value = mock_client

            result = await check_for_update()

        assert result["latest_version"] == "99.0.0"
        assert not result["latest_version"].startswith("v")


# ---------------------------------------------------------------------------
# Endpoint tests via TestClient
# ---------------------------------------------------------------------------


class TestUpdateCheckEndpoint:
    """Test the /api/system/update-check endpoint."""

    @pytest.mark.asyncio
    async def test_endpoint_returns_update_info(self):
        """The endpoint returns the same shape as check_for_update."""
        from httpx import ASGITransport, AsyncClient

        from app.main import app

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "tag_name": "v99.0.0",
            "html_url": "https://example.com/release",
            "body": "Notes",
            "published_at": "2026-01-01T00:00:00Z",
        }

        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.get = AsyncMock(return_value=mock_response)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client_cls.return_value = mock_client

            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as ac:
                resp = await ac.get("/api/system/update-check")

        assert resp.status_code == 200
        data = resp.json()
        assert "current_version" in data
        assert "latest_version" in data
        assert "has_update" in data
        assert "release_url" in data
        assert "release_notes" in data
        assert "published_at" in data
