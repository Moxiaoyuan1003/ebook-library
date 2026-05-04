"""Network availability checker with caching."""
import time

import httpx


class NetworkChecker:
    """Checks internet connectivity by sending a HEAD request to a known URL.

    Results are cached for ``ttl`` seconds to avoid repeated network calls.
    """

    def __init__(
        self,
        check_url: str = "https://www.google.com",
        timeout: float = 3,
        ttl: float = 30,
    ):
        self._check_url = check_url
        self._timeout = timeout
        self._ttl = ttl

        # Cache state
        self._cached_result: bool | None = None
        self._cache_time: float = 0.0

    async def is_online(self) -> bool:
        """Return *True* when a network request to *check_url* succeeds.

        The result is cached for ``ttl`` seconds.  Call :meth:`invalidate_cache`
        to force a fresh check on the next call.
        """
        now = time.monotonic()
        if self._cached_result is not None and (now - self._cache_time) < self._ttl:
            return self._cached_result

        online = await self._probe()
        self._cached_result = online
        self._cache_time = now
        return online

    def invalidate_cache(self) -> None:
        """Discard the cached result so the next :meth:`is_online` call probes the network."""
        self._cached_result = None
        self._cache_time = 0.0

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    async def _probe(self) -> bool:
        """Perform the actual HEAD request."""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.head(
                    self._check_url,
                    timeout=self._timeout,
                )
                return 200 <= response.status_code < 300
        except Exception:
            return False
