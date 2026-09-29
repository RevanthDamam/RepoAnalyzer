import os
from sqlalchemy.orm import Session
from ..database.models import File, Folder, Symbol, Embedding, Repository
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), ".env"))

PROVIDER = os.getenv("EMBEDDING_PROVIDER", "local").lower()
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
            _local_model = SentenceTransformer('all-MiniLM-L6-v2')
        except Exception as e:
            print(f"Error loading local sentence-transformers: {e}")
            raise e
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
    """Generates a dense vector embedding representation for the given text."""
    if not text.strip():
        return [0.0] * (384 if PROVIDER == "local" else 1536)
        
    try:
        if PROVIDER == "gemini":
            client = get_gemini_client()
            response = client.embed_content(
                model="models/text-embedding-004",
                content=text,
                task_type="retrieval_document"
            )
            return response['embedding'][0]
            
        elif PROVIDER == "openai":
            client = get_openai_client()
            response = client.embeddings.create(
                model="text-embedding-3-small",
                input=[text]
            )
            return response.data[0].embedding
            
        else: # local
            model = get_local_model()
            emb = model.encode(text, convert_to_numpy=True)
            return emb.tolist()
            
    except Exception as e:
        print(f"Embedding generation failed: {e}. Falling back to zero-vector.")
        dim = 384 if PROVIDER == "local" else (768 if PROVIDER == "gemini" else 1536)
        return [0.0] * dim

def index_repository_embeddings(db: Session, repo: Repository, progress_callback=None) -> None:
    """
    Stage 6: Generates embeddings for README, folder summaries, file summaries, and symbol structures.
    """
    if progress_callback:
        progress_callback("Clearing old embeddings...", 0.0)
        
    db.query(Embedding).filter(Embedding.repo_id == repo.id).delete()
    db.commit()
    
    entities_to_embed = []
    
    # 1. README
    readme_file = db.query(File).filter(File.repo_id == repo.id, File.filename.ilike("README.md")).first()
    if readme_file:
        entities_to_embed.append({
            "entity_type": "readme",
            "entity_id": readme_file.id,
            "path": readme_file.path,
            "text": f"README: {readme_file.path}"
        })
        
    # 4. Symbol Definitions (2.0 Addition!)
    symbols = db.query(Symbol).filter(Symbol.repo_id == repo.id).all()
    for sym in symbols:
        file_path = sym.file.path if sym.file else "unknown"
        entities_to_embed.append({
            "entity_type": "symbol",
            "entity_id": sym.id,
            "path": file_path,
            "text": f"Symbol: {sym.name} (Type: {sym.type}) in file: {file_path}\nCode snippet: {sym.raw_code[:200] if sym.raw_code else ''}"
        })
        
    total_entities = len(entities_to_embed)
    
    for idx, ent in enumerate(entities_to_embed):
        if progress_callback:
            progress_callback(
                f"Generating embeddings {idx+1}/{total_entities}: {ent['path']}",
                (idx / total_entities) * 100
            )
            
        vector = generate_embedding(ent["text"])
        
        db_emb = Embedding(
            repo_id=repo.id,
            entity_type=ent["entity_type"],
            entity_id=ent["entity_id"],
            path=ent["path"],
            vector_data=vector,
            text_content=ent["text"]
        )
        db.add(db_emb)
        
        if idx % 20 == 0:
            db.commit()
            
    db.commit()
