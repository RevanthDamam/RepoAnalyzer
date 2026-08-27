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
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False, "timeout": 30},
    )
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
    file_columns = {c["name"] for c in inspector.get_columns("files")} if "files" in existing_tables else set()
    embedding_columns = {c["name"] for c in inspector.get_columns("embeddings")} if "embeddings" in existing_tables else set()

    with engine.begin() as conn:
        if "session_id" not in repo_columns:
            conn.execute(text("ALTER TABLE repositories ADD COLUMN session_id VARCHAR"))
            print("[migrate_db] Added session_id column to repositories table.")
        if "embedding_status" not in repo_columns:
            conn.execute(text("ALTER TABLE repositories ADD COLUMN embedding_status VARCHAR DEFAULT 'pending'"))
            print("[migrate_db] Added embedding_status column to repositories table.")
        if "size_bytes" not in file_columns:
            conn.execute(text("ALTER TABLE files ADD COLUMN size_bytes INTEGER DEFAULT 0"))
            print("[migrate_db] Added size_bytes column to files table.")
        if "mtime_ns" not in file_columns:
            conn.execute(text("ALTER TABLE files ADD COLUMN mtime_ns INTEGER DEFAULT 0"))
            print("[migrate_db] Added mtime_ns column to files table.")
        if "imports_cache" not in file_columns:
            conn.execute(text("ALTER TABLE files ADD COLUMN imports_cache JSON"))
            print("[migrate_db] Added imports_cache column to files table.")
        if "feature_flags" not in file_columns:
            conn.execute(text("ALTER TABLE files ADD COLUMN feature_flags JSON"))
            print("[migrate_db] Added feature_flags column to files table.")
        if "content_hash" not in embedding_columns:
            conn.execute(text("ALTER TABLE embeddings ADD COLUMN content_hash VARCHAR"))
            print("[migrate_db] Added content_hash column to embeddings table.")
        index_definitions = (
            ("repositories", {"session_id", "path"}, "CREATE INDEX IF NOT EXISTS ix_repositories_session_path ON repositories (session_id, path)"),
            ("files", {"repo_id", "path"}, "CREATE INDEX IF NOT EXISTS ix_files_repo_path ON files (repo_id, path)"),
            ("folders", {"repo_id", "path"}, "CREATE INDEX IF NOT EXISTS ix_folders_repo_path ON folders (repo_id, path)"),
            ("symbols", {"repo_id", "file_id"}, "CREATE INDEX IF NOT EXISTS ix_symbols_repo_file ON symbols (repo_id, file_id)"),
            ("dependencies", {"repo_id", "from_file_path"}, "CREATE INDEX IF NOT EXISTS ix_dependencies_repo_from ON dependencies (repo_id, from_file_path)"),
            ("dependencies", {"repo_id", "to_file_path"}, "CREATE INDEX IF NOT EXISTS ix_dependencies_repo_to ON dependencies (repo_id, to_file_path)"),
            ("embeddings", {"repo_id", "content_hash"}, "CREATE INDEX IF NOT EXISTS ix_embeddings_repo_hash ON embeddings (repo_id, content_hash)"),
        )
        current_inspector = inspect(engine)
        table_columns = {
            table: {column["name"] for column in current_inspector.get_columns(table)}
            for table, _, _ in index_definitions
            if table in existing_tables
        }
        for table, required_columns, statement in index_definitions:
            if required_columns.issubset(table_columns.get(table, set())):
                conn.execute(text(statement))

