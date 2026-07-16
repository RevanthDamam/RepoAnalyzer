import os
from groq import Groq
from sqlalchemy.orm import Session
from ..database.models import File, Folder, Repository
from .file_summary import get_groq_client, GROQ_MODEL, generate_file_summary
from .compression import compress_code

def generate_folder_summary(client: Groq, folder_path: str, child_files: list, child_folders: list) -> str:
    """
    Stage 4: Generate AI folder summary based on direct file summaries and subfolders.
    """
    if not client:
        return f"Placeholder summary for folder '{folder_path}' (No Groq API Key)."

    files_desc = "\n".join([f"- File: {f.path}\n  Summary: {f.summary}" for f in child_files if f.summary])
    folders_desc = "\n".join([f"- Subfolder: {fd.path}\n  Summary: {fd.summary}" for fd in child_folders if fd.summary])
    
    prompt = f"""You are a senior technical architect. 
Summarize the purpose of the directory '{folder_path}' based on its contents.
Your summary MUST be 150 words or less. Explain how the files and subfolders in this directory coordinate.

Contents of this directory:
---
FILES:
{files_desc if files_desc else "(no file summaries)"}

SUBDIRECTORIES:
{folders_desc if folders_desc else "(no subdirectory summaries)"}
---
"""
    try:
        completion = client.chat.completions.create(
            messages=[
                {"role": "system", "content": "You are a concise technical architect. Summarize folders in under 150 words. Do not write intros or outros."},
                {"role": "user", "content": prompt}
            ],
            model=GROQ_MODEL,
            temperature=0.1,
            max_tokens=250
        )
        return completion.choices[0].message.content.strip()
    except Exception as e:
        return f"Failed to generate folder summary: {str(e)}"

def run_summarization_pipeline(db: Session, repo: Repository, repo_path: str, progress_callback=None) -> None:
    """
    Crawls repository files, validates hashes, runs ast parsing & complexity calculations,
    compresses logic, calls Groq summarizer, and computes hierarchical folder summaries bottom-up.
    """
    client = get_groq_client()
    
    # Import analysis engines dynamically inside to prevent cyclic imports
    from ..analysis.ast_parser import parse_code_symbols
    from ..analysis.complexity import calculate_complexity
    from ..database.models import Symbol
    
    db_files = db.query(File).filter(File.repo_id == repo.id).all()
    total_files = len(db_files)
    
    files_to_summarize = []
    for idx, file_record in enumerate(db_files):
        if progress_callback:
            progress_callback(f"Parsing static features & caching: {idx+1}/{total_files}", (idx / (total_files + 5)) * 100)
            
        full_path = os.path.join(repo_path, file_record.path)
        if not os.path.exists(full_path):
            continue
            
        try:
            with open(full_path, "r", encoding="utf-8", errors="ignore") as f:
                raw_content = f.read()
                
            # Compress code
            compressed = compress_code(raw_content, file_record.extension)
            file_record.raw_content_compressed = compressed
            
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
            
            # Check Caching: If importance score >= 40, check if we need to summarize
            if file_record.importance_score >= 40:
                # If summary already exists and file hash matches, cache HIT
                if file_record.summary and file_record.hash == file_record.hash:
                    continue
                files_to_summarize.append((file_record, symbols_list))
                
        except Exception as e:
            print(f"Failed parsing file metadata: {file_record.path} {e}")
            db.rollback()

    # Summarize files via Groq
    total_to_sum = len(files_to_summarize)
    for idx, (file_record, symbols_list) in enumerate(files_to_summarize):
        if progress_callback:
            progress_callback(
                f"Summarizing file {idx+1}/{total_to_sum}: {file_record.path}",
                (total_files + idx) / (total_files + total_to_sum + 5) * 100
            )
            
        try:
            summary = generate_file_summary(
                client, 
                file_record.filename, 
                file_record.path, 
                file_record.raw_content_compressed, 
                symbols_list
            )
            file_record.summary = summary
            db.commit()
        except Exception:
            file_record.summary = f"Error creating summary."
            db.commit()

    # Hierarchical Folder Summaries (Bottom-Up)
    folder_paths = set()
    for f in db_files:
        folder_dir = os.path.dirname(f.path).replace("\\", "/")
        if folder_dir:
            folder_paths.add(folder_dir)
            parts = folder_dir.split('/')
            for i in range(1, len(parts)):
                folder_paths.add("/".join(parts[:i]))
                
    # Depth descending (leaves first)
    sorted_folders = sorted(list(folder_paths), key=lambda x: len(x.split('/')), reverse=True)
    total_folders = len(sorted_folders)
    
    # Track paths that have been summarized this turn to invalidate parents
    changed_paths = set([os.path.dirname(f[0].path).replace("\\", "/") for f in files_to_summarize])
    
    for idx, folder_dir in enumerate(sorted_folders):
        if progress_callback:
            progress_callback(
                f"Summarizing folder {idx+1}/{total_folders}: {folder_dir}",
                (total_files + total_to_sum + idx) / (total_files + total_to_sum + total_folders + 2) * 100
            )
            
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
            
        # Cache check
        is_child_changed = any(path.startswith(folder_dir) for path in changed_paths)
        if folder_record.summary and not is_child_changed:
            continue
            
        child_files = db.query(File).filter(File.repo_id == repo.id, File.path.like(folder_dir + "/%")).all()
        child_files = [f for f in child_files if os.path.dirname(f.path).replace("\\", "/") == folder_dir]
        
        child_folders = db.query(Folder).filter(Folder.repo_id == repo.id, Folder.parent_path == folder_dir).all()
        
        folder_summary = generate_folder_summary(client, folder_dir, child_files, child_folders)
        folder_record.summary = folder_summary
        db.commit()
        
        # Invalidate parent in cache track
        changed_paths.add(folder_dir)
