import os

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from .api.routes import router as api_router
from .database.connection import init_db, migrate_db


def configured_origins() -> list[str]:
    return [
        origin.strip().rstrip("/")
        for origin in os.getenv(
            "CORS_ORIGINS",
            "https://repo-analyzer-eight.vercel.app,http://localhost:5173",
        ).split(",")
        if origin.strip()
    ]


app = FastAPI(
    title="RepoAnalyzer 2.0 API",
    description="AST Fact-Graph Codebase Indexing & Semantic QA API",
    docs_url="/docs" if os.getenv("ENVIRONMENT", "development") != "production" else None,
    redoc_url="/redoc" if os.getenv("ENVIRONMENT", "development") != "production" else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=configured_origins(),
    allow_credentials=False,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "X-Session-ID"],
)


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "no-referrer")
    response.headers.setdefault(
        "Permissions-Policy", "camera=(), microphone=(), geolocation=()"
    )
    response.headers.setdefault("Cache-Control", "no-store")
    return response


@app.on_event("startup")
def on_startup():
    init_db()
    migrate_db()


app.include_router(api_router)
