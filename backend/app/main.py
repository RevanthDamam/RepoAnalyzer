import os

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from .api.routes import router as api_router
from .database.connection import init_db, migrate_db


cors_origins_env = os.getenv("CORS_ORIGINS", "").strip()
allowed_origins_list = (
    [orig.strip().rstrip("/") for orig in cors_origins_env.split(",") if orig.strip()]
    if cors_origins_env
    else ["https://repo-analyzer-eight.vercel.app", "http://localhost:5173", "http://localhost:3000"]
)

app = FastAPI(
    title="RepoAnalyzer 2.0 API",
    description="AST Fact-Graph Codebase Indexing & Semantic QA API",
    docs_url="/docs" if os.getenv("ENVIRONMENT", "development") != "production" else None,
    redoc_url="/redoc" if os.getenv("ENVIRONMENT", "development") != "production" else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins_list,
    allow_origin_regex=r"^https:\/\/.*\.vercel\.app$",
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD", "PATCH"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=600,
)


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    if request.method == "OPTIONS":
        return await call_next(request)
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "no-referrer")
    response.headers.setdefault(
        "Permissions-Policy", "camera=(), microphone=(), geolocation=()"
    )
    response.headers.setdefault("Cache-Control", "no-store")
    return response


@app.get("/")
def read_root():
    return {"status": "ok", "message": "RepoAnalyzer 2.0 API is live"}


@app.get("/health")
def read_health():
    return {"status": "healthy"}


@app.on_event("startup")
def on_startup():
    try:
        init_db()
        migrate_db()
    except Exception as exc:
        print(f"[startup] Warning: Database initialization deferred or failed: {exc}")


app.include_router(api_router)

