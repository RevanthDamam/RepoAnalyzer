import os
from sqlalchemy import create_engine, text, inspect
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv
from .models import Base

# Load env variables
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), ".env"))

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./repo_analyzer.db")

# Setup database engine
if DATABASE_URL.startswith("sqlite"):
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
else:
    engine = create_engine(DATABASE_URL)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    Base.metadata.create_all(bind=engine)

def migrate_db():
    """
    Safe incremental migration: adds any missing columns to existing databases.
    Called at startup alongside init_db() so both fresh and existing DBs are
    kept in sync without requiring Alembic.
    """
    inspector = inspect(engine)
    # Only run if the repositories table already exists (init_db may have just created it)
    existing_tables = inspector.get_table_names()
    if "repositories" not in existing_tables:
        return

    repo_columns = {c["name"] for c in inspector.get_columns("repositories")}

    with engine.begin() as conn:
        if "session_id" not in repo_columns:
            conn.execute(text("ALTER TABLE repositories ADD COLUMN session_id VARCHAR"))
            print("[migrate_db] Added session_id column to repositories table.")

