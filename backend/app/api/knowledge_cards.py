from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.card_link import CardLink
from app.models.knowledge_card import KnowledgeCard
from app.schemas.knowledge_card import (
    CardLinkResponse,
    KnowledgeCardCreate,
    KnowledgeCardListResponse,
    KnowledgeCardResponse,
    KnowledgeCardUpdate,
)


class CardLinkBody(BaseModel):
    """Request body for creating a link (source comes from URL path)."""

    target_card_id: UUID
    link_type: str | None = Field("related", max_length=30)


router = APIRouter()


@router.get("/", response_model=KnowledgeCardListResponse)
def list_knowledge_cards(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    card_type: str | None = Query(None),
    search: str | None = Query(None),
    db: Session = Depends(get_db),
):
    query = db.query(KnowledgeCard)

    if card_type:
        query = query.filter(KnowledgeCard.card_type == card_type)

    if search:
        pattern = f"%{search}%"
        query = query.filter(
            or_(
                KnowledgeCard.title.ilike(pattern),
                KnowledgeCard.content.ilike(pattern),
            )
        )

    total = query.count()
    items = query.order_by(KnowledgeCard.updated_at.desc()).offset((page - 1) * page_size).limit(page_size).all()

    return KnowledgeCardListResponse(
        items=[KnowledgeCardResponse.model_validate(c) for c in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{card_id}", response_model=KnowledgeCardResponse)
def get_knowledge_card(card_id: UUID, db: Session = Depends(get_db)):
    card = db.query(KnowledgeCard).filter(KnowledgeCard.id == card_id).first()
    if not card:
        raise HTTPException(status_code=404, detail="Knowledge card not found")
    return KnowledgeCardResponse.model_validate(card)


@router.post("/", response_model=KnowledgeCardResponse)
def create_knowledge_card(data: KnowledgeCardCreate, db: Session = Depends(get_db)):
    card = KnowledgeCard(**data.model_dump())
    db.add(card)
    db.commit()
    db.refresh(card)
    return KnowledgeCardResponse.model_validate(card)


@router.put("/{card_id}", response_model=KnowledgeCardResponse)
def update_knowledge_card(card_id: UUID, data: KnowledgeCardUpdate, db: Session = Depends(get_db)):
    card = db.query(KnowledgeCard).filter(KnowledgeCard.id == card_id).first()
    if not card:
        raise HTTPException(status_code=404, detail="Knowledge card not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(card, key, value)
    db.commit()
    db.refresh(card)
    return KnowledgeCardResponse.model_validate(card)


@router.delete("/{card_id}")
def delete_knowledge_card(card_id: UUID, db: Session = Depends(get_db)):
    card = db.query(KnowledgeCard).filter(KnowledgeCard.id == card_id).first()
    if not card:
        raise HTTPException(status_code=404, detail="Knowledge card not found")
    # Delete associated links first
    db.query(CardLink).filter(
        or_(
            CardLink.source_card_id == card_id,
            CardLink.target_card_id == card_id,
        )
    ).delete()
    db.delete(card)
    db.commit()
    return {"status": "deleted"}


# --- Card Link endpoints ---


@router.post("/{card_id}/links", response_model=CardLinkResponse)
def create_card_link(card_id: UUID, data: CardLinkBody, db: Session = Depends(get_db)):
    # Verify source card exists
    source = db.query(KnowledgeCard).filter(KnowledgeCard.id == card_id).first()
    if not source:
        raise HTTPException(status_code=404, detail="Source card not found")
    # Verify target card exists
    target = db.query(KnowledgeCard).filter(KnowledgeCard.id == data.target_card_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Target card not found")

    link = CardLink(
        source_card_id=card_id,
        target_card_id=data.target_card_id,
        link_type=data.link_type or "related",
    )
    db.add(link)
    db.commit()
    db.refresh(link)
    return CardLinkResponse.model_validate(link)


@router.get("/{card_id}/links", response_model=list[CardLinkResponse])
def list_card_links(card_id: UUID, db: Session = Depends(get_db)):
    # Verify card exists
    card = db.query(KnowledgeCard).filter(KnowledgeCard.id == card_id).first()
    if not card:
        raise HTTPException(status_code=404, detail="Knowledge card not found")

    links = (
        db.query(CardLink)
        .filter(
            or_(
                CardLink.source_card_id == card_id,
                CardLink.target_card_id == card_id,
            )
        )
        .all()
    )
    return [CardLinkResponse.model_validate(link) for link in links]


@router.delete("/links/{link_id}")
def delete_card_link(link_id: UUID, db: Session = Depends(get_db)):
    link = db.query(CardLink).filter(CardLink.id == link_id).first()
    if not link:
        raise HTTPException(status_code=404, detail="Card link not found")
    db.delete(link)
    db.commit()
    return {"status": "deleted"}
