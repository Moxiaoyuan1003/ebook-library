"""Export API router."""

import io

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.export import ExportRequest
from app.services import export_service

router = APIRouter()

# Map (data_type, format) -> export function
_EXPORT_MAP = {
    ("cards", "markdown"): export_service.export_cards_md,
    ("cards", "csv"): export_service.export_cards_csv,
    ("cards", "pdf"): export_service.export_cards_pdf,
    ("annotations", "markdown"): export_service.export_annotations_md,
    ("annotations", "csv"): export_service.export_annotations_csv,
    ("annotations", "pdf"): export_service.export_annotations_pdf,
    ("books", "markdown"): export_service.export_books_md,
    ("books", "csv"): export_service.export_books_csv,
    ("books", "pdf"): export_service.export_books_pdf,
}

# Content types for each format
_CONTENT_TYPES = {
    "markdown": "text/markdown; charset=utf-8",
    "csv": "text/csv; charset=utf-8",
    "pdf": "application/pdf",
}

_VALID_DATA_TYPES = {"cards", "annotations", "books"}
_VALID_FORMATS = {"markdown", "csv", "pdf"}


@router.post("/")
def export_data(request: ExportRequest, db: Session = Depends(get_db)):
    """Export data based on type, format, and filters."""
    if request.data_type not in _VALID_DATA_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid data_type: {request.data_type}. Must be one of: {', '.join(_VALID_DATA_TYPES)}",
        )
    if request.format not in _VALID_FORMATS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid format: {request.format}. Must be one of: {', '.join(_VALID_FORMATS)}",
        )

    export_fn = _EXPORT_MAP.get((request.data_type, request.format))
    if not export_fn:
        raise HTTPException(status_code=500, detail="Export function not found")

    try:
        filename, content = export_fn(db, request.filters)
    except RuntimeError as e:
        raise HTTPException(status_code=501, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")

    content_type = _CONTENT_TYPES.get(request.format, "application/octet-stream")

    return StreamingResponse(
        io.BytesIO(content),
        media_type=content_type,
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
        },
    )
