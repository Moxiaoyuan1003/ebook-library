"""System-level API endpoints (health, update check, etc.)."""
from fastapi import APIRouter

from app.services.update_checker import check_for_update

router = APIRouter()


@router.get("/update-check")
async def update_check():
    """Return update information by comparing the current version against the
    latest GitHub release."""
    return await check_for_update()
