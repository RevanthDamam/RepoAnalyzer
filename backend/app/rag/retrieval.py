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

def retrieve_exact_files(db: Session, repo_id: int, query: str) -> str:
    """
    Looks for file name matches in the user query and injects 
    their compressed code content directly into the context.
    """
    db_files = db.query(File).filter(File.repo_id == repo_id).all()
    extra_context = []
    
    query_lower = query.lower()
    for f in db_files:
        if f.filename.lower() in query_lower or (f.path.lower() in query_lower and len(f.path) > 3):
            if f.raw_content_compressed:
                extra_context.append(f"=== Compressed Source Code of {f.path} ===\n{f.raw_content_compressed}\n")
                
    return "\n".join(extra_context)
