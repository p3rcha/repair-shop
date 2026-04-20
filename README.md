# Repair Shop

A small, containerized web app to manage vehicle repair estimates. FastAPI + Postgres backend, React + shadcn frontend, all wired together with Docker Compose.

## Stack

- **Backend:** Python 3.12, FastAPI, SQLAlchemy 2 + **Alembic migrations**, Postgres 16, JWT + bcrypt + httpOnly cookies, Scalar API docs, **slowapi** rate limiting, **pytest** with SQLite in-memory fixtures
- **Frontend:** React 19 + Vite, **TanStack React Query**, shadcn (`radix-sera` preset) on Tailwind v4, react-hook-form + zod, Bun
- **Infra:** Docker Compose (`db`, `api`, `web`) with healthchecks
- **CI:** GitHub Actions running `pytest` on every push and PR (`.github/workflows/test.yml`)
- **Deploy:** Production deployment outline in [AWS.md](AWS.md)

## Prerequisites

- Docker

## Run it

```bash
cp db/.env.sample        db/.env
cp server/.env.sample    server/.env
cp frontend/.env.sample  frontend/.env

docker compose up --build
```

| URL                              | What                                       |
| -------------------------------- | ------------------------------------------ |
| http://localhost:5173            | Frontend                                   |
| http://localhost:8000/docs       | API docs                            |
| http://localhost:8000/openapi.json | OpenAPI schema                           |

### Default credentials

- Username: `admin`
- Password: `admin123`

Both seeded automatically on first boot. You can also self-register from `POST /auth/register`.

## Auth

JWT (`HS256`) + bcrypt (12 rounds) + **httpOnly cookie** (`auth_token`) + **DB-backed sessions** for real revocation (token is stored as `sha256` in the `sessions` table; logout invalidates the row, so reusing the token after logout returns 401 even if it hasn't expired yet). Refactored from my existing Auth template I use on **https://donationcr.com**. The cookie is the only transport, so the React app never has to touch the token directly.

## Environment variables

Each stack has its own `.env` so they can be edited independently. Each repo contains the needed `.env` and `.env.sample` respectibly.

### `db/.env`

| Var                 | Notes                                       |
| ------------------- | ------------------------------------------- |
| `POSTGRES_USER`     | Postgres user created on first init         |
| `POSTGRES_PASSWORD` | Password for that user                      |
| `POSTGRES_DB`       | Default database created on first init      |

### `server/.env`

| Var               | Notes                                                                                 |
| ----------------- | ------------------------------------------------------------------------------------- |
| `DATABASE_URL`    | `postgresql+psycopg://USER:PASSWORD@db:5432/DB` — must match `db/.env`                |
| `JWT_SECRET`      | Min 32 chars, validated at boot                                                       |
| `JWT_ALG`         | `HS256`                                                                               |
| `JWT_EXPIRES_MIN` | Token + cookie lifetime in minutes (default: 15 minutes)                           |
| `COOKIE_SAMESITE` | `lax` (default) or `strict` / `none`                                                  |
| `COOKIE_SECURE`   | `false` for local HTTP; flip to `true` in production over HTTPS                       |
| `CORS_ORIGINS`    | Comma-separated; `http://localhost:5173` for the bundled web container                |

### `frontend/.env`

| Var            | Notes                                                       |
| -------------- | ----------------------------------------------------------- |
| `VITE_API_URL` | Where the browser hits the API. Default `http://localhost:8000`. |

## Walkthrough

1. `docker compose up --build`
2. Open http://localhost:5173 → sign in with `admin / admin123`
3. **New estimate** → fill customer + vehicle, pick a category (items load with skeletons because the API intentionally sleeps 0.6s on `/categories/{id}/items` so the demo is visible — hardcoded `await asyncio.sleep(0.6)` at [`server/app/routers/categories.py`](server/app/routers/categories.py#L29), tweak the `0.6` value or remove the line as you wish), tap `+`/`-` to add line items, watch the cart total compute, **Create estimate**
4. The estimate appears in the list. Use the row menu to cycle status `Pending → In progress → Completed`. Use the status filter to narrow the list.
5. Logout from the header. The `auth_token` cookie is cleared and the matching session row is invalidated server-side, so the JWT is dead even before its `exp`.

## API endpoints

| Method  | Path                          | Notes                                                                        |
| ------- | ----------------------------- | ---------------------------------------------------------------------------- |
| GET     | `/healthz`                    | Liveness check, no auth. Used by the compose healthcheck.                    |
| POST    | `/auth/register`              | Open registration                                                            |
| POST    | `/auth/login`                 | Sets `auth_token` cookie. Rate limited: **5/minute** per IP.                 |
| POST    | `/auth/logout`                | Invalidates session + clears cookie                                          |
| GET     | `/auth/me`                    | Returns the current user from the cookie session                             |
| GET     | `/categories`                 | Auth required                                                                |
| GET     | `/categories/{id}/items`      | Auth required, sleeps ~0.6s on purpose                                       |
| GET     | `/estimates?status=&limit=&offset=` | Paginated. `status` optional; `limit` 1..100 (default 20); `offset` ≥0. |
| POST    | `/estimates`                  | Snapshots `unit_price` from `Item.base_price`. Rate limited: **60/minute**.  |
| PATCH   | `/estimates/{id}/status`      | Body `{ "status": "pending\|in_progress\|completed" }`                       |

`GET /estimates` returns `{ "items": [...], "total": N, "limit": L, "offset": O }`.

Browse and try them all at http://localhost:8000/docs.

## Tests

Backend tests live in [`server/tests/`](server/tests/) and run against an in-memory SQLite via a `StaticPool` engine + `app.dependency_overrides[get_db]` — no Postgres required.

```bash
cd server
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
pytest
```

CI runs the same `pytest` invocation on every push and PR via [`.github/workflows/test.yml`](.github/workflows/test.yml).

## Migrations

Schema changes are managed with **Alembic**. The container entry point ([`server/scripts/start.sh`](server/scripts/start.sh)) runs `alembic upgrade head` before booting FastAPI, so a fresh `docker compose up` always lands on the latest schema. To create a new revision locally:

```bash
cd server && source .venv/bin/activate
alembic revision --autogenerate -m "describe the change"
alembic upgrade head
```
