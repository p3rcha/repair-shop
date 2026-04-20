from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session as DBSession, selectinload

from ..deps import get_current_user, get_db
from ..limiter import limiter
from ..models import Estimate, EstimateItem, EstimateStatus, Item, User
from ..schemas import EstimateIn, EstimateOut, PaginatedEstimates, StatusUpdateIn


router = APIRouter(prefix="/estimates", tags=["estimates"])


@router.get("", response_model=PaginatedEstimates)
def list_estimates(
    status: EstimateStatus | None = None,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: DBSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> PaginatedEstimates:
    base = select(Estimate)
    if status is not None:
        base = base.where(Estimate.status == status)

    total = db.scalar(select(func.count()).select_from(base.subquery())) or 0

    items_stmt = (
        base.options(selectinload(Estimate.items).selectinload(EstimateItem.item))
        .order_by(Estimate.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    rows = list(db.scalars(items_stmt).all())
    return {
        "items": [EstimateOut.model_validate(row) for row in rows],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.post("", response_model=EstimateOut, status_code=status.HTTP_201_CREATED)
@limiter.limit("60/minute")
def create_estimate(
    request: Request,
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


@router.get("/{estimate_id}", response_model=EstimateOut)
def get_estimate(
    estimate_id: int,
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
    return estimate


@router.put("/{estimate_id}", response_model=EstimateOut)
@limiter.limit("60/minute")
def update_estimate(
    request: Request,
    estimate_id: int,
    payload: EstimateIn,
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

    db.execute(delete(EstimateItem).where(EstimateItem.estimate_id == estimate.id))

    total = Decimal("0")
    new_lines: list[EstimateItem] = []
    for line in payload.items:
        item = items_by_id[line.item_id]
        unit_price = item.base_price
        new_lines.append(
            EstimateItem(
                estimate_id=estimate.id,
                item_id=item.id,
                quantity=line.quantity,
                unit_price=unit_price,
            )
        )
        total += unit_price * line.quantity

    estimate.customer_name = payload.customer_name
    estimate.vehicle_make = payload.vehicle_make
    estimate.vehicle_model = payload.vehicle_model
    estimate.vehicle_year = payload.vehicle_year
    estimate.license_plate = payload.license_plate
    estimate.total = total

    db.add_all(new_lines)
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


@router.delete("/{estimate_id}", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("60/minute")
def delete_estimate(
    request: Request,
    estimate_id: int,
    db: DBSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> None:
    estimate = db.get(Estimate, estimate_id)
    if not estimate:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Estimate not found")

    db.delete(estimate)
    db.commit()
    return None
