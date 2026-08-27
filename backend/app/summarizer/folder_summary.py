import os

from sqlalchemy.orm import Session

from ..database.models import File, Folder, Repository

STATIC_ANALYSIS_BATCH_SIZE = max(1, int(os.getenv("STATIC_ANALYSIS_BATCH_SIZE", "100")))
SOURCE_CACHE_MAX_BYTES = max(0, int(os.getenv("SOURCE_CACHE_MAX_BYTES", str(2 * 1024 * 1024))))
SOURCE_CACHE_MAX_FILE_BYTES = max(0, int(os.getenv("SOURCE_CACHE_MAX_FILE_BYTES", "256000")))


def run_static_analysis_pipeline(
    db: Session,
    repo: Repository,
    repo_path: str,
    progress_callback=None,
    changed_paths=None,
    content_cache=None,
) -> dict:
    """Parse changed files in bounded batches and reconcile folders in bulk."""
    from ..analysis.ast_parser import parse_code_symbols
    from ..analysis.complexity import calculate_complexity
    from ..database.models import Symbol

    db_files = db.query(File).filter(File.repo_id == repo.id).all()
    changed_paths = set(changed_paths) if changed_paths is not None else {file.path for file in db_files}
    files_to_process = [file for file in db_files if file.path in changed_paths]
    total_files = len(files_to_process)
    files_processed = 0
    symbols_changed = 0
    database_commits = 0
    database_bulk_operations = 0
    cached_bytes = 0

    for batch_start in range(0, total_files, STATIC_ANALYSIS_BATCH_SIZE):
        batch = files_to_process[batch_start:batch_start + STATIC_ANALYSIS_BATCH_SIZE]
        parsed_batch = []
        for offset, file_record in enumerate(batch):
            index = batch_start + offset + 1
            if progress_callback:
                percent = 40.0 + ((index / max(total_files, 1)) * 20.0)
                progress_callback(
                    f"Parsing static features & caching: {index}/{total_files}",
                    min(percent, 60.0),
                )

            full_path = os.path.join(repo_path, file_record.path)
            if not os.path.exists(full_path):
                continue
            try:
                with open(full_path, "r", encoding="utf-8", errors="ignore") as handle:
                    raw_content = handle.read()
                raw_content_bytes = len(raw_content.encode("utf-8"))
                if (
                    content_cache is not None
                    and raw_content_bytes <= SOURCE_CACHE_MAX_FILE_BYTES
                    and cached_bytes + raw_content_bytes <= SOURCE_CACHE_MAX_BYTES
                ):
                    content_cache[file_record.path] = raw_content
                    cached_bytes += raw_content_bytes

                metrics = calculate_complexity(raw_content, file_record.filename)
                symbols_list = parse_code_symbols(raw_content, file_record.filename)
                file_record.lines_of_code = metrics["loc"]
                file_record.complexity_score = metrics["complexity"]
                parsed_batch.append((file_record, symbols_list))
            except Exception as exc:
                print(f"Failed parsing file metadata: {file_record.path} {exc}")
                db.rollback()

        successful_file_ids = [file_record.id for file_record, _ in parsed_batch]
        if successful_file_ids:
            db.query(Symbol).filter(
                Symbol.file_id.in_(successful_file_ids)
            ).delete(synchronize_session=False)
            database_bulk_operations += 1
            for file_record, symbols_list in parsed_batch:
                symbols_changed += len(symbols_list)
                for symbol in symbols_list:
                    db.add(Symbol(
                        repo_id=repo.id,
                        file_id=file_record.id,
                        name=symbol["name"],
                        type=symbol["type"],
                        line_start=symbol["line_start"],
                        line_end=symbol["line_end"],
                        raw_code=symbol["raw_code"],
                    ))
            files_processed += len(parsed_batch)
            db.commit()
            database_commits += 1

    folder_paths = set()
    for file_record in db_files:
        folder_dir = os.path.dirname(file_record.path).replace("\\", "/")
        if folder_dir:
            parts = folder_dir.split("/")
            folder_paths.update("/".join(parts[:index]) for index in range(1, len(parts) + 1))

    expected_folders = set(folder_paths)
    existing_folders = db.query(Folder).filter(Folder.repo_id == repo.id).all()
    existing_folder_paths = {folder.path for folder in existing_folders}
    stale_folder_paths = existing_folder_paths - expected_folders
    if stale_folder_paths:
        db.query(Folder).filter(
            Folder.repo_id == repo.id,
            Folder.path.in_(stale_folder_paths),
        ).delete(synchronize_session=False)
        database_bulk_operations += 1

    new_folders = [
        Folder(
            repo_id=repo.id,
            path=folder_dir,
            folder_name=os.path.basename(folder_dir),
            parent_path=os.path.dirname(folder_dir).replace("\\", "/"),
        )
        for folder_dir in sorted(expected_folders, key=lambda value: len(value.split("/")), reverse=True)
        if folder_dir not in existing_folder_paths
    ]
    if new_folders:
        db.add_all(new_folders)
        database_bulk_operations += 1
    if stale_folder_paths or new_folders:
        db.commit()
        database_commits += 1

    return {
        "files_processed": files_processed,
        "static_files_skipped": len(db_files) - files_processed,
        "symbols_changed": symbols_changed,
        "database_commits": database_commits,
        "database_bulk_operations": database_bulk_operations,
    }
