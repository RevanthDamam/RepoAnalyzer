import os
import traceback
import subprocess
import shutil
from datetime import datetime
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List

# Imports from new modular backend package
from ..database.connection import get_db
from ..database.models import Repository, File, Folder, Symbol, Dependency, Embedding
from ..scanner.crawler import crawl_repository
from ..scanner.detector import detect_technologies
from ..analysis.feature_detector import detect_repo_features
from ..analysis.dependency import analyze_dependencies
from ..analysis.quality import analyze_codebase_quality
from ..analysis.learning import generate_onboarding_guide
from ..summarizer.folder_summary import run_static_analysis_pipeline
from ..embeddings.generator import index_repository_embeddings
from ..rag.agents import query_repository

router = APIRouter()

# In-memory dictionary to track real-time scanning progress per repo
scan_progress = {}

class ScanRequest(BaseModel):
    path: str
    name: Optional[str] = None
    github_url: Optional[str] = None

class QueryRequest(BaseModel):
    query: str
    mode: Optional[str] = "single"  # single or multi

def bg_scan_repo_v2(repo_id: int, repo_path: str):
    """
    Background thread running the upgraded fact-graph codebase scanner:
    1. Scan files
    2. Score files
    3. Tech static detect
    4. Compile code symbols via AST
    5. Build imports Dependency Graph & metrics
    6. Run Feature detector
    7. AI Summarizations & caching
    8. Generate embeddings (including symbol definitions)
    """
    db = next(get_db())
    repo = db.query(Repository).filter(Repository.id == repo_id).first()
    if not repo:
        return
        
    try:
        def update_progress(message: str, pct: float):
            scan_progress[repo_id] = {"message": message, "percent": round(pct, 1)}
            repo.status = message
            db.commit()
            print(f"[RepoScan {repo_id}] {message} - {pct:.1f}%")

        # 2.0 Git Cloning Check
        is_git_url = repo_path.startswith("http://") or repo_path.startswith("https://") or repo_path.startswith("git@")
        if is_git_url:
            update_progress("Cloning public repository...", 2.0)
            base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            temp_dir = os.path.join(base_dir, "temp_repos", f"repo_{repo_id}").replace("\\", "/")
            os.makedirs(os.path.dirname(temp_dir), exist_ok=True)
            
            if os.path.exists(temp_dir):
                shutil.rmtree(temp_dir, ignore_errors=True)
                
            try:
                subprocess.run(
                    ["git", "clone", "--depth", "1", repo_path, temp_dir],
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True,
                    check=True
                )
                repo_path = temp_dir
                repo.path = temp_dir
                db.commit()
            except Exception as clone_err:
                update_progress(f"Git clone failed: {str(clone_err)}", 0.0)
                repo.status = "failed"
                repo.error_message = f"Git clone failed: {str(clone_err)}"
                db.commit()
                return

        # 1 & 2. Scan & Classify
        update_progress("Crawling files and ranking importance", 10.0)
        scan_results = crawl_repository(repo_path)
        repo.folder_structure = scan_results["folder_tree"]
        db.commit()
        
        # Save files list
        existing_files = {f.path: f for f in db.query(File).filter(File.repo_id == repo.id).all()}
        scanned_paths = set()
        
        for f in scan_results["files"]:
            rel_path = f["path"]
            scanned_paths.add(rel_path)
            
            if rel_path in existing_files:
                db_file = existing_files[rel_path]
                db_file.hash = f["hash"]
                db_file.importance_score = f["importance_score"]
                db_file.filename = f["filename"]
                db_file.extension = f["extension"]
            else:
                db_file = File(
                    repo_id=repo.id,
                    path=rel_path,
                    filename=f["filename"],
                    extension=f["extension"],
                    importance_score=f["importance_score"],
                    hash=f["hash"]
                )
                db.add(db_file)
                
        for path, db_file in existing_files.items():
            if path not in scanned_paths:
                db.delete(db_file)
        db.commit()

        # 3. Static Technology Detection (Manifests check)
        update_progress("Auditing technology manifests", 20.0)
        tech_stack = detect_technologies(repo_path, scan_results["files"])
        repo.technologies = tech_stack
        db.commit()
        
        # 4 & 7. AST extraction & Caching & Static Parsing
        update_progress("Extracting symbols & static metadata", 40.0)
        run_static_analysis_pipeline(db, repo, repo_path, progress_callback=update_progress)
        
        # 5. Build Dependency Graph (fan-in/fan-out metrics)
        update_progress("Building import dependency graph", 65.0)
        analyze_dependencies(db, repo.id)
        
        # 6. Feature Detection (payments, auth, redis, docker checks)
        update_progress("Detecting repository codebase features", 75.0)
        features_dict = detect_repo_features(repo_path, scan_results["files"])
        repo.features = features_dict
        db.commit()

        # 8. Index Embeddings (Folder maps, files, and symbols)
        update_progress("Indexing semantic vector embeddings", 85.0)
        index_repository_embeddings(db, repo, progress_callback=update_progress)

        repo.status = "completed"
        repo.scanned_at = datetime.utcnow()
        db.commit()
        scan_progress[repo_id] = {"message": "completed", "percent": 100.0}
        
    except Exception as e:
        err_msg = f"Scan failed: {str(e)}\n{traceback.format_exc()}"
        print(err_msg)
        repo.status = "failed"
        repo.error_message = str(e)
        db.commit()
        scan_progress[repo_id] = {"message": f"failed: {str(e)}", "percent": 0.0}

