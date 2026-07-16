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
from ..summarizer.folder_summary import run_summarization_pipeline
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
        
        # 4 & 7. AST extraction & Caching & Summarization
        update_progress("Extracting symbols & generating summaries", 40.0)
        run_summarization_pipeline(db, repo, repo_path, progress_callback=update_progress)
        
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
        "has_summary": f.summary is not None and f.summary != ""
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
        "summary": file_record.summary,
        "raw_content_compressed": file_record.raw_content_compressed,
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
    nodes = [{"path": f.path, "filename": f.filename, "fan_in": f.fan_in, "fan_out": f.fan_out, "summary": f.summary} for f in files]
    
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
    nodes = [{"path": f.path, "filename": f.filename, "fan_in": f.fan_in, "fan_out": f.fan_out, "summary": f.summary} for f in files]
    return {"nodes": nodes, "edges": edges}

@router.get("/api/repositories/{repo_id}/quality")
def get_repo_quality(repo_id: int, db: Session = Depends(get_db)):
    """Returns cyclomatic complexity statistics, LOC counters, and code smells lists."""
    return analyze_codebase_quality(db, repo_id)

@router.get("/api/repositories/{repo_id}/learning")
def get_repo_learning_path(repo_id: int, db: Session = Depends(get_db)):
    """Returns a step-by-step codebase onboarding path checklist."""
    return generate_onboarding_guide(db, repo_id)
