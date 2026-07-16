import re
from sqlalchemy.orm import Session
from ..database.models import Repository, Symbol, Dependency, File

# Regexes for intent detection
DOCKER_QUERY = re.compile(r'\bdocker\b|\bdockerfile\b|\bcompose\b', re.I)
AUTH_QUERY = re.compile(r'\bauthentication\b|\bauth\b|\blogin\b|\bsignin\b|\bjwt\b', re.I)
PAYMENT_QUERY = re.compile(r'\bstripe\b|\bpayment\b|\bpaypal\b|\bbilling\b', re.I)
REDIS_QUERY = re.compile(r'\bredis\b|\bcache\b', re.I)

SYMBOL_WHERE_QUERY = re.compile(r'where\s+is\s+(?:function|class|method|route|symbol)?\s*([A-Za-z0-9_$]+)\s+(?:defined|implemented|located)', re.I)
SYMBOL_WHAT_QUERY = re.compile(r'what\s+does\s+(?:function|class|method|route|symbol)?\s*([A-Za-z0-9_$]+)\s+do', re.I)

DEPENDENCY_QUERY = re.compile(r'what\s+(?:files\s+)?depend\s+on\s+([A-Za-z0-9_.-]+)', re.I)
DEPENDENCY_IMPACT_QUERY = re.compile(r'what\s+breaks\s+if\s+I\s+(?:delete|remove|change|edit)\s+([A-Za-z0-9_.-]+)', re.I)

def route_user_query(db: Session, repo_id: int, query: str) -> str:
    """
    Evaluates query intent statically. If it matches a fact structure,
    it returns an instant answer without querying the LLM (0 tokens).
    Otherwise returns None to fall back to Groq RAG.
    """
    repo = db.query(Repository).filter(Repository.id == repo_id).first()
    if not repo:
        return "Repository not found."
        
    features = repo.features or {}
    techs = repo.technologies or {}
    
    # 1. Dependency / Impact queries
    # E.g. "what breaks if I delete auth.ts?"
    dep_match = DEPENDENCY_QUERY.search(query) or DEPENDENCY_IMPACT_QUERY.search(query)
    if dep_match:
        target_name = dep_match.group(1).strip()
        # Find matching file path
        all_files = db.query(File).filter(File.repo_id == repo_id).all()
        target_file = next((f for f in all_files if target_name in f.path or f.filename == target_name), None)
        
        if not target_file:
            return f"Could not locate a file named '{target_name}' in the repository index."
            
        # Find files that import this file
        inward_deps = db.query(Dependency).filter(
            Dependency.repo_id == repo_id,
            Dependency.to_file_path == target_file.path
        ).all()
        
        if not inward_deps:
            return f"🔍 **Static Analysis Report**: No files directly import or depend on `{target_file.path}`. You can likely refactor or delete it with zero dependency conflicts."
            
        dep_paths = [f"`{d.from_file_path}`" for d in inward_deps]
        return f"⚠️ **Impact Assessment (Static Analysis)**:\nIf you edit or delete `{target_file.path}`, it could impact **{len(inward_deps)}** file(s) that import it:\n" + "\n".join([f"- {path}" for path in dep_paths])

    # 2. Symbol location queries
    # E.g. "where is function login defined?"
    where_match = SYMBOL_WHERE_QUERY.search(query) or SYMBOL_WHAT_QUERY.search(query)
    if where_match:
        symbol_name = where_match.group(1).strip()
        matching_symbols = db.query(Symbol).filter(
            Symbol.repo_id == repo_id,
            Symbol.name.ilike(symbol_name)
        ).all()
        
        if not matching_symbols:
            # Fallback check if it's a file name
            file_match = db.query(File).filter(File.repo_id == repo_id, File.filename.ilike(f"%{symbol_name}%")).first()
            if file_match:
                return f"🔍 **Static Symbol Finder**: Found a file named `{file_match.filename}` located at: `{file_match.path}`."
            return f"🔍 **Static Symbol Finder**: Could not find a class, function, or route named '{symbol_name}' in the AST index."
            
        answers = []
        for sym in matching_symbols:
            file_path = sym.file.path if sym.file else "unknown"
            answers.append(f"- **{sym.type.capitalize()}** `{sym.name}` is defined in `{file_path}` (Lines {sym.line_start}-{sym.line_end}).")
        return "🔍 **Static Symbol Finder**:\n" + "\n".join(answers)

    # 3. Simple feature boolean checks
    # E.g. "does it use docker?"
    if "docker" in query.lower() and DOCKER_QUERY.search(query):
        status = "Yes" if features.get("docker") or techs.get("docker") else "No"
        return f"🐳 **Docker Feature Check**: **{status}**. " + ("Found Dockerfile or docker-compose.yml configuration files." if status == "Yes" else "No Docker configurations were detected.")
        
    if "auth" in query.lower() and AUTH_QUERY.search(query):
        status = "Yes" if features.get("authentication") or techs.get("auth") != "Unknown" else "No"
        auth_type = techs.get("auth") if techs.get("auth") != "Unknown" else "unspecified library"
        return f"🔑 **Auth Feature Check**: **{status}**. " + (f"Detected authentication using **{auth_type}**." if status == "Yes" else "No authentication configurations were statically matched.")

    if "payment" in query.lower() and PAYMENT_QUERY.search(query):
        status = "Yes" if features.get("payments") else "No"
        return f"💳 **Payments Feature Check**: **{status}**. " + ("Detected Stripe, PayPal, or billing integrations in code imports." if status == "Yes" else "No payment libraries are imported.")

    if "redis" in query.lower() and REDIS_QUERY.search(query):
        status = "Yes" if features.get("redis") or techs.get("database") == "Redis" else "No"
        return f"⚡ **Caching Feature Check**: **{status}**. " + ("Detected Redis/ioredis caching modules." if status == "Yes" else "No Redis configurations were found.")

    return None
