from datetime import datetime, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import Book, ReadingProgress

router = APIRouter()


@router.get("/")
def get_stats(db: Session = Depends(get_db)):
    total_books = db.query(func.count(Book.id)).scalar() or 0
    finished = db.query(func.count(Book.id)).filter(Book.reading_status == "finished").scalar() or 0
    reading = db.query(func.count(Book.id)).filter(Book.reading_status == "reading").scalar() or 0
    favorites = db.query(func.count(Book.id)).filter(Book.is_favorite == True).scalar() or 0  # noqa: E712

    # Format distribution
    formats = db.query(Book.file_format, func.count(Book.id)).group_by(Book.file_format).all()

    # Reading progress stats
    total_progress = db.query(func.sum(ReadingProgress.progress_percent)).scalar() or 0
    avg_progress = round(total_progress / total_books, 1) if total_books > 0 else 0

    # Reading speed estimate: pages progressed per active day in last 30 days
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    active_progress = (
        db.query(ReadingProgress)
        .filter(ReadingProgress.updated_at >= thirty_days_ago, ReadingProgress.progress_percent > 0)
        .all()
    )
    if active_progress:
        total_progress_gain = sum(p.progress_percent for p in active_progress)
        active_days = set()
        for p in active_progress:
            if p.updated_at:
                active_days.add(p.updated_at.date())
        days_active = max(len(active_days), 1)
        pages_per_day = round(total_progress_gain / days_active, 1)
    else:
        days_active = 0
        pages_per_day = 0

    return {
        "total_books": total_books,
        "finished": finished,
        "reading": reading,
        "favorites": favorites,
        "formats": {f: c for f, c in formats},
        "avg_progress": avg_progress,
        "pages_per_day": pages_per_day,
        "active_days": days_active,
    }
