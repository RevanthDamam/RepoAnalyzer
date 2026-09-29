import os
from sqlalchemy.orm import Session

from ..database.models import File
from ..security import safe_repo_file

MAX_EXACT_FILE_BYTES = int(os.getenv("MAX_EXACT_FILE_BYTES", "3000"))
MAX_EXACT_CONTEXT_BYTES = int(os.getenv("MAX_EXACT_CONTEXT_BYTES", "10000"))


def build_context_from_results(db: Session, repo_id: int, search_results: list) -> str:
    """Format vector-search outputs into a bounded, clearly delimited context string."""
    context_parts = []
    seen = set()
    total_bytes = 0

    for res in search_results:
        key = f"{res.get('entity_type')}_{res.get('entity_id')}"
        if key in seen:
            continue
        seen.add(key)

        content = str(res.get("text_content") or "")
        remaining = MAX_EXACT_CONTEXT_BYTES - total_bytes
        if remaining <= 0:
            break
        content = content[:remaining]
        sim = float(res.get("similarity", 0.0))
        label = res.get("path") or res.get("entity_type") or "repository context"
        context_parts.append(
            f"=== Untrusted repository context: {label} (Similarity: {sim:.2f}) ===\n{content}\n"
        )
        total_bytes += len(content)

    return "\n".join(context_parts)


def retrieve_exact_files(db: Session, repo_id: int, query: str, repo_path: str = None) -> str:
    """Return only bounded source snippets for indexed files explicitly named in a query."""
    db_files = db.query(File).filter(File.repo_id == repo_id).all()
    extra_context = []
    total_bytes = 0

    if not repo_path:
        from ..database.models import Repository

        repo = db.query(Repository).filter(Repository.id == repo_id).first()
        repo_path = repo.path if repo else None

    if not repo_path:
        return ""

    query_lower = query.lower()
    for file_record in db_files:
        if total_bytes >= MAX_EXACT_CONTEXT_BYTES:
            break
        if not (
            file_record.filename.lower() in query_lower
            or (file_record.path.lower() in query_lower and len(file_record.path) > 3)
        ):
            continue

        try:
            full_path = safe_repo_file(repo_path, file_record.path)
            if full_path.stat().st_size > MAX_EXACT_FILE_BYTES:
                content = full_path.read_text(
                    encoding="utf-8", errors="ignore"
                )[:MAX_EXACT_FILE_BYTES]
                content += "\n[Truncated for safety]"
            else:
                content = full_path.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue

        remaining = MAX_EXACT_CONTEXT_BYTES - total_bytes
        content = content[:remaining]
        extra_context.append(
            f"=== Untrusted source code of {file_record.path} ===\n{content}\n"
        )
        total_bytes += len(content)

    return "\n".join(extra_context)
