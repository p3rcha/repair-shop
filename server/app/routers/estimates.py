from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session as DBSession, selectinload

from ..deps import get_current_user, get_db
from ..models import Estimate, EstimateItem, EstimateStatus, Item, User
from ..schemas import EstimateIn, EstimateOut, StatusUpdateIn


router = APIRouter(prefix="/estimates", tags=["estimates"])


@router.get("", response_model=list[EstimateOut])
def list_estimates(
    status: EstimateStatus | None = None,
    db: DBSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[Estimate]:
    stmt = (
        select(Estimate)
        .options(selectinload(Estimate.items).selectinload(EstimateItem.item))
        .order_by(Estimate.created_at.desc())
    )
    if status is not None:
        stmt = stmt.where(Estimate.status == status)
    return list(db.scalars(stmt).all())


@router.post("", response_model=EstimateOut, status_code=status.HTTP_201_CREATED)
def create_estimate(
    payload: EstimateIn,
    db: DBSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Estimate:
    item_ids = [li.item_id for li in payload.items]
    items_by_id = {
        item.id: item
        for item in db.scalars(select(Item).where(Item.id.in_(item_ids))).all()
    }

    missing = [iid for iid in item_ids if iid not in items_by_id]
    if missing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown item id(s): {missing}",
        )

    line_items: list[EstimateItem] = []
    total = Decimal("0")
    for line in payload.items:
        item = items_by_id[line.item_id]
        unit_price = item.base_price
        line_items.append(
            EstimateItem(item_id=item.id, quantity=line.quantity, unit_price=unit_price)
        )
        total += unit_price * line.quantity

    estimate = Estimate(
        customer_name=payload.customer_name,
        vehicle_make=payload.vehicle_make,
        vehicle_model=payload.vehicle_model,
        vehicle_year=payload.vehicle_year,
        license_plate=payload.license_plate,
        status=EstimateStatus.pending,
        total=total,
        created_by=current_user.id,
        items=line_items,
    )
    db.add(estimate)
    db.commit()
    db.refresh(estimate)
    return estimate


@router.patch("/{estimate_id}/status", response_model=EstimateOut)
def update_status(
    estimate_id: int,
    payload: StatusUpdateIn,
    db: DBSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> Estimate:
    estimate = db.scalar(
        select(Estimate)
        .options(selectinload(Estimate.items).selectinload(EstimateItem.item))
        .where(Estimate.id == estimate_id)
    )
    if not estimate:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Estimate not found")

    estimate.status = payload.status
    db.commit()
    db.refresh(estimate)
    return estimate
