import os
from datetime import datetime
from sqlalchemy import Column, DateTime, ForeignKey, Index, Integer, JSON, String, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship

Base = declarative_base()

class Repository(Base):
    __tablename__ = "repositories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    path = Column(String, index=True)
    github_url = Column(String, nullable=True)
    session_id = Column(String, index=True, nullable=True)  # per-browser-tab session UUID
    status = Column(String, default="pending")  # pending, scanning, completed, failed
    error_message = Column(String, nullable=True)
    technologies = Column(JSON, nullable=True)  # Static technology detection results
    features = Column(JSON, nullable=True)      # Statically detected features (auth, payment, database, etc.)
    folder_structure = Column(JSON, nullable=True)
    codebase_summary = Column(JSON, nullable=True)  # AI-generated structured codebase summary (cached)
    created_at = Column(DateTime, default=datetime.utcnow)
    scanned_at = Column(DateTime, nullable=True)
    embedding_status = Column(String, default="pending")  # pending, running, completed, failed

    files = relationship("File", back_populates="repository", cascade="all, delete-orphan")
    folders = relationship("Folder", back_populates="repository", cascade="all, delete-orphan")
    symbols = relationship("Symbol", back_populates="repository", cascade="all, delete-orphan")
    dependencies = relationship("Dependency", back_populates="repository", cascade="all, delete-orphan")
    embeddings = relationship("Embedding", back_populates="repository", cascade="all, delete-orphan")

    __table_args__ = (Index("ix_repositories_session_path", "session_id", "path"),)


class File(Base):
    __tablename__ = "files"

    id = Column(Integer, primary_key=True, index=True)
    repo_id = Column(Integer, ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False)
    path = Column(String, index=True)  # Relative path
    filename = Column(String)
    extension = Column(String)
    importance_score = Column(Integer)  # File ranking score (0-100)
    hash = Column(String)  # SHA256 of code content
    size_bytes = Column(Integer, default=0)
    mtime_ns = Column(Integer, default=0)
    imports_cache = Column(JSON, nullable=True)
    feature_flags = Column(JSON, nullable=True)
    
    # 2.0 Complexity & Metrics Columns
    lines_of_code = Column(Integer, default=0)
    complexity_score = Column(Integer, default=0)  # Cyclomatic index
    fan_in = Column(Integer, default=0)            # Count of files importing this file
    fan_out = Column(Integer, default=0)           # Count of imports inside this file
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    repository = relationship("Repository", back_populates="files")
    symbols = relationship("Symbol", back_populates="file", cascade="all, delete-orphan")

    __table_args__ = (Index("ix_files_repo_path", "repo_id", "path"),)


class Folder(Base):
    __tablename__ = "folders"

    id = Column(Integer, primary_key=True, index=True)
    repo_id = Column(Integer, ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False)
    path = Column(String, index=True)  # Relative path
    folder_name = Column(String)
    parent_path = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    repository = relationship("Repository", back_populates="folders")

    __table_args__ = (Index("ix_folders_repo_path", "repo_id", "path"),)


class Symbol(Base):
    __tablename__ = "symbols"

    id = Column(Integer, primary_key=True, index=True)
    repo_id = Column(Integer, ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False)
    file_id = Column(Integer, ForeignKey("files.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, index=True)
    type = Column(String, index=True)  # class, function, method, interface, route, enum
    line_start = Column(Integer)
    line_end = Column(Integer)
    raw_code = Column(Text, nullable=True)
    summary = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    repository = relationship("Repository", back_populates="symbols")
    file = relationship("File", back_populates="symbols")

    __table_args__ = (Index("ix_symbols_repo_file", "repo_id", "file_id"),)


class Dependency(Base):
    __tablename__ = "dependencies"

    id = Column(Integer, primary_key=True, index=True)
    repo_id = Column(Integer, ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False)
    from_file_path = Column(String, index=True)  # E.g. "src/auth.ts"
    to_file_path = Column(String, index=True)    # E.g. "src/database.ts"
    dependency_type = Column(String, default="import")  # import, reference
    created_at = Column(DateTime, default=datetime.utcnow)

    repository = relationship("Repository", back_populates="dependencies")

    __table_args__ = (
        Index("ix_dependencies_repo_from", "repo_id", "from_file_path"),
        Index("ix_dependencies_repo_to", "repo_id", "to_file_path"),
    )


class Embedding(Base):
    __tablename__ = "embeddings"

    id = Column(Integer, primary_key=True, index=True)
    repo_id = Column(Integer, ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False)
    entity_type = Column(String)  # readme, file, folder, symbol, route
    entity_id = Column(Integer)  # Reference ID
    path = Column(String)  # Entity path
    vector_data = Column(JSON)  # Vector coordinates
    text_content = Column(Text)
    content_hash = Column(String, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    repository = relationship("Repository", back_populates="embeddings")

    __table_args__ = (Index("ix_embeddings_repo_hash", "repo_id", "content_hash"),)
