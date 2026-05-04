from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.annotation import Annotation
from app.schemas.annotation import (
    AnnotationCreate,
    AnnotationResponse,
    AnnotationUpdate,
)

router = APIRouter()


@router.get("/", response_model=list[AnnotationResponse])
def list_annotations(
    book_id: UUID = Query(...),
    db: Session = Depends(get_db),
):
    annotations = (
        db.query(Annotation).filter(Annotation.book_id == book_id).order_by(Annotation.created_at.desc()).all()
    )
    return [AnnotationResponse.model_validate(a) for a in annotations]


@router.post("/", response_model=AnnotationResponse)
def create_annotation(data: AnnotationCreate, db: Session = Depends(get_db)):
    annotation = Annotation(**data.model_dump())
    db.add(annotation)
    db.commit()
    db.refresh(annotation)
    return AnnotationResponse.model_validate(annotation)


@router.put("/{annotation_id}", response_model=AnnotationResponse)
def update_annotation(annotation_id: UUID, data: AnnotationUpdate, db: Session = Depends(get_db)):
    annotation = db.query(Annotation).filter(Annotation.id == annotation_id).first()
    if not annotation:
        raise HTTPException(status_code=404, detail="Annotation not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(annotation, key, value)
    db.commit()
    db.refresh(annotation)
    return AnnotationResponse.model_validate(annotation)


@router.delete("/{annotation_id}")
def delete_annotation(annotation_id: UUID, db: Session = Depends(get_db)):
    annotation = db.query(Annotation).filter(Annotation.id == annotation_id).first()
    if not annotation:
        raise HTTPException(status_code=404, detail="Annotation not found")
    db.delete(annotation)
    db.commit()
    return {"status": "deleted"}
