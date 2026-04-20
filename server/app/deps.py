from typing import Generator

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session as DBSession

from .database import SessionLocal
from .models import User
from .security import decode_token
from .sessions import validate_session


COOKIE_NAME = "auth_token"


def get_db() -> Generator[DBSession, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def extract_token(request: Request) -> str | None:
    return request.cookies.get(COOKIE_NAME)


def _unauth(detail: str = "Unauthorized") -> HTTPException:
    return HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=detail)


def get_current_user(
    request: Request,
    db: DBSession = Depends(get_db),
) -> User:
    token = extract_token(request)
    if not token:
        raise _unauth()

    payload = decode_token(token)
    if not payload or "sub" not in payload:
        raise _unauth("Invalid token")

    if not validate_session(db, token):
        raise _unauth("Session expired or invalidated")

    try:
        user_id = int(payload["sub"])
    except (TypeError, ValueError):
        raise _unauth("Invalid token")

    user = db.get(User, user_id)
    if not user:
        raise _unauth("User not found")

    return user


def optional_user(
    request: Request,
    db: DBSession = Depends(get_db),
) -> User | None:
    token = extract_token(request)
    if not token:
        return None
    payload = decode_token(token)
    if not payload or "sub" not in payload:
        return None
    if not validate_session(db, token):
        return None
    try:
        user_id = int(payload["sub"])
    except (TypeError, ValueError):
        return None
    return db.get(User, user_id)
