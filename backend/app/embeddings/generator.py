import hashlib
import os
from collections import defaultdict

from sqlalchemy.orm import Session

from ..database.models import Embedding, File, Repository, Symbol
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), ".env"))

PROVIDER = os.getenv("EMBEDDING_PROVIDER", "local").lower()
EMBEDDING_BATCH_SIZE = max(1, int(os.getenv("EMBEDDING_BATCH_SIZE", "64")))
EMBEDDING_MODEL_BATCH_SIZE = max(1, int(os.getenv("EMBEDDING_MODEL_BATCH_SIZE", "32")))
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

_local_model = None
_openai_client = None
_gemini_client = None


def get_local_model():
    global _local_model
    if _local_model is None:
        try:
            from sentence_transformers import SentenceTransformer

            _local_model = SentenceTransformer("all-MiniLM-L6-v2")
        except Exception as exc:
            print(f"Error loading local sentence-transformers: {exc}")
            raise exc
    return _local_model


def get_openai_client():
    global _openai_client
    if _openai_client is None:
        if not OPENAI_API_KEY:
            raise ValueError("OPENAI_API_KEY is not set.")
        from openai import OpenAI  # type: ignore

        _openai_client = OpenAI(api_key=OPENAI_API_KEY)
    return _openai_client


def get_gemini_client():
    global _gemini_client
    if _gemini_client is None:
        if not GEMINI_API_KEY:
            raise ValueError("GEMINI_API_KEY is not set.")
        import google.generativeai as genai  # type: ignore

        genai.configure(api_key=GEMINI_API_KEY)
        _gemini_client = genai
    return _gemini_client


def generate_embedding(text: str) -> list:
    """Generate a dense vector embedding, with the existing zero-vector fallback."""
    if not text.strip():
        return [0.0] * (384 if PROVIDER == "local" else 1536)

    try:
        if PROVIDER == "gemini":
            client = get_gemini_client()
            response = client.embed_content(
                model="models/text-embedding-004",
                content=text,
                task_type="retrieval_document",
            )
            return response["embedding"][0]

        if PROVIDER == "openai":
            client = get_openai_client()
            response = client.embeddings.create(
                model="text-embedding-3-small",
                input=[text],
            )
            return response.data[0].embedding

        model = get_local_model()
        vector = model.encode(text, convert_to_numpy=True)
        return vector.tolist() if hasattr(vector, "tolist") else vector
    except Exception as exc:
        print(f"Embedding generation failed: {exc}. Falling back to zero-vector.")
        dimension = 384 if PROVIDER == "local" else (768 if PROVIDER == "gemini" else 1536)
        return [0.0] * dimension


def _embedding_hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8", errors="ignore")).hexdigest()


def _semantic_entities(db: Session, repo: Repository) -> list[dict]:
    """Build the same README and symbol corpus used by the previous indexer."""
    entities = []
    readme_file = db.query(File).filter(
        File.repo_id == repo.id,
        File.filename.ilike("README.md"),
    ).first()
    if readme_file:
        entities.append({
            "entity_type": "readme",
            "entity_id": readme_file.id,
            "path": readme_file.path,
            "text": f"README: {readme_file.path}",
        })

    for symbol in db.query(Symbol).filter(Symbol.repo_id == repo.id).all():
        file_path = symbol.file.path if symbol.file else "unknown"
        entities.append({
            "entity_type": "symbol",
            "entity_id": symbol.id,
            "path": file_path,
            "text": (
                f"Symbol: {symbol.name} (Type: {symbol.type}) in file: {file_path}\n"
                f"Code snippet: {symbol.raw_code[:200] if symbol.raw_code else ''}"
            ),
        })
    return entities


