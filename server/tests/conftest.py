import os
from collections.abc import Generator

os.environ.setdefault(
    "DATABASE_URL", "sqlite+pysqlite:///:memory:?cache=shared"
)
os.environ.setdefault("JWT_SECRET", "test-secret-test-secret-test-secret-1234")
os.environ.setdefault("JWT_ALG", "HS256")
os.environ.setdefault("JWT_EXPIRES_MIN", "60")
os.environ.setdefault("COOKIE_SAMESITE", "lax")
os.environ.setdefault("COOKIE_SECURE", "false")
os.environ.setdefault("CORS_ORIGINS", "http://localhost:5173")

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session as DBSession, sessionmaker
from sqlalchemy.pool import StaticPool

from app import database
from app.database import Base
from app.deps import get_db
from app.limiter import limiter
from app.main import app


TEST_ENGINE = create_engine(
    "sqlite+pysqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
    future=True,
)
TestingSessionLocal = sessionmaker(
    bind=TEST_ENGINE, autoflush=False, autocommit=False, future=True
)


@pytest.fixture(autouse=True)
def _disable_rate_limit():
    """Tests would otherwise trip the 5/minute login limit."""
    previous = limiter.enabled
    limiter.enabled = False
    try:
        yield
    finally:
        limiter.enabled = previous


@pytest.fixture(autouse=True)
def _reset_schema():
    """Fresh schema (and lifespan-loaded seed data is irrelevant here) per test."""
    Base.metadata.drop_all(bind=TEST_ENGINE)
    Base.metadata.create_all(bind=TEST_ENGINE)

    database.engine = TEST_ENGINE
    database.SessionLocal = TestingSessionLocal

    def _override_get_db() -> Generator[DBSession, None, None]:
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = _override_get_db
    try:
        yield
    finally:
        app.dependency_overrides.pop(get_db, None)


@pytest.fixture
def db() -> Generator[DBSession, None, None]:
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client() -> Generator[TestClient, None, None]:
    """Bare client. We deliberately skip TestClient context-manager behavior so
    the FastAPI lifespan (which runs the admin/category seed) does not fire
    against the in-memory test DB."""
    yield TestClient(app)


@pytest.fixture
def auth_client(client: TestClient) -> TestClient:
    """Client with a registered + logged-in user (cookie-authenticated)."""
    res = client.post(
        "/auth/register",
        json={"username": "tester", "password": "secret123"},
    )
    assert res.status_code == 201, res.text
    return client
