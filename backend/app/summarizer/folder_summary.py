import os
from sqlalchemy.orm import Session
from ..database.models import File, Folder, Repository

STATIC_ANALYSIS_BATCH_SIZE = max(1, int(os.getenv("STATIC_ANALYSIS_BATCH_SIZE", "100")))

def run_static_analysis_pipeline(db: Session, repo: Repository, repo_path: str, progress_callback=None, changed_paths=None) -> dict:
    """
    Crawls repository files, validates hashes, runs AST parsing & complexity calculations,
    and computes hierarchical folders without AI summarization or storing compressed code.
    """
    # Import analysis engines dynamically inside to prevent cyclic imports
    from ..analysis.ast_parser import parse_code_symbols
    from ..analysis.complexity import calculate_complexity
    from ..database.models import Symbol
    
    db_files = db.query(File).filter(File.repo_id == repo.id).all()
    changed_paths = set(changed_paths) if changed_paths is not None else {file.path for file in db_files}
    files_to_process = [file for file in db_files if file.path in changed_paths]
    total_files = len(files_to_process)
    symbols_changed = 0
    
    for idx, file_record in enumerate(files_to_process):
        if progress_callback:
            progress_callback(f"Parsing static features & caching: {idx+1}/{total_files}", (idx / (total_files + 5)) * 100)
            
        full_path = os.path.join(repo_path, file_record.path)
        if not os.path.exists(full_path):
            continue
            
        try:
            with open(full_path, "r", encoding="utf-8", errors="ignore") as f:
                raw_content = f.read()
                
            # Parse the original source once; this preserves line locations and avoids
            # allocating a second full-file compressed string.
            metrics = calculate_complexity(raw_content, file_record.filename)
            file_record.lines_of_code = metrics["loc"]
            file_record.complexity_score = metrics["complexity"]

            # Parse symbols (classes, functions) statically.
            symbols_list = parse_code_symbols(raw_content, file_record.filename)
            symbols_changed += len(symbols_list)
            
            # Replace old symbols and batch the write to reduce SQLite lock time.
            db.query(Symbol).filter(Symbol.file_id == file_record.id).delete(synchronize_session=False)

            # Store symbols in DB.
            for sym in symbols_list:
                db_sym = Symbol(
                    repo_id=repo.id,
                    file_id=file_record.id,
                    name=sym["name"],
                    type=sym["type"],
                    line_start=sym["line_start"],
                    line_end=sym["line_end"],
                    raw_code=sym["raw_code"]
                )
                db.add(db_sym)

            if (idx + 1) % STATIC_ANALYSIS_BATCH_SIZE == 0:
                db.commit()

        except Exception as e:
            print(f"Failed parsing file metadata: {file_record.path} {e}")
            db.rollback()

    db.commit()

    # Create Folder Records (Bottom-Up)
    folder_paths = set()
    for f in db_files:
        folder_dir = os.path.dirname(f.path).replace("\\", "/")
        if folder_dir:
            folder_paths.add(folder_dir)
            parts = folder_dir.split('/')
            for i in range(1, len(parts)):
                folder_paths.add("/".join(parts[:i]))
                
    sorted_folders = sorted(list(folder_paths), key=lambda x: len(x.split('/')), reverse=True)
    existing_folder_paths = {
        folder.path
        for folder in db.query(Folder).filter(Folder.repo_id == repo.id).all()
    }
    new_folders = [
        Folder(
            repo_id=repo.id,
            path=folder_dir,
            folder_name=os.path.basename(folder_dir),
            parent_path=os.path.dirname(folder_dir).replace("\\", "/"),
        )
        for folder_dir in sorted_folders
        if folder_dir not in existing_folder_paths
    ]
    if new_folders:
        db.add_all(new_folders)
    db.commit()
    return {
        "files_processed": total_files,
        "files_skipped": len(db_files) - total_files,
        "symbols_changed": symbols_changed,
    }