def _persist_embeddings(db: Session, repo: Repository, entities: list[dict], vectors: list[list[float]]) -> None:
    for entity, vector in zip(entities, vectors):
        db.add(Embedding(
            repo_id=repo.id,
            entity_type=entity["entity_type"],
            entity_id=entity["entity_id"],
            path=entity["path"],
            vector_data=vector,
            text_content=entity["text"],
            content_hash=entity["content_hash"],
        ))
    db.commit()


def index_repository_embeddings(db: Session, repo: Repository, progress_callback=None) -> dict:
    """Reuse unchanged semantic units and generate only new or changed embeddings.

    Existing rows are retained until replacement rows have been persisted. Legacy rows
    without ``content_hash`` are migrated from their stored text when possible.
    """
    if progress_callback:
        progress_callback("Preparing semantic index...", 0.0)

    existing = db.query(Embedding).filter(Embedding.repo_id == repo.id).all()
    cached_by_key = defaultdict(list)
    for item in existing:
        if item.content_hash is None and item.text_content:
            item.content_hash = _embedding_hash(item.text_content)
        if item.content_hash:
            cached_by_key[(item.entity_type, item.path, item.content_hash)].append(item)
    db.commit()

    entities = _semantic_entities(db, repo)
    pending = []
    used_ids = set()
    reused = 0
    for entity in entities:
        entity["content_hash"] = _embedding_hash(entity["text"])
        candidates = cached_by_key.get((entity["entity_type"], entity["path"], entity["content_hash"]), [])
        cached_embedding = candidates.pop(0) if candidates else None
        if cached_embedding is not None:
            cached_embedding.entity_id = entity["entity_id"]
            cached_embedding.text_content = entity["text"]
            used_ids.add(cached_embedding.id)
            reused += 1
        else:
            pending.append(entity)

    stale = [item for item in existing if item.id not in used_ids]
    total = len(pending)
    created = 0

    if progress_callback:
        progress_callback(f"Reused {reused} embeddings; {total} need generation", 0.0)

    def store_batch(batch_entities: list[dict], vectors: list[list[float]]) -> None:
        nonlocal created
        _persist_embeddings(db, repo, batch_entities, vectors)
        created += len(batch_entities)

    if PROVIDER == "local" and pending:
        try:
            model = get_local_model()
            for start in range(0, total, EMBEDDING_BATCH_SIZE):
                batch = pending[start:start + EMBEDDING_BATCH_SIZE]
                encoded = model.encode(
                    [entity["text"] for entity in batch],
                    batch_size=EMBEDDING_MODEL_BATCH_SIZE,
                    convert_to_numpy=True,
                    show_progress_bar=False,
                )
                vectors = encoded.tolist() if hasattr(encoded, "tolist") else encoded
                store_batch(batch, vectors)
                if progress_callback:
                    end = min(start + len(batch), total)
                    progress_callback(f"Generated embeddings {end}/{total}", (end / total) * 100)
            pending = []
        except Exception as exc:
            print(f"Batch embedding failed: {exc}. Falling back to individual embeddings.")
            # Any successful batches remain committed; only the unpersisted tail is retried.
            persisted_hashes = {
                item.content_hash
                for item in db.query(Embedding).filter(Embedding.repo_id == repo.id).all()
                if item.content_hash
            }
            pending = [entity for entity in pending if entity["content_hash"] not in persisted_hashes]

    if PROVIDER != "local" or pending:
        for start in range(0, len(pending), EMBEDDING_BATCH_SIZE):
            batch = pending[start:start + EMBEDDING_BATCH_SIZE]
            vectors = [generate_embedding(entity["text"]) for entity in batch]
            store_batch(batch, vectors)
            if progress_callback:
                end = min(start + len(batch), len(pending))
                progress_callback(f"Generated embeddings {end}/{len(pending)}", (end / len(pending)) * 100)

    # Remove obsolete rows only after all replacement rows have been committed.
    for item in stale:
        if item not in db:
            continue
        db.delete(item)
    db.commit()
    return {"embeddings_created": created, "embeddings_reused": reused}
