import asyncio

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session as DBSession

from ..deps import get_current_user, get_db
from ..models import Category, Item, User
from ..schemas import CategoryOut, ItemOut


router = APIRouter(prefix="/categories", tags=["categories"])


@router.get("", response_model=list[CategoryOut])
def list_categories(
    db: DBSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[Category]:
    return list(db.scalars(select(Category).order_by(Category.name)).all())


@router.get("/{category_id}/items", response_model=list[ItemOut])
async def list_items(
    category_id: int,
    db: DBSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[Item]:
    # Hardcoded sleep to simulate API latency
    await asyncio.sleep(0.6)

    category = db.get(Category, category_id)
    if not category:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")

    return list(
        db.scalars(select(Item).where(Item.category_id == category_id).order_by(Item.name)).all()
    )
