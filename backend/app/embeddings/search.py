import numpy as np
from sqlalchemy.orm import Session
from ..database.models import Embedding
from .generator import generate_embedding

def search_embeddings(db: Session, repo_id: int, query: str, top_k: int = 8) -> list:
    """
    Search vector embeddings using fast numpy-based cosine similarity.
    Works independently of PostgreSQL database plugins/extensions.
    """
    query_vector = generate_embedding(query)
    query_np = np.array(query_vector)
    
    db_embs = db.query(Embedding).filter(Embedding.repo_id == repo_id).all()
    if not db_embs:
        return []
        
    results = []
    for emb in db_embs:
        if not emb.vector_data:
            continue
            
        emb_np = np.array(emb.vector_data)
        
        # Avoid size mismatch
        if len(query_np) != len(emb_np):
            continue
            
        dot_product = np.dot(query_np, emb_np)
        norm_q = np.linalg.norm(query_np)
        norm_e = np.linalg.norm(emb_np)
        
        if norm_q == 0 or norm_e == 0:
            similarity = 0.0
        else:
            similarity = float(dot_product / (norm_q * norm_e))
            
        results.append({
            "id": emb.id,
            "entity_type": emb.entity_type,
            "entity_id": emb.entity_id,
            "path": emb.path,
            "text_content": emb.text_content,
            "similarity": similarity
        })
        
    results.sort(key=lambda x: x["similarity"], reverse=True)
    return results[:top_k]
