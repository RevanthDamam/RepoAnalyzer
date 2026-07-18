import os
import re
from sqlalchemy.orm import Session
from ..database.models import File, Dependency

# Regexes to capture import targets
PY_IMPORT_PATTERN = re.compile(r'^\s*(?:from\s+([A-Za-z0-9_.]+)\s+import|import\s+([A-Za-z0-9_., ]+))')
JS_IMPORT_PATTERN = re.compile(r'(?:import|from|require)\s*\(\s*[\'"`]([^\'"`]+)[\'"`]\s*\)|import\s+.*?\s+from\s+[\'"`]([^\'"`]+)[\'"`]')

def extract_raw_imports(content: str, ext: str) -> list:
    """Extracts raw import paths/names from source content."""
    imports = []
    lines = content.splitlines()
    
    if ext == '.py':
        for line in lines:
            if match := PY_IMPORT_PATTERN.search(line):
                # Captures either from group(1) or import group(2)
                target = match.group(1) or match.group(2)
                if target:
                    # Clean up multiple imports on same line e.g., import os, sys
                    for t in target.split(','):
                        imports.append(t.strip())
                        
    elif ext in ('.js', '.jsx', '.ts', '.tsx'):
        for line in lines:
            # Match standard ES6 imports or require()
            matches = JS_IMPORT_PATTERN.findall(line)
            for m in matches:
                # findall returns tuple of groups, filter to non-empty
                target = next((x for x in m if x), None)
                if target:
                    imports.append(target)
                    
    return list(set(imports))

def resolve_import_path(import_target: str, source_file_path: str, files_by_path: dict) -> str:
    """
    Attempts to resolve an import string into a relative file path matching one of the repo files.
    """
    # 1. Check relative JS imports e.g. "./utils" or "../components/Button"
    if import_target.startswith('.'):
        source_dir = os.path.dirname(source_file_path)
        # Normalize relative path
        norm_path = os.path.normpath(os.path.join(source_dir, import_target)).replace("\\", "/")
        
        # Try direct matches with common extensions
        for ext in ('.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx', '/index.js'):
            test_path = norm_path + ext if not ext.startswith('/') else norm_path + ext
            # Trim leading "./" if normpath creates it
            test_path = test_path.lstrip('./')
            if test_path in files_by_path:
                return test_path
        
        # Check raw match
        if norm_path in files_by_path:
            return norm_path

    # 2. Check absolute/absolute-aliased imports (e.g. "app/database" or "src/auth")
    # Python absolute: e.g. "app.database" or "app.scanner.crawler"
    cleaned_target = import_target.replace('.', '/')
    for ext in ('.py', '.ts', '.tsx', '.js', '.jsx'):
        # Direct check
        test_path1 = cleaned_target + ext
        if test_path1 in files_by_path:
            return test_path1
            
        # Inside folders check (like app/database.py from router)
        for rel_path in files_by_path:
            if rel_path.endswith(test_path1):
                return rel_path

    return ""

def analyze_dependencies(db: Session, repo_id: int, repo_path: str = None) -> None:
    """
    Builds the codebase import graph, inserts dependency relations, 
    and updates lines metrics (fan_in/fan_out) inside the Files table.
    Reads raw_content_compressed from DB; falls back to reading file from disk
    if repo_path is provided and the compressed content is missing.
    """
    # 1. Fetch all repository files and build relative lookup dict
    db_files = db.query(File).filter(File.repo_id == repo_id).all()
    files_by_path = {f.path: f for f in db_files}
    
    # If repo_path not provided, try to get it from the repo record
    if not repo_path:
        from ..database.models import Repository
        repo = db.query(Repository).filter(Repository.id == repo_id).first()
        repo_path = repo.path if repo else None
    
    # Reset old dependencies
    db.query(Dependency).filter(Dependency.repo_id == repo_id).delete()
    db.commit()
    
    # Track metrics
    fan_out_counts = {f.id: 0 for f in db_files}
    fan_in_counts = {f.id: 0 for f in db_files}
    
    dependencies_to_add = []
    
    for f in db_files:
        content = None
        
        # Read directly from disk
        if repo_path:
            full_path = os.path.join(repo_path, f.path)
            if os.path.exists(full_path):
                try:
                    with open(full_path, "r", encoding="utf-8", errors="ignore") as fh:
                        content = fh.read()
                except Exception:
                    continue
        
        if not content:
            continue
            
        raw_imports = extract_raw_imports(content, f.extension)
        resolved_targets = set()
        
        for imp in raw_imports:
            resolved_path = resolve_import_path(imp, f.path, files_by_path)
            if resolved_path and resolved_path != f.path:
                resolved_targets.add(resolved_path)
                
        # Insert dependencies
        for target in resolved_targets:
            dep_row = Dependency(
                repo_id=repo_id,
                from_file_path=f.path,
                to_file_path=target,
                dependency_type="import"
            )
            dependencies_to_add.append(dep_row)
            
            # Increment counts
            fan_out_counts[f.id] += 1
            target_file_id = files_by_path[target].id
            fan_in_counts[target_file_id] += 1
            
    # Save dependency rows
    db.add_all(dependencies_to_add)
    db.commit()
    
    # Update File metric counters
    for f in db_files:
        f.fan_out = fan_out_counts.get(f.id, 0)
        f.fan_in = fan_in_counts.get(f.id, 0)
        
    db.commit()
