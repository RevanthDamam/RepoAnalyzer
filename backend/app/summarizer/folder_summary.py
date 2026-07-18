import os
from sqlalchemy.orm import Session
from ..database.models import File, Folder, Repository
from .compression import compress_code

def run_static_analysis_pipeline(db: Session, repo: Repository, repo_path: str, progress_callback=None) -> None:
    """
    Crawls repository files, validates hashes, runs AST parsing & complexity calculations,
    and computes hierarchical folders without AI summarization or storing compressed code.
    """
    # Import analysis engines dynamically inside to prevent cyclic imports
    from ..analysis.ast_parser import parse_code_symbols
    from ..analysis.complexity import calculate_complexity
    from ..database.models import Symbol
    
    db_files = db.query(File).filter(File.repo_id == repo.id).all()
    total_files = len(db_files)
    
    for idx, file_record in enumerate(db_files):
        if progress_callback:
            progress_callback(f"Parsing static features & caching: {idx+1}/{total_files}", (idx / (total_files + 5)) * 100)
            
        full_path = os.path.join(repo_path, file_record.path)
        if not os.path.exists(full_path):
            continue
            
        try:
            with open(full_path, "r", encoding="utf-8", errors="ignore") as f:
                raw_content = f.read()
                
            # Compress code for metrics calculation only
            compressed = compress_code(raw_content, file_record.extension)
            
            # Static complexity metrics
            metrics = calculate_complexity(compressed, file_record.filename)
            file_record.lines_of_code = metrics["loc"]
            file_record.complexity_score = metrics["complexity"]
            
            # Parse symbols (classes, functions) statically
            symbols_list = parse_code_symbols(compressed, file_record.filename)
            
            # Remove old symbols for this file
            db.query(Symbol).filter(Symbol.file_id == file_record.id).delete()
            db.commit()
            
            # Store symbols in DB
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
            db.commit()
                
        except Exception as e:
            print(f"Failed parsing file metadata: {file_record.path} {e}")
            db.rollback()

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
    total_folders = len(sorted_folders)
    
    for idx, folder_dir in enumerate(sorted_folders):
        folder_record = db.query(Folder).filter(Folder.repo_id == repo.id, Folder.path == folder_dir).first()
        if not folder_record:
            folder_record = Folder(
                repo_id=repo.id,
                path=folder_dir,
                folder_name=os.path.basename(folder_dir),
                parent_path=os.path.dirname(folder_dir).replace("\\", "/")
            )
            db.add(folder_record)
            db.commit()

