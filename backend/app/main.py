from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database.connection import init_db, migrate_db
from .api.routes import router as api_router

app = FastAPI(
    title="RepoAnalyzer 2.0 API", 
    description="AST Fact-Graph Codebase Indexing & Semantic QA API"
)

# CORS middleware bindings
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
    "https://repo-analyzer-eight.vercel.app",
    "http://localhost:5173",
],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Startup routine: initialize SQL database schemas then apply incremental migrations
@app.on_event("startup")
def on_startup():
    init_db()
    migrate_db()

# Mount analytical endpoints router
app.include_router(api_router)