@router.post("/api/scan")
def scan_endpoint(req: ScanRequest, bg_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    is_git_url = req.path.startswith("http://") or req.path.startswith("https://") or req.path.startswith("git@")
    
    if is_git_url:
        path = req.path
        name = req.name or req.path.rstrip("/").split("/")[-1].replace(".git", "") or "Git Repo"
        github_url = req.path
    else:
        path = os.path.abspath(req.path).replace("\\", "/")
        if not os.path.exists(path):
            raise HTTPException(status_code=400, detail=f"Path not found: {req.path}")
        name = req.name or os.path.basename(path) or "Unnamed Repo"
        github_url = req.github_url
    
    # Check if repository already indexed
    repo = db.query(Repository).filter(Repository.path == path).first()
    if not repo:
        repo = Repository(
            name=name,
            path=path,
            github_url=github_url,
            status="pending"
        )
        db.add(repo)
        db.commit()
        db.refresh(repo)
        
    repo.status = "pending"
    db.commit()
    scan_progress[repo.id] = {"message": "pending", "percent": 0.0}
    bg_tasks.add_task(bg_scan_repo_v2, repo.id, path)
    
    return {"message": "Scan queued", "repo_id": repo.id, "name": repo.name}

@router.get("/api/repositories")
def get_repositories(db: Session = Depends(get_db)):
    repos = db.query(Repository).order_by(Repository.created_at.desc()).all()
    results = []
    for r in repos:
        progress = scan_progress.get(r.id, {"message": r.status, "percent": 100.0 if r.status == "completed" else 0.0})
        results.append({
            "id": r.id,
            "name": r.name,
            "path": r.path,
            "github_url": r.github_url,
            "status": r.status,
            "error_message": r.error_message,
            "technologies": r.technologies,
            "features": r.features,
            "scanned_at": r.scanned_at,
            "progress": progress
        })
    return results

@router.get("/api/repositories/{repo_id}")
def get_repository_details(repo_id: int, db: Session = Depends(get_db)):
    repo = db.query(Repository).filter(Repository.id == repo_id).first()
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found.")
        
    num_files = db.query(File).filter(File.repo_id == repo_id).count()
    num_folders = db.query(Folder).filter(Folder.repo_id == repo_id).count()
    num_symbols = db.query(Symbol).filter(Symbol.repo_id == repo_id).count()
    num_embeddings = db.query(Embedding).filter(Embedding.repo_id == repo_id).count()
    
    files = db.query(File).filter(File.repo_id == repo_id).order_by(File.importance_score.desc()).all()
    file_list = [{
        "id": f.id,
        "path": f.path,
        "filename": f.filename,
        "extension": f.extension,
        "importance_score": f.importance_score,
        "lines_of_code": f.lines_of_code,
        "complexity_score": f.complexity_score,
    } for f in files]
    
    progress = scan_progress.get(repo_id, {"message": repo.status, "percent": 100.0 if repo.status == "completed" else 0.0})

    return {
        "id": repo.id,
        "name": repo.name,
        "path": repo.path,
        "status": repo.status,
        "technologies": repo.technologies,
        "features": repo.features,
        "folder_structure": repo.folder_structure,
        "progress": progress,
        "statistics": {
            "files_count": num_files,
            "folders_count": num_folders,
            "symbols_count": num_symbols,
            "embeddings_count": num_embeddings
        },
        "files": file_list
    }

@router.delete("/api/repositories/{repo_id}")
def delete_repository(repo_id: int, db: Session = Depends(get_db)):
    repo = db.query(Repository).filter(Repository.id == repo_id).first()
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found.")
    db.delete(repo)
    db.commit()
    if repo_id in scan_progress:
        del scan_progress[repo_id]
    return {"message": "Repository deleted"}

@router.get("/api/repositories/{repo_id}/progress")
def get_scan_progress(repo_id: int):
    if repo_id not in scan_progress:
        db = next(get_db())
        repo = db.query(Repository).filter(Repository.id == repo_id).first()
        if not repo:
            raise HTTPException(status_code=404, detail="Repository not found.")
        return {"message": repo.status, "percent": 100.0 if repo.status == "completed" else 0.0}
    return scan_progress[repo_id]

@router.get("/api/repositories/{repo_id}/file/{file_id}")
def get_file_content_and_summary(repo_id: int, file_id: int, db: Session = Depends(get_db)):
    file_record = db.query(File).filter(File.repo_id == repo_id, File.id == file_id).first()
    if not file_record:
        raise HTTPException(status_code=404, detail="File not found.")
        
    raw_content = ""
    full_path = os.path.join(file_record.repository.path, file_record.path)
    if os.path.exists(full_path):
        try:
            with open(full_path, "r", encoding="utf-8", errors="ignore") as f:
                raw_content = f.read()
        except Exception as e:
            raw_content = f"Failed to read file: {e}"
            
    # Load associated AST symbols
    file_symbols = db.query(Symbol).filter(Symbol.file_id == file_id).all()
    symbols_list = [{
        "name": s.name,
        "type": s.type,
        "line_start": s.line_start,
        "line_end": s.line_end
    } for s in file_symbols]
            
    return {
        "id": file_record.id,
        "path": file_record.path,
        "filename": file_record.filename,
        "extension": file_record.extension,
        "importance_score": file_record.importance_score,
        "lines_of_code": file_record.lines_of_code,
        "complexity_score": file_record.complexity_score,
        "fan_in": file_record.fan_in,
        "fan_out": file_record.fan_out,
        "raw_content": raw_content,
        "symbols": symbols_list
    }

@router.post("/api/repositories/{repo_id}/query")
def query_repo_endpoint(repo_id: int, req: QueryRequest, db: Session = Depends(get_db)):
    return query_repository(db, repo_id, req.query, req.mode)

# ================= 2.0 ADVANCED ANALYTICAL ROUTES =================

@router.get("/api/repositories/{repo_id}/architecture")
def get_repo_architecture(repo_id: int, db: Session = Depends(get_db)):
    """Returns detected APIs, routes, entry points, and structural facts."""
    repo = db.query(Repository).filter(Repository.id == repo_id).first()
    if not repo:
        raise HTTPException(status_code=404, detail="Repo not found")
        
    routes = db.query(Symbol).filter(Symbol.repo_id == repo_id, Symbol.type == "route").all()
    classes = db.query(Symbol).filter(Symbol.repo_id == repo_id, Symbol.type == "class").all()
    
    return {
        "folder_structure": repo.folder_structure,
        "routes": [{"name": r.name, "path": r.file.path if r.file else "unknown", "lines": f"{r.line_start}-{r.line_end}"} for r in routes],
        "classes": [{"name": c.name, "path": c.file.path if c.file else "unknown", "lines": f"{c.line_start}-{c.line_end}"} for c in classes]
    }

@router.get("/api/repositories/{repo_id}/dependencies")
def get_repo_dependencies(repo_id: int, db: Session = Depends(get_db)):
    """Returns all import dependencies mapping codebase relationships."""
    deps = db.query(Dependency).filter(Dependency.repo_id == repo_id).all()
    files = db.query(File).filter(File.repo_id == repo_id).all()
    
    edges = [{"source": d.from_file_path, "target": d.to_file_path} for d in deps]
    nodes = [{"path": f.path, "filename": f.filename, "fan_in": f.fan_in, "fan_out": f.fan_out} for f in files]
    
    return {
        "nodes": nodes,
        "edges": edges
    }

@router.post("/api/repositories/{repo_id}/dependencies/rebuild")
def rebuild_repo_dependencies(repo_id: int, db: Session = Depends(get_db)):
    """Re-runs the static AST dependency analysis for a repository."""
    repo = db.query(Repository).filter(Repository.id == repo_id).first()
    if not repo:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Repository not found")
    analyze_dependencies(db, repo_id)
    deps = db.query(Dependency).filter(Dependency.repo_id == repo_id).all()
    files = db.query(File).filter(File.repo_id == repo_id).all()
    edges = [{"source": d.from_file_path, "target": d.to_file_path} for d in deps]
    nodes = [{"path": f.path, "filename": f.filename, "fan_in": f.fan_in, "fan_out": f.fan_out} for f in files]
    return {"nodes": nodes, "edges": edges}

@router.get("/api/repositories/{repo_id}/quality")
def get_repo_quality(repo_id: int, db: Session = Depends(get_db)):
    """Returns cyclomatic complexity statistics, LOC counters, and code smells lists."""
    return analyze_codebase_quality(db, repo_id)

@router.get("/api/repositories/{repo_id}/learning")
def get_repo_learning_path(repo_id: int, db: Session = Depends(get_db)):
    """Returns a step-by-step codebase onboarding path checklist."""
    return generate_onboarding_guide(db, repo_id)

@router.get("/api/repositories/{repo_id}/manifest")
def get_repo_manifest(repo_id: int, db: Session = Depends(get_db)):
    """Parses requirements.txt and package.json to return categorized dependency manifest."""
    repo = db.query(Repository).filter(Repository.id == repo_id).first()
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")

    # Category map: package name (lowercase) -> {type, language}
    KNOWN_CATEGORIES = {
        # Python - Backend
        "fastapi": {"type": "Framework", "lang": "Python"},
        "uvicorn": {"type": "Server", "lang": "Python"},
        "sqlalchemy": {"type": "ORM", "lang": "Python"},
        "psycopg2": {"type": "Database driver", "lang": "Python"},
        "psycopg2-binary": {"type": "Database driver", "lang": "Python"},
        "python-dotenv": {"type": "Library", "lang": "Python"},
        "groq": {"type": "SDK / Library", "lang": "Python"},
        "numpy": {"type": "Library", "lang": "Python"},
        "sentence-transformers": {"type": "ML Library", "lang": "Python"},
        "google-generativeai": {"type": "SDK / Library", "lang": "Python"},
        "openai": {"type": "SDK / Library", "lang": "Python"},
        "pydantic": {"type": "Data validation", "lang": "Python"},
        "requests": {"type": "HTTP library", "lang": "Python"},
        "pyyaml": {"type": "Library", "lang": "Python"},
        "aiofiles": {"type": "Library", "lang": "Python"},
        "httpx": {"type": "HTTP library", "lang": "Python"},
        "alembic": {"type": "DB migrations", "lang": "Python"},
        "celery": {"type": "Task queue", "lang": "Python"},
        "redis": {"type": "Cache client", "lang": "Python"},
        "boto3": {"type": "AWS SDK", "lang": "Python"},
        "pillow": {"type": "Image library", "lang": "Python"},
        "pytest": {"type": "Testing", "lang": "Python"},
        "black": {"type": "Formatter", "lang": "Python"},
        "mypy": {"type": "Type checker", "lang": "Python"},
        "flake8": {"type": "Linter", "lang": "Python"},
        # JS/TS - Frontend
        "react": {"type": "UI Library", "lang": "JavaScript"},
        "react-dom": {"type": "Library", "lang": "JavaScript"},
        "vite": {"type": "Build tool", "lang": "JavaScript"},
        "typescript": {"type": "Language compiler", "lang": "TypeScript"},
        "lucide-react": {"type": "Component library", "lang": "JavaScript"},
        "oxlint": {"type": "Linter", "lang": "JavaScript"},
        "@vitejs/plugin-react": {"type": "Build plugin", "lang": "JavaScript"},
        "@types/node": {"type": "Type definitions", "lang": "TypeScript"},
        "@types/react": {"type": "Type definitions", "lang": "TypeScript"},
        "@types/react-dom": {"type": "Type definitions", "lang": "TypeScript"},
        "axios": {"type": "HTTP library", "lang": "JavaScript"},
        "next": {"type": "Framework", "lang": "JavaScript"},
        "express": {"type": "Framework", "lang": "JavaScript"},
        "tailwindcss": {"type": "CSS framework", "lang": "CSS"},
        "eslint": {"type": "Linter", "lang": "JavaScript"},
        "prettier": {"type": "Formatter", "lang": "JavaScript"},
        "jest": {"type": "Testing", "lang": "JavaScript"},
        "zustand": {"type": "State management", "lang": "JavaScript"},
        "redux": {"type": "State management", "lang": "JavaScript"},
        "framer-motion": {"type": "Animation library", "lang": "JavaScript"},
    }

    packages = []

    # --- Parse requirements.txt ---
    req_path = os.path.join(repo.path, "requirements.txt")
    # Also check backend/ subdirectory
    if not os.path.exists(req_path):
        req_path = os.path.join(repo.path, "backend", "requirements.txt")

    if os.path.exists(req_path):
        try:
            with open(req_path, "r", encoding="utf-8", errors="ignore") as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith("#"):
                        continue
                    # Strip version specifiers: fastapi>=0.100.0 -> fastapi
                    pkg_name = line.split(">=")[0].split("<=")[0].split("==")[0].split("!=")[0].split("~=")[0].strip()
                    cat = KNOWN_CATEGORIES.get(pkg_name.lower(), {"type": "Library", "lang": "Python"})
                    packages.append({
                        "name": pkg_name,
                        "type": cat["type"],
                        "lang": cat["lang"],
                        "ecosystem": "backend"
                    })
        except Exception:
            pass

    # --- Parse package.json ---
    pkg_path = os.path.join(repo.path, "package.json")
    if not os.path.exists(pkg_path):
        pkg_path = os.path.join(repo.path, "frontend", "package.json")

    if os.path.exists(pkg_path):
        try:
            import json
            with open(pkg_path, "r", encoding="utf-8", errors="ignore") as f:
                pkg_json = json.load(f)
            all_deps = {
                **pkg_json.get("dependencies", {}),
                **pkg_json.get("devDependencies", {})
            }
            for pkg_name in all_deps:
                cat = KNOWN_CATEGORIES.get(pkg_name.lower(), {"type": "Library", "lang": "JavaScript"})
                packages.append({
                    "name": pkg_name,
                    "type": cat["type"],
                    "lang": cat["lang"],
                    "ecosystem": "frontend"
                })
        except Exception:
            pass

    # Group by ecosystem then lang
    backend_pkgs = [p for p in packages if p["ecosystem"] == "backend"]
    frontend_pkgs = [p for p in packages if p["ecosystem"] == "frontend"]

    return {
        "backend": backend_pkgs,
        "frontend": frontend_pkgs,
        "total": len(packages)
    }

@router.get("/api/repositories/{repo_id}/codebase-summary")
def get_codebase_summary(repo_id: int, db: Session = Depends(get_db)):
    """
    Returns AI-generated structured codebase summary.
    Cached on Repository.codebase_summary after first generation.
    """
    repo = db.query(Repository).filter(Repository.id == repo_id).first()
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")

    # Return cached version if available
    if repo.codebase_summary:
        return repo.codebase_summary

    # ── Collect context for prompt ──────────────────────────────────────────
    context_parts = []

    # 1. Repo name & path
    context_parts.append(f"Project name: {repo.name}")
    context_parts.append(f"Local path: {repo.path}")

    # 2. Technology stack
    if repo.technologies:
        tech = repo.technologies
        context_parts.append(f"Primary language: {tech.get('language', 'Unknown')}")
        context_parts.append(f"Other languages: {', '.join(tech.get('languages', []))}")
        context_parts.append(f"Web framework: {tech.get('framework', 'None')}")
        context_parts.append(f"Database: {tech.get('database', 'None')}")
        context_parts.append(f"ORM: {tech.get('orm', 'None')}")
        context_parts.append(f"Testing: {tech.get('testing', 'None')}")
        context_parts.append(f"Docker: {tech.get('docker', False)}")
        context_parts.append(f"Tailwind: {tech.get('tailwind', False)}")

    # 3. Top 30 important files (ranked)
    top_files = db.query(File).filter(File.repo_id == repo_id).order_by(File.importance_score.desc()).limit(30).all()
    if top_files:
        file_lines = [f"  - {f.path} (score={f.importance_score}, LOC={f.lines_of_code})" for f in top_files]
        context_parts.append("Top files by importance:\n" + "\n".join(file_lines))

    # 4. Folder structure (top-level)
    folders = db.query(Folder).filter(Folder.repo_id == repo_id).all()
    top_folders = [f.path for f in folders if f.path.count('/') == 0]
    if top_folders:
        context_parts.append(f"Top-level directories: {', '.join(top_folders)}")

    # 5. Symbols (top 20)
    symbols = db.query(Symbol).filter(Symbol.repo_id == repo_id).limit(20).all()
    if symbols:
        sym_lines = [f"  - {s.type} {s.name}" for s in symbols]
        context_parts.append("Key symbols:\n" + "\n".join(sym_lines))

    # 6. Feature flags
    if repo.features:
        active = [k for k, v in repo.features.items() if v]
        if active:
            context_parts.append(f"Detected features: {', '.join(active)}")

    # 7. README (truncated)
    readme_path = os.path.join(repo.path, "README.md")
    if os.path.exists(readme_path):
        try:
            with open(readme_path, "r", encoding="utf-8", errors="ignore") as f:
                readme = f.read()[:2000]
            context_parts.append(f"README excerpt:\n{readme}")
        except Exception:
            pass

    # 8. requirements.txt
    req_path = os.path.join(repo.path, "requirements.txt")
    if not os.path.exists(req_path):
        req_path = os.path.join(repo.path, "backend", "requirements.txt")
    if os.path.exists(req_path):
        try:
            with open(req_path, "r", encoding="utf-8", errors="ignore") as f:
                context_parts.append(f"Python dependencies:\n{f.read()[:600]}")
        except Exception:
            pass

    # 9. package.json dependencies
    pkg_path = os.path.join(repo.path, "package.json")
    if not os.path.exists(pkg_path):
        pkg_path = os.path.join(repo.path, "frontend", "package.json")
    if os.path.exists(pkg_path):
        try:
            import json as _json
            with open(pkg_path, "r", encoding="utf-8", errors="ignore") as f:
                pkg = _json.load(f)
            all_deps = list({**pkg.get("dependencies", {}), **pkg.get("devDependencies", {})}.keys())
            context_parts.append(f"JS/TS packages: {', '.join(all_deps[:20])}")
        except Exception:
            pass

    full_context = "\n\n".join(context_parts)

    # ── Call Groq LLM ───────────────────────────────────────────────────────
    from ..rag.agents import get_groq_client, GROQ_MODEL
    client = get_groq_client()
    if not client:
        raise HTTPException(status_code=503, detail="Groq API key not configured.")

    system_prompt = (
        "You are a senior software engineer writing an internal technical overview of a codebase. "
        "Based only on the provided repository context, return a single valid JSON object. "
        "Do not invent features. Be concise and technically accurate. "
        "Do not use marketing language. Write as if introducing the repo to a new team member. "
        "If you cannot confidently determine a field, omit it rather than guessing."
    )

    user_prompt = f"""Repository context:
---
{full_context}
---

Return ONLY valid JSON (no markdown, no explanation) in this exact schema:
{{
  "project_overview": "2-3 sentence description of what this project does and the problem it solves",
  "primary_purpose": {{
    "goal": "The main goal of the project",
    "target_users": "Who this is built for",
    "main_functionality": "What the core system does"
  }},
  "core_features": [
    "Short action-oriented feature bullet",
    "..."
  ],
  "request_flow": [
    "Step 1: ...",
    "Step 2: ...",
    "..."
  ],
  "engineering_highlights": [
    "Technically interesting implementation detail",
    "..."
  ]
}}

Rules:
- core_features: 4-6 items
- request_flow: 4-6 steps describing user→system→response execution path
- engineering_highlights: 3-5 items, only include things that actually exist in this repo
- Omit any field you cannot determine from context
"""

    try:
        completion = client.chat.completions.create(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            model=GROQ_MODEL,
            temperature=0.1,
            max_tokens=900
        )
        raw = completion.choices[0].message.content.strip()
        # Strip markdown code fences if present
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        summary_data = _json.loads(raw)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate summary: {str(e)}")

    # Cache on repository
    repo.codebase_summary = summary_data
    db.commit()

    return summary_data

@router.post("/api/repositories/{repo_id}/codebase-summary/regenerate")
def regenerate_codebase_summary(repo_id: int, db: Session = Depends(get_db)):
    """Clears cached summary and regenerates it."""
    repo = db.query(Repository).filter(Repository.id == repo_id).first()
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")
    repo.codebase_summary = None
    db.commit()
    return get_codebase_summary(repo_id, db)
