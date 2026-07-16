import os
from sqlalchemy.orm import Session
from ..database.models import File, Symbol

def generate_onboarding_guide(db: Session, repo_id: int) -> dict:
    """
    Statically analyzes repository layout and metadata to formulate 
    an onboarding learning path sequence for developers.
    No AI, instant facts.
    """
    db_files = db.query(File).filter(File.repo_id == repo_id).all()
    if not db_files:
        return {"steps": []}
        
    steps = []
    
    # 1. Step 1: Entrypoints
    entrypoints = [f for f in db_files if f.filename.lower() in ('main.py', 'app.py', 'server.js', 'index.js', 'index.ts', 'index.tsx', 'app.tsx')]
    if entrypoints:
        steps.append({
            "title": "1. Entrypoint & Bootstrap",
            "description": "Understand how the application starts up, configures environments, and registers servers.",
            "files": [f.path for f in entrypoints[:3]]
        })
    else:
        # Fallback to high score files
        high_score = [f for f in db_files if f.importance_score == 100]
        if high_score:
            steps.append({
                "title": "1. Main Configuration Elements",
                "description": "Begin by inspecting project manifests and configuration scripts.",
                "files": [f.path for f in high_score[:3]]
            })

    # 2. Step 2: Database Schema
    db_files_match = [f for f in db_files if 'schema' in f.filename.lower() or 'database' in f.filename.lower() or 'db' in f.filename.lower() or f.extension == '.prisma']
    if db_files_match:
        steps.append({
            "title": "2. Database Schemas & Connection Settings",
            "description": "Trace the database configurations, connection layers, and database model declarations.",
            "files": [f.path for f in db_files_match[:3]]
        })

    # 3. Step 3: API Endpoints / Core Routing
    route_symbols = db.query(Symbol).filter(Symbol.repo_id == repo_id, Symbol.type == "route").all()
    if route_symbols:
        # Get unique file paths that define routes
        route_files = list(set([db.query(File).filter(File.id == sym.file_id).first().path for sym in route_symbols if sym.file_id]))
        steps.append({
            "title": "3. API Routers & Gateways",
            "description": "Examine exposed routes and handler endpoints which handle client integration tasks.",
            "files": route_files[:4]
        })
    else:
        # Fallback to folder directories containing 'routes' or 'controllers'
        route_path_files = [f for f in db_files if '/routes/' in f.path.lower() or '/controllers/' in f.path.lower() or '/api/' in f.path.lower()]
        if route_path_files:
            steps.append({
                "title": "3. API Routers & Handlers",
                "description": "Review folders registering API routes and request controllers.",
                "files": [f.path for f in route_path_files[:3]]
            })

    # 4. Step 4: Core Logical Modules (Ranked by highest fan-in/fan-out)
    logical_core = sorted([f for f in db_files if f.importance_score == 70], key=lambda x: x.fan_in, reverse=True)
    if logical_core:
        steps.append({
            "title": "4. Business Logic Core",
            "description": "Check the core business logical components (ranked by codebase usage count).",
            "files": [f.path for f in logical_core[:4]]
        })

    # 5. Step 5: Testing Elements
    tests = [f for f in db_files if 'test' in f.filename.lower() or 'spec' in f.filename.lower()]
    if tests:
        steps.append({
            "title": "5. Verification & Tests Suite",
            "description": "See how functions are validated and assert code reliability using test specifications.",
            "files": [f.path for f in tests[:3]]
        })
        
    return {
        "steps": steps
    }
