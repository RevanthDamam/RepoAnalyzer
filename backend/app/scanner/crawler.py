import os
from pathlib import Path

from .classifier import score_file
from .hasher import compute_sha256
from ..security import MAX_FILE_SIZE_BYTES

# Exclude lists
IGNORED_DIRS = {
    '.git', 'node_modules', 'dist', 'build', 'coverage', '.cache', 
    '__pycache__', '.venv', 'venv', 'env', '.qodo', '.gemini', 
    '.vscode', '.idea', 'tmp', 'out', 'bin', 'obj'
}

IGNORED_EXTS = {
    # Images
    '.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', '.webp', '.bmp', '.tiff',
    # Fonts
    '.woff', '.woff2', '.ttf', '.eot', '.otf',
    # Videos/Audio
    '.mp4', '.mp3', '.wav', '.mov', '.avi', '.mkv', '.webm', '.flac', '.ogg',
    # Archives
    '.zip', '.tar.gz', '.tar', '.gz', '.rar', '.7z', '.bz2',
    # Binaries/Executables
    '.exe', '.dll', '.so', '.dylib', '.bin', '.pdf', '.docx', '.xlsx', '.pptx',
    # Other binary assets
    '.db', '.sqlite', '.sqlite3', '.pyc', '.pyd'
}

def crawl_repository(repo_path: str, cached_files=None, strict_hashing=None) -> dict:
    """
    Stage 1: Walks repository files, handles excludes, compiles folder tree mapping.
    """
    if not os.path.exists(repo_path):
        raise ValueError(f"Repository path does not exist: {repo_path}")
        
    files_list = []
    folder_tree = {}
    cached_files = cached_files or {}
    if strict_hashing is None:
        strict_hashing = os.getenv("STRICT_HASHING", "false").lower() in {"1", "true", "yes"}
    
    repository_root = Path(repo_path).resolve(strict=True)
    for root, dirs, files in os.walk(repository_root, followlinks=False):
        # In-place modify dirs to skip ignored directories and symlinked folders.
        dirs[:] = [
            d for d in dirs
            if d not in IGNORED_DIRS and not Path(root, d).is_symlink()
        ]
        
        # Calculate relative folder path from repository root
        rel_folder = os.path.relpath(root, repo_path)
        if rel_folder == ".":
            rel_folder = ""
            
        for file in files:
            name, ext = os.path.splitext(file)
            if ext.lower() in IGNORED_EXTS or file.startswith('.'):
                continue
                
            full_path = Path(root, file)
            if full_path.is_symlink():
                continue
            resolved_path = full_path.resolve()
            try:
                resolved_path.relative_to(repository_root)
            except ValueError:
                continue
            rel_path = resolved_path.relative_to(repository_root).as_posix()

            # File metadata. Large files are deliberately skipped to prevent
            # memory and CPU exhaustion during hashing and AST parsing.
            stat = resolved_path.stat()
            file_size = stat.st_size
            if file_size > MAX_FILE_SIZE_BYTES:
                continue
            cached = cached_files.get(rel_path)
            metadata_unchanged = (
                not strict_hashing
                and cached is not None
                and cached.size_bytes == file_size
                and cached.mtime_ns == stat.st_mtime_ns
                and cached.hash
            )
            file_hash = cached.hash if metadata_unchanged else compute_sha256(str(resolved_path))
            score = score_file(rel_path, file)
            
            files_list.append({
                "path": rel_path,
                "filename": file,
                "extension": ext,
                "size_bytes": file_size,
                "mtime_ns": stat.st_mtime_ns,
                "hash": file_hash,
                "importance_score": score
            })
            
            # Add to folder tree mapping
            parts = rel_path.split('/')
            curr = folder_tree
            for part in parts[:-1]:
                if part not in curr:
                    curr[part] = {}
                curr = curr[part]
            curr[parts[-1]] = "file"

    return {
        "files": files_list,
        "folder_tree": folder_tree
    }
