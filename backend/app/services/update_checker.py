"""GitHub Release version checker service."""
import httpx

from app.core.config import settings

GITHUB_REPO = "user/ebook-library"  # placeholder, configurable


async def check_for_update() -> dict:
    """Check GitHub for latest release.

    Returns a dict with keys:
    ``current_version``, ``latest_version``, ``has_update``,
    ``release_url``, ``release_notes``, ``published_at``.
    """
    current = settings.APP_VERSION
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"https://api.github.com/repos/{GITHUB_REPO}/releases/latest",
                timeout=5.0,
                headers={"Accept": "application/vnd.github.v3+json"},
            )
            if resp.status_code == 200:
                data = resp.json()
                latest = data.get("tag_name", "").lstrip("v")
                return {
                    "current_version": current,
                    "latest_version": latest,
                    "has_update": _compare_versions(latest, current),
                    "release_url": data.get("html_url"),
                    "release_notes": (data.get("body") or "")[:500],
                    "published_at": data.get("published_at"),
                }
    except Exception:
        pass

    return {
        "current_version": current,
        "latest_version": None,
        "has_update": False,
        "release_url": None,
        "release_notes": None,
        "published_at": None,
    }


def _compare_versions(latest: str, current: str) -> bool:
    """Return True if *latest* > *current* using semver comparison."""
    try:
        l = tuple(int(x) for x in latest.split("."))
        c = tuple(int(x) for x in current.split("."))
        return l > c
    except (ValueError, AttributeError):
        return False
