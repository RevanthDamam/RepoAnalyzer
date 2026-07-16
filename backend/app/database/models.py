import os
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship

Base = declarative_base()

class Repository(Base):
    __tablename__ = "repositories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    path = Column(String, unique=True, index=True)
    github_url = Column(String, nullable=True)
    status = Column(String, default="pending")  # pending, scanning, completed, failed
    error_message = Column(String, nullable=True)
    technologies = Column(JSON, nullable=True)  # Static technology detection results
    features = Column(JSON, nullable=True)      # Statically detected features (auth, payment, database, etc.)
    folder_structure = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    scanned_at = Column(DateTime, nullable=True)

    files = relationship("File", back_populates="repository", cascade="all, delete-orphan")
    folders = relationship("Folder", back_populates="repository", cascade="all, delete-orphan")
    symbols = relationship("Symbol", back_populates="repository", cascade="all, delete-orphan")
    dependencies = relationship("Dependency", back_populates="repository", cascade="all, delete-orphan")
    embeddings = relationship("Embedding", back_populates="repository", cascade="all, delete-orphan")

class File(Base):
    __tablename__ = "files"

    id = Column(Integer, primary_key=True, index=True)
    repo_id = Column(Integer, ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False)
    path = Column(String, index=True)  # Relative path
    filename = Column(String)
    extension = Column(String)
    importance_score = Column(Integer)  # File ranking score (0-100)
    hash = Column(String)  # SHA256 of code content
    summary = Column(Text, nullable=True)  # AI summary
    raw_content_compressed = Column(Text, nullable=True)  # Stage 10 compressed text (no comments/spaces)
    
    # 2.0 Complexity & Metrics Columns
    lines_of_code = Column(Integer, default=0)
    complexity_score = Column(Integer, default=0)  # Cyclomatic index
    fan_in = Column(Integer, default=0)            # Count of files importing this file
    fan_out = Column(Integer, default=0)           # Count of imports inside this file
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    repository = relationship("Repository", back_populates="files")
    symbols = relationship("Symbol", back_populates="file", cascade="all, delete-orphan")

class Folder(Base):
    __tablename__ = "folders"

    id = Column(Integer, primary_key=True, index=True)
    repo_id = Column(Integer, ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False)
    path = Column(String, index=True)  # Relative path
    folder_name = Column(String)
    summary = Column(Text, nullable=True)  # AI folder summary
    parent_path = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    repository = relationship("Repository", back_populates="folders")

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

class Dependency(Base):
    __tablename__ = "dependencies"

    id = Column(Integer, primary_key=True, index=True)
    repo_id = Column(Integer, ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False)
    from_file_path = Column(String, index=True)  # E.g. "src/auth.ts"
    to_file_path = Column(String, index=True)    # E.g. "src/database.ts"
    dependency_type = Column(String, default="import")  # import, reference
    created_at = Column(DateTime, default=datetime.utcnow)

    repository = relationship("Repository", back_populates="dependencies")

class Embedding(Base):
    __tablename__ = "embeddings"

    id = Column(Integer, primary_key=True, index=True)
    repo_id = Column(Integer, ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False)
    entity_type = Column(String)  # readme, file, folder, symbol, route
    entity_id = Column(Integer)  # Reference ID
    path = Column(String)  # Entity path
    vector_data = Column(JSON)  # Vector coordinates
    text_content = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    repository = relationship("Repository", back_populates="embeddings")
