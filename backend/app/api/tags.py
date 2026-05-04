from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import Tag
from app.schemas.tag import TagCreate, TagResponse, TagUpdate

router = APIRouter()


@router.get("/", response_model=list[TagResponse])
def list_tags(db: Session = Depends(get_db)):
    tags = db.query(Tag).all()
    return [TagResponse.model_validate(t) for t in tags]


@router.post("/", response_model=TagResponse)
def create_tag(data: TagCreate, db: Session = Depends(get_db)):
    tag = Tag(**data.model_dump())
    db.add(tag)
    db.commit()
    db.refresh(tag)
    return TagResponse.model_validate(tag)


@router.put("/{tag_id}", response_model=TagResponse)
def update_tag(tag_id: UUID, data: TagUpdate, db: Session = Depends(get_db)):
    tag = db.query(Tag).filter(Tag.id == tag_id).first()
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(tag, key, value)
    db.commit()
    db.refresh(tag)
    return TagResponse.model_validate(tag)


@router.delete("/{tag_id}")
def delete_tag(tag_id: UUID, db: Session = Depends(get_db)):
    tag = db.query(Tag).filter(Tag.id == tag_id).first()
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    db.delete(tag)
    db.commit()
    return {"status": "deleted"}
