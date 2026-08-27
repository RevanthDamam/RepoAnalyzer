import os
import re
from collections import defaultdict

from sqlalchemy.orm import Session

from ..database.models import Dependency, File

# Regexes to capture import targets
PY_IMPORT_PATTERN = re.compile(r'^\s*(?:from\s+([A-Za-z0-9_.]+)\s+import|import\s+([A-Za-z0-9_., ]+))')
JS_IMPORT_PATTERN = re.compile(r'(?:import|from|require)\s*\(\s*[\'"`]([^\'"`]+)[\'"`]\s*\)|import\s+.*?\s+from\s+[\'"`]([^\'"`]+)[\'"`]')
DEPENDENCY_BATCH_SIZE = max(1, int(os.getenv("DEPENDENCY_BATCH_SIZE", "1000")))


def extract_raw_imports(content: str, ext: str) -> list:
    """Extract raw import paths/names from source content."""
    imports = []
    lines = content.splitlines()

    if ext == ".py":
        for line in lines:
            if match := PY_IMPORT_PATTERN.search(line):
                target = match.group(1) or match.group(2)
                if target:
                    imports.extend(target_part.strip() for target_part in target.split(","))
    elif ext in (".js", ".jsx", ".ts", ".tsx"):
        for line in lines:
            for match in JS_IMPORT_PATTERN.findall(line):
                target = next((value for value in match if value), None)
                if target:
                    imports.append(target)

    return list(set(imports))


def build_path_indexes(files_by_path: dict) -> dict:
    """Build slash-boundary suffix indexes for near-O(1) import resolution."""
    suffix_index = defaultdict(list)
    for path in files_by_path:
        parts = path.split("/")
        for index in range(len(parts)):
            suffix_index["/".join(parts[index:])].append(path)
    return {key: sorted(value) for key, value in suffix_index.items()}


def resolve_import_path(import_target: str, source_file_path: str, files_by_path: dict, suffix_index=None) -> str:
    """Resolve an import string to a relative path matching repository files."""
    if import_target.startswith("."):
        source_dir = os.path.dirname(source_file_path)
        norm_path = os.path.normpath(os.path.join(source_dir, import_target)).replace("\\", "/")

        for ext in (".ts", ".tsx", ".js", ".jsx", "/index.ts", "/index.tsx", "/index.js"):
            test_path = norm_path + ext if not ext.startswith("/") else norm_path + ext
            test_path = test_path.lstrip("./")
            if test_path in files_by_path:
                return test_path
        if norm_path in files_by_path:
            return norm_path

    cleaned_target = import_target.replace(".", "/")
    for ext in (".py", ".ts", ".tsx", ".js", ".jsx"):
        test_path = cleaned_target + ext
        if test_path in files_by_path:
            return test_path
        matches = (suffix_index or {}).get(test_path, [])
        if matches:
            return matches[0]

    return ""


def analyze_dependencies(db: Session, repo_id: int, repo_path: str = None, changed_paths=None, content_cache=None) -> dict:
    """Build the import graph and fan-in/fan-out metrics in bounded DB batches."""
    if changed_paths is not None and not changed_paths:
        return {
            "dependencies_total": 0,
            "dependency_files_analyzed": 0,
            "imports_extracted": 0,
            "imports_resolved": 0,
            "imports_unresolved": 0,
            "dependency_files_read": 0,
            "database_commits": 0,
            "database_bulk_operations": 0,
        }

    db_files = db.query(File).filter(File.repo_id == repo_id).all()
    files_by_path = {file_record.path: file_record for file_record in db_files}
    suffix_index = build_path_indexes(files_by_path)

    if not repo_path:
        from ..database.models import Repository

        repo = db.query(Repository).filter(Repository.id == repo_id).first()
        repo_path = repo.path if repo else None

    db.query(Dependency).filter(Dependency.repo_id == repo_id).delete()
    db.commit()

    fan_out_counts = {file_record.id: 0 for file_record in db_files}
    fan_in_counts = {file_record.id: 0 for file_record in db_files}
    dependencies_to_add = []
    content_cache = content_cache or {}
    changed_paths = set(changed_paths or ())
    imports_extracted = 0
    imports_resolved = 0
    imports_unresolved = 0
    files_read = 0

    for file_record in db_files:
        raw_imports = None
        if file_record.path not in changed_paths and file_record.imports_cache is not None:
            raw_imports = file_record.imports_cache
        else:
            content = content_cache.get(file_record.path)
            if content is None and repo_path:
                full_path = os.path.join(repo_path, file_record.path)
                if os.path.exists(full_path):
                    try:
                        with open(full_path, "r", encoding="utf-8", errors="ignore") as handle:
                            content = handle.read()
                        files_read += 1
                    except Exception:
                        continue
            if content is None:
                continue
            raw_imports = extract_raw_imports(content, file_record.extension)
            file_record.imports_cache = raw_imports

        imports_extracted += len(raw_imports)
        resolved_targets = set()
        for import_target in raw_imports:
            resolved_path = resolve_import_path(import_target, file_record.path, files_by_path, suffix_index)
            if resolved_path and resolved_path != file_record.path:
                resolved_targets.add(resolved_path)
            else:
                imports_unresolved += 1

        for target in resolved_targets:
            dependencies_to_add.append(Dependency(
                repo_id=repo_id,
                from_file_path=file_record.path,
                to_file_path=target,
                dependency_type="import",
            ))
            fan_out_counts[file_record.id] += 1
            fan_in_counts[files_by_path[target].id] += 1
            imports_resolved += 1

    for start in range(0, len(dependencies_to_add), DEPENDENCY_BATCH_SIZE):
        db.add_all(dependencies_to_add[start:start + DEPENDENCY_BATCH_SIZE])
    db.commit()

    for file_record in db_files:
        file_record.fan_out = fan_out_counts[file_record.id]
        file_record.fan_in = fan_in_counts[file_record.id]
    db.commit()
    return {
        "dependencies_total": len(dependencies_to_add),
        "dependency_files_analyzed": len(db_files),
        "imports_extracted": imports_extracted,
        "imports_resolved": imports_resolved,
        "imports_unresolved": imports_unresolved,
        "dependency_files_read": files_read,
        "database_commits": 3,
        "database_bulk_operations": 2 if dependencies_to_add else 1,
    }
