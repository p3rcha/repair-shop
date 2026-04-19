# Repair Shop

A small, containerized web app to manage vehicle repair estimates. FastAPI + Postgres backend, React + shadcn frontend, all wired together with Docker Compose.

## Stack

- **Backend:** Python 3.12, FastAPI, SQLAlchemy 2, Postgres 16, JWT + bcrypt + httpOnly cookies, Scalar API docs
- **Frontend:** React 19 + Vite, shadcn (`radix-sera` preset) on Tailwind v4, react-hook-form + zod, Bun
- **Infra:** Docker Compose (`db`, `api`, `web`)

## Prerequisites

- Docker Desktop (or any Docker engine + `docker compose` v2)

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
| http://localhost:8000/docs       | Scalar API docs                            |
| http://localhost:8000/openapi.json | OpenAPI schema                           |
| postgres://localhost:5432        | Postgres (exposed for local inspection)    |

### Default credentials

- Username: `admin`
- Password: `admin123`

Both seeded automatically on first boot. You can also self-register from `POST /auth/register`.

## Auth (note for the reviewer)

JWT (`HS256`) + bcrypt (12 rounds) + **httpOnly cookie** (`auth_token`) + **DB-backed sessions** for real revocation (token is stored as `sha256` in the `sessions` table; logout invalidates the row, so reusing the token after logout returns 401 even if it hasn't expired yet). Refactored from my existing TypeScript template at `do.nationcr/client-backend-main/src/modules/auth/`. The cookie is the primary transport so the React app never has to touch the token; `Authorization: Bearer` is also accepted as a fallback so Scalar/Postman work.

## Environment variables

Each stack has its own `.env` so they can be edited independently. The samples in the repo are committed; the real `.env` files are gitignored.

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
| `JWT_EXPIRES_MIN` | Token + cookie lifetime in minutes (default 10080 = 7 days)                           |
| `COOKIE_SAMESITE` | `lax` (default) or `strict` / `none`                                                  |
| `COOKIE_SECURE`   | `false` for local HTTP; flip to `true` in production over HTTPS                       |
| `CORS_ORIGINS`    | Comma-separated; `http://localhost:5173` for the bundled web container                |

### `frontend/.env`

| Var            | Notes                                                       |
| -------------- | ----------------------------------------------------------- |
| `VITE_API_URL` | Where the browser hits the API. Default `http://localhost:8000`. |

## Walkthrough

1. `docker compose up --build` (~2 min on a cold cache; subsequent boots are seconds)
2. Open http://localhost:5173 → sign in with `admin / admin123`
3. **New estimate** → fill customer + vehicle, pick a category (items load with skeletons because the API intentionally sleeps 0.6s on `/categories/{id}/items` so the demo is visible), tap `+`/`-` to add line items, watch the cart total compute, **Create estimate**
4. The estimate appears in the list. Use the row menu to cycle status `Pending → In progress → Completed`. Use the status filter to narrow the list.
5. Logout from the header. The `auth_token` cookie is cleared and the matching session row is invalidated server-side, so the JWT is dead even before its `exp`.

## API endpoints

| Method  | Path                          | Notes                                         |
| ------- | ----------------------------- | --------------------------------------------- |
| POST    | `/auth/register`              | Open registration                             |
| POST    | `/auth/login`                 | Sets `auth_token` cookie                      |
| POST    | `/auth/logout`                | Invalidates session + clears cookie           |
| GET     | `/auth/me`                    | Cookie or `Authorization: Bearer`             |
| GET     | `/categories`                 | Auth required                                 |
| GET     | `/categories/{id}/items`      | Auth required, sleeps ~0.6s on purpose        |
| GET     | `/estimates?status=...`       | Optional `status` filter                      |
| POST    | `/estimates`                  | Snapshots `unit_price` from `Item.base_price` |
| PATCH   | `/estimates/{id}/status`      | Body `{ "status": "pending\|in_progress\|completed" }` |

Browse and try them all in Scalar at http://localhost:8000/docs.

## Project structure

```
repair-shop/
├── docker-compose.yml         # db + api + web services
├── db/
│   ├── .env.sample            # POSTGRES_USER / PASSWORD / DB
│   └── .env                   # gitignored
├── server/                    # FastAPI backend
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── .env(.sample)
│   └── app/
│       ├── main.py            # FastAPI app, CORS, lifespan, Scalar /docs
│       ├── config.py          # pydantic-settings
│       ├── database.py        # SQLAlchemy engine + SessionLocal
│       ├── models.py          # User, Session, Category, Item, Estimate, EstimateItem
│       ├── schemas.py         # Pydantic v2 request/response models
│       ├── security.py        # bcrypt + JWT + sha256(token) helpers
│       ├── sessions.py        # DB-backed JWT revocation
│       ├── deps.py            # get_db, extract_token (cookie -> bearer), get_current_user
│       ├── seed.py            # idempotent admin + categories + items
│       └── routers/
│           ├── auth.py
│           ├── categories.py
│           └── estimates.py
└── frontend/                  # React + Vite + shadcn (radix-sera) + Bun
    ├── Dockerfile
    ├── package.json
    ├── components.json        # shadcn config
    ├── .env(.sample)
    ├── index.html             # loads Bitcount Grid Double for the LED title
    └── src/
        ├── main.tsx           # BrowserRouter + AuthProvider + Toaster
        ├── App.tsx            # route tree
        ├── App.css            # Tailwind v4 + radix-sera tokens + .led-title
        ├── lib/
        │   ├── api.ts         # apiFetch (credentials: include) + ApiError
        │   ├── auth.tsx       # AuthProvider, useAuth, bootstraps /auth/me
        │   ├── types.ts       # API DTOs
        │   ├── utils.ts       # cn()
        │   └── category-icons.ts  # seed-string -> hugeicon mapping
        ├── components/
        │   ├── StatusBadge.tsx
        │   └── ui/            # shadcn components
        └── routes/
            ├── ProtectedRoute.tsx
            ├── AppLayout.tsx  # LED header + logout
            ├── Login.tsx
            ├── Estimates.tsx  # table + filter + change-status menu
            └── NewEstimate.tsx # categories -> items (with skeletons) -> cart -> submit
```

## Useful commands

```bash
docker compose up --build              # build + run (foreground)
docker compose up -d                   # detached
docker compose logs -f api             # tail backend
docker compose logs -f web             # tail frontend (Vite)
docker compose down                    # stop, keep data
docker compose down -v                 # stop + drop the postgres volume (clean slate)
docker compose exec db psql -U $POSTGRES_USER -d $POSTGRES_DB
```
