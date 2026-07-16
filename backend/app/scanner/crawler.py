import os
from .classifier import score_file
from .hasher import compute_sha256

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

def crawl_repository(repo_path: str) -> dict:
    """
    Stage 1: Walks repository files, handles excludes, compiles folder tree mapping.
    """
    if not os.path.exists(repo_path):
        raise ValueError(f"Repository path does not exist: {repo_path}")
        
    files_list = []
    folder_tree = {}
    
    for root, dirs, files in os.walk(repo_path):
        # In-place modify dirs to skip ignored directories
        dirs[:] = [d for d in dirs if d not in IGNORED_DIRS]
        
        # Calculate relative folder path from repository root
        rel_folder = os.path.relpath(root, repo_path)
        if rel_folder == ".":
            rel_folder = ""
            
        for file in files:
            name, ext = os.path.splitext(file)
            if ext.lower() in IGNORED_EXTS or file.startswith('.'):
                continue
                
            full_path = os.path.join(root, file)
            rel_path = os.path.relpath(full_path, repo_path).replace("\\", "/")
            
            # File metadata
            file_size = os.path.getsize(full_path)
            file_hash = compute_sha256(full_path)
            score = score_file(rel_path, file)
            
            files_list.append({
                "path": rel_path,
                "filename": file,
                "extension": ext,
                "size_bytes": file_size,
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
