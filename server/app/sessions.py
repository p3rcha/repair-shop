from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session as DBSession

from .config import settings
from .models import Session
from .security import hash_token


def create_session(
    db: DBSession,
    user_id: int,
    token: str,
    ip_address: str | None = None,
    user_agent: str | None = None,
) -> Session:
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=settings.JWT_EXPIRES_MIN)
    row = Session(
        user_id=user_id,
        token_hash=hash_token(token),
        ip_address=ip_address,
        user_agent=user_agent,
        expires_at=expires_at,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def invalidate_session(db: DBSession, token: str) -> bool:
    th = hash_token(token)
    row = db.scalar(select(Session).where(Session.token_hash == th))
    if not row:
        return False
    db.delete(row)
    db.commit()
    return True


def invalidate_all_for_user(db: DBSession, user_id: int) -> int:
    rows = db.scalars(select(Session).where(Session.user_id == user_id)).all()
    for r in rows:
        db.delete(r)
    db.commit()
    return len(rows)


def validate_session(db: DBSession, token: str) -> bool:
    th = hash_token(token)
    row = db.scalar(
        select(Session).where(
            Session.token_hash == th,
            Session.expires_at > datetime.now(timezone.utc),
        )
    )
    return row is not None
