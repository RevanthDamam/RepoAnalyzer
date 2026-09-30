import os

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from .api.routes import router as api_router
from .database.connection import init_db, migrate_db


# CORS Configuration
# In FastAPI, allow_credentials=True cannot be paired with wildcards.
# We explicitly match allowed origins, regex for all vercel apps, and handle OPTIONS cleanly.
raw_cors = os.getenv("CORS_ORIGINS", "").strip()
allowed_origins = [o.strip().rstrip("/") for o in raw_cors.split(",") if o.strip()]
if not allowed_origins:
    allowed_origins = [
        "https://repo-analyzer-eight.vercel.app",
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
    ]

app = FastAPI(
    title="RepoAnalyzer 2.0 API",
    description="AST Fact-Graph Codebase Indexing & Semantic QA API",
    docs_url="/docs" if os.getenv("ENVIRONMENT", "development") != "production" else None,
    redoc_url="/redoc" if os.getenv("ENVIRONMENT", "development") != "production" else None,
)

# Standard Starlette CORSMiddleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"^https?:\/\/([a-zA-Z0-9_\-]+\.)*(vercel\.app|localhost)(:[0-9]+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=86400,
)


@app.middleware("http")
async def security_headers_middleware(request: Request, call_next):
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "no-referrer")
    response.headers.setdefault(
        "Permissions-Policy", "camera=(), microphone=(), geolocation=()"
    )
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

