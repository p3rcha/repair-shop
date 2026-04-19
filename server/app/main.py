from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from scalar_fastapi import get_scalar_api_reference

from . import seed
from .config import settings
from .routers import auth, categories, estimates


@asynccontextmanager
async def lifespan(app: FastAPI):
    seed.run()
    yield


app = FastAPI(
    title="Repair Shop API",
    docs_url=None,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(categories.router)
app.include_router(estimates.router)


@app.get("/", include_in_schema=False)
def root():
    return {"name": "Repair Shop API", "docs": "/docs"}


@app.get("/docs", include_in_schema=False)
async def scalar_html():
    return get_scalar_api_reference(
        openapi_url=app.openapi_url,
        title="Repair Shop API",
    )
