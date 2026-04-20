#!/usr/bin/env sh
set -e

echo "[start] running alembic upgrade head"
alembic upgrade head

echo "[start] launching FastAPI dev server"
exec fastapi dev app/main.py --host 0.0.0.0 --port 8000
