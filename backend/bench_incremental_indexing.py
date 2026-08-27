"""Benchmark RepoAnalyzer's current pipeline or an extracted old baseline.

Examples:
  python bench_incremental_indexing.py --create-fixture --fixture-root /tmp/repo-fixture
  python bench_incremental_indexing.py --fixture-root /tmp/repo-fixture
  python bench_incremental_indexing.py --mode old --old-backend /tmp/OldRepoAnalyzer/RepoAnalyzer/backend --fixture-root /tmp/repo-fixture

The harness uses a deterministic fake embedding model, so measurements exclude
network calls and model-download noise while retaining database and orchestration work.
"""

import argparse
import inspect
import json
import os
import sys
import time
from pathlib import Path
from tempfile import TemporaryDirectory


class EncodedVectors(list):
    def tolist(self):
        return list(self)


class FakeEmbeddingModel:
    def __init__(self):
        self.calls = 0
        self.inputs = 0

    def encode(self, texts, **kwargs):
        values = [texts] if isinstance(texts, str) else list(texts)
        self.calls += 1
        self.inputs += len(values)
        return EncodedVectors([[0.1, 0.2, 0.3, 0.4] for _ in values])


def build_fixture(root: Path, large_lines: int) -> None:
    root.mkdir(parents=True, exist_ok=True)
    for index in range(80):
        (root / f"module_{index:03d}.py").write_text(
            f"def function_{index}():\n    return {index}\n"
        )
    lines = ["# deterministic large source fixture", ""]
    for index in range(large_lines // 4):
        lines.extend([
            f"def generated_{index}():",
            f"    value = {index}",
            "    if value % 2 == 0:",
            "        return value + 1",
        ])
    (root / "large_module.py").write_text("\n".join(lines) + "\n")


def run_current(db, repo, root: Path, crawl_repository, run_static_analysis_pipeline, analyze_dependencies, index_repository_embeddings):
    from app.database.models import Embedding, File, Symbol

    stage_times = {}
    started = time.perf_counter()
    stage_started = time.perf_counter()
    cached = {item.path: item for item in db.query(File).filter(File.repo_id == repo.id).all()}
    crawled = crawl_repository(str(root), cached_files=cached, strict_hashing=False)
    stage_times["crawl"] = time.perf_counter() - stage_started

    stage_started = time.perf_counter()
    scanned_paths = {item["path"] for item in crawled["files"]}
    changed_paths = set()
    skipped_paths = set()
    for item in crawled["files"]:
        record = cached.get(item["path"])
        if record is None:
            record = File(repo_id=repo.id)
            db.add(record)
            changed_paths.add(item["path"])
        elif record.hash == item["hash"]:
            skipped_paths.add(item["path"])
        else:
            changed_paths.add(item["path"])
        for key in ("path", "filename", "extension", "importance_score", "hash", "size_bytes", "mtime_ns"):
            setattr(record, key, item[key])
    for path, record in cached.items():
        if path not in scanned_paths:
            changed_paths.add(path)
            db.delete(record)
    db.commit()
    stage_times["database_files"] = time.perf_counter() - stage_started

    stage_started = time.perf_counter()
    static_metrics = run_static_analysis_pipeline(db, repo, str(root), changed_paths=changed_paths)
    stage_times["static_analysis"] = time.perf_counter() - stage_started

    stage_started = time.perf_counter()
    dependency_metrics = analyze_dependencies(db, repo.id, str(root), changed_paths=changed_paths)
    stage_times["dependency_analysis"] = time.perf_counter() - stage_started

    stage_started = time.perf_counter()
    embedding_metrics = index_repository_embeddings(db, repo)
    stage_times["embedding_generation"] = time.perf_counter() - stage_started
    return {
        "total_seconds": round(time.perf_counter() - started, 4),
        "stage_seconds": {key: round(value, 4) for key, value in stage_times.items()},
        "files_total": len(crawled["files"]),
        "files_changed": len(changed_paths),
        "files_skipped": len(skipped_paths),
        "static_files_processed": static_metrics["files_processed"],
        "symbols_changed": static_metrics["symbols_changed"],
        "dependencies_total": (dependency_metrics or {}).get("dependencies_total"),
        **embedding_metrics,
    }


def run_old(db, repo, root: Path, crawl_repository, run_static_analysis_pipeline, analyze_dependencies, index_repository_embeddings):
    from app.database.models import Embedding, File, Symbol

    stage_times = {}
    started = time.perf_counter()
    stage_started = time.perf_counter()
    crawled = crawl_repository(str(root))
    stage_times["crawl"] = time.perf_counter() - stage_started

    stage_started = time.perf_counter()
    for item in crawled["files"]:
        db.add(File(
            repo_id=repo.id,
            path=item["path"],
            filename=item["filename"],
            extension=item["extension"],
            importance_score=item["importance_score"],
            hash=item["hash"],
        ))
    db.commit()
    stage_times["database_files"] = time.perf_counter() - stage_started

    stage_started = time.perf_counter()
    run_static_analysis_pipeline(db, repo, str(root))
    stage_times["static_analysis"] = time.perf_counter() - stage_started

    stage_started = time.perf_counter()
    analyze_dependencies(db, repo.id, str(root))
    stage_times["dependency_analysis"] = time.perf_counter() - stage_started

    stage_started = time.perf_counter()
    index_repository_embeddings(db, repo)
    stage_times["embedding_generation"] = time.perf_counter() - stage_started
    return {
        "total_seconds": round(time.perf_counter() - started, 4),
        "stage_seconds": {key: round(value, 4) for key, value in stage_times.items()},
        "files_total": len(crawled["files"]),
        "files_changed": len(crawled["files"]),
    }


def run_legacy_valid(db, repo, root: Path, crawl_repository, analyze_dependencies, generator, Embedding, File, Symbol, calculate_complexity, parse_code_symbols):
    """Old transaction semantics with original-source parsing kept valid."""
    started = time.perf_counter()
    stage_times = {}
    stage_started = time.perf_counter()
    crawled = crawl_repository(str(root))
    stage_times["crawl"] = time.perf_counter() - stage_started

    stage_started = time.perf_counter()
    for item in crawled["files"]:
        db.add(File(
            repo_id=repo.id,
            path=item["path"],
            filename=item["filename"],
            extension=item["extension"],
            importance_score=item["importance_score"],
            hash=item["hash"],
            size_bytes=item.get("size_bytes", 0),
            mtime_ns=item.get("mtime_ns", 0),
        ))
    db.commit()
    stage_times["database_files"] = time.perf_counter() - stage_started

    stage_started = time.perf_counter()
    files = db.query(File).filter(File.repo_id == repo.id).all()
    for file_record in files:
        source = (root / file_record.path).read_text(encoding="utf-8", errors="ignore")
        metrics = calculate_complexity(source, file_record.filename)
        file_record.lines_of_code = metrics["loc"]
        file_record.complexity_score = metrics["complexity"]
        symbols = parse_code_symbols(source, file_record.filename)
        db.query(Symbol).filter(Symbol.file_id == file_record.id).delete(synchronize_session=False)
        db.commit()
        for symbol in symbols:
            db.add(Symbol(
                repo_id=repo.id,
                file_id=file_record.id,
                name=symbol["name"],
                type=symbol["type"],
                line_start=symbol["line_start"],
                line_end=symbol["line_end"],
                raw_code=symbol["raw_code"],
            ))
        db.commit()
    stage_times["static_analysis"] = time.perf_counter() - stage_started

    stage_started = time.perf_counter()
    analyze_dependencies(db, repo.id, str(root))
    stage_times["dependency_analysis"] = time.perf_counter() - stage_started

    stage_started = time.perf_counter()
    db.query(Embedding).filter(Embedding.repo_id == repo.id).delete()
    db.commit()
    entities = generator._semantic_entities(db, repo)
    for index, entity in enumerate(entities):
        db.add(Embedding(
            repo_id=repo.id,
            entity_type=entity["entity_type"],
            entity_id=entity["entity_id"],
            path=entity["path"],
            vector_data=generator.generate_embedding(entity["text"]),
            text_content=entity["text"],
        ))
        if index % 20 == 0:
            db.commit()
    db.commit()
    stage_times["embedding_generation"] = time.perf_counter() - stage_started
    return {
        "total_seconds": round(time.perf_counter() - started, 4),
        "stage_seconds": {key: round(value, 4) for key, value in stage_times.items()},
        "files_total": len(crawled["files"]),
        "files_changed": len(crawled["files"]),
        "static_files_processed": len(files),
        "symbols_changed": db.query(Symbol).filter(Symbol.repo_id == repo.id).count(),
        "embedding_rows": db.query(Embedding).filter(Embedding.repo_id == repo.id).count(),
    }


def run(mode: str, backend_root: Path, fixture_root: Path, large_lines: int, create_fixture: bool):
    if create_fixture:
        build_fixture(fixture_root, large_lines)
    if not fixture_root.exists():
        raise SystemExit(f"Fixture does not exist: {fixture_root}")

    sys.path.insert(0, str(backend_root))
    from sqlalchemy import create_engine, event
    from sqlalchemy.orm import sessionmaker
    from app.database.models import Base, Embedding, File, Repository, Symbol
    from app.scanner.crawler import crawl_repository
    from app.summarizer.folder_summary import run_static_analysis_pipeline
    from app.analysis.dependency import analyze_dependencies
    from app.embeddings import generator
    from app.embeddings.generator import index_repository_embeddings

    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine)
    db = session_factory()
    commits = [0]
    event.listen(session_factory, "after_commit", lambda session: commits.__setitem__(0, commits[0] + 1))
    fake_model = FakeEmbeddingModel()
    old_provider, old_model = generator.PROVIDER, generator._local_model
    generator.PROVIDER = "local"
    generator._local_model = fake_model
    try:
        repo = Repository(name=f"benchmark-{mode}", path=str(fixture_root), status="scanning")
        db.add(repo)
        db.commit()
        if mode == "current":
            runner = run_current
            result = runner(db, repo, fixture_root, crawl_repository, run_static_analysis_pipeline, analyze_dependencies, index_repository_embeddings)
        elif mode == "legacy-valid":
            from app.analysis.ast_parser import parse_code_symbols
            from app.analysis.complexity import calculate_complexity
            result = run_legacy_valid(
                db, repo, fixture_root, crawl_repository, analyze_dependencies, generator,
                Embedding, File, Symbol, calculate_complexity, parse_code_symbols,
            )
        else:
            runner = run_old
            result = runner(db, repo, fixture_root, crawl_repository, run_static_analysis_pipeline, analyze_dependencies, index_repository_embeddings)
        result.update({
            "mode": mode,
            "database_commits": commits[0],
            "embedding_model_calls": fake_model.calls,
            "embedding_model_inputs": fake_model.inputs,
            "symbol_rows": db.query(Symbol).filter(Symbol.repo_id == repo.id).count(),
            "embedding_rows": db.query(Embedding).filter(Embedding.repo_id == repo.id).count(),
            "module_origins": {
                "crawler": str(crawl_repository.__module__),
                "static": str(run_static_analysis_pipeline.__module__),
                "embeddings": inspect.getsourcefile(index_repository_embeddings),
                "static_source": inspect.getsourcefile(run_static_analysis_pipeline),
                "crawler_source": inspect.getsourcefile(crawl_repository),
            },
        })
        print(json.dumps(result, indent=2))
    finally:
        generator.PROVIDER = old_provider
        generator._local_model = old_model
        db.close()
        engine.dispose()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=("current", "legacy-valid", "old"), default="current")
    parser.add_argument("--old-backend", type=Path)
    parser.add_argument("--fixture-root", type=Path)
    parser.add_argument("--create-fixture", action="store_true")
    parser.add_argument("--large-lines", type=int, default=12000)
    args = parser.parse_args()
    if args.large_lines < 100:
        raise SystemExit("--large-lines must be at least 100")
    if args.mode == "old" and not args.old_backend:
        raise SystemExit("--old-backend is required in old mode")

    backend_root = args.old_backend if args.mode == "old" else Path(__file__).parent
    if args.fixture_root:
        run(args.mode, backend_root, args.fixture_root, args.large_lines, args.create_fixture)
    else:
        with TemporaryDirectory() as directory:
            run(args.mode, backend_root, Path(directory), args.large_lines, True)


if __name__ == "__main__":
    main()
