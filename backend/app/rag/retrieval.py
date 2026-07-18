from sqlalchemy.orm import Session
from ..database.models import File
from ..embeddings.search import search_embeddings

def build_context_from_results(db: Session, repo_id: int, search_results: list) -> str:
    """Formats vector search outputs into a clean context string."""
    context_parts = []
    seen = set()
    
    for res in search_results:
        key = f"{res['entity_type']}_{res['entity_id']}"
        if key in seen:
            continue
        seen.add(key)
        
        sim = res['similarity']
        if res['entity_type'] == 'readme':
            context_parts.append(f"=== README (Similarity: {sim:.2f}) ===\n{res['text_content']}\n")
        elif res['entity_type'] == 'folder':
            context_parts.append(f"=== Directory: {res['path']} (Similarity: {sim:.2f}) ===\n{res['text_content']}\n")
        elif res['entity_type'] == 'file':
            context_parts.append(f"=== File Summary: {res['path']} (Similarity: {sim:.2f}) ===\n{res['text_content']}\n")
        elif res['entity_type'] == 'symbol':
            context_parts.append(f"=== Code Symbol in {res['path']} (Similarity: {sim:.2f}) ===\n{res['text_content']}\n")
            
    return "\n".join(context_parts)

def retrieve_exact_files(db: Session, repo_id: int, query: str, repo_path: str = None) -> str:
    """
    Looks for file name matches in the user query and injects 
    their actual code content directly into the context by reading from disk.
    """
    db_files = db.query(File).filter(File.repo_id == repo_id).all()
    extra_context = []
    
    # If repo_path not provided, try to resolve from DB
    if not repo_path:
        from ..database.models import Repository
        repo = db.query(Repository).filter(Repository.id == repo_id).first()
        repo_path = repo.path if repo else None
        
    if not repo_path:
        return ""
        
    query_lower = query.lower()
    for f in db_files:
        if f.filename.lower() in query_lower or (f.path.lower() in query_lower and len(f.path) > 3):
            full_path = os.path.join(repo_path, f.path)
            if os.path.exists(full_path):
                try:
                    with open(full_path, "r", encoding="utf-8", errors="ignore") as fh:
                        content = fh.read()
                    # Truncate large files slightly to fit token limits gracefully
                    truncated_content = content[:6000] + "\n[Truncated...]" if len(content) > 6000 else content
                    extra_context.append(f"=== Source Code of {f.path} ===\n{truncated_content}\n")
                except Exception:
                    continue
                
    return "\n".join(extra_context)
