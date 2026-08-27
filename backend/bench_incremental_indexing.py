"""Deterministic local benchmark for RepoAnalyzer's incremental indexing path.

Usage: python bench_incremental_indexing.py [--large-lines 12000]
The script uses a tiny fake embedding model so measurements cover orchestration,
SQLite writes, parsing, and cache decisions without network or model-download noise.
"""

import argparse
import json
import time
from pathlib import Path
from tempfile import TemporaryDirectory

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.analysis.dependency import analyze_dependencies
from app.database.models import Base, File, Repository
from app.embeddings import generator
from app.embeddings.generator import index_repository_embeddings
from app.scanner.crawler import crawl_repository
from app.summarizer.folder_summary import run_static_analysis_pipeline


class FakeEmbeddingModel:
    def __init__(self):
        self.calls = 0
        self.inputs = 0

    def encode(self, texts, **kwargs):
        self.calls += 1
        self.inputs += len(texts)
        return [[0.1, 0.2, 0.3, 0.4] for _ in texts]


def build_fixture(root: Path, large_lines: int) -> None:
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


def run_pass(db, repo, root: Path):
    started = time.perf_counter()
    cached = {item.path: item for item in db.query(File).filter(File.repo_id == repo.id).all()}
    crawled = crawl_repository(str(root), cached_files=cached, strict_hashing=False)
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

    static_metrics = run_static_analysis_pipeline(db, repo, str(root), changed_paths=changed_paths)
    analyze_dependencies(db, repo.id, str(root), changed_paths=changed_paths)
    embedding_metrics = index_repository_embeddings(db, repo)
    elapsed = time.perf_counter() - started
    return {
        "seconds": round(elapsed, 4),
        "files_total": len(crawled["files"]),
        "files_changed": len(changed_paths),
        "files_skipped": len(skipped_paths),
        "static_files_processed": static_metrics["files_processed"],
        "symbols_changed": static_metrics["symbols_changed"],
        **embedding_metrics,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--large-lines", type=int, default=12000)
    args = parser.parse_args()
    if args.large_lines < 100:
        raise SystemExit("--large-lines must be at least 100")

    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine)
    db = session_factory()
    fake_model = FakeEmbeddingModel()
    old_provider, old_model = generator.PROVIDER, generator._local_model
    generator.PROVIDER = "local"
    generator._local_model = fake_model

    try:
        with TemporaryDirectory() as directory:
            root = Path(directory)
            build_fixture(root, args.large_lines)
            repo = Repository(name="benchmark", path=str(root), status="scanning")
            db.add(repo)
            db.commit()
            first = run_pass(db, repo, root)
            unchanged = run_pass(db, repo, root)
            changed_file = root / "module_000.py"
            changed_file.write_text("def function_000():\n    return 999999\n")
            changed = run_pass(db, repo, root)
            output = {
                "fixture": {
                    "small_files": 80,
                    "large_file": "large_module.py",
                    "large_lines_requested": args.large_lines,
                    "large_file_bytes": (root / "large_module.py").stat().st_size,
                },
                "passes": {"first": first, "unchanged": unchanged, "one_file_changed": changed},
                "fake_embedding_model": {"encode_calls": fake_model.calls, "inputs": fake_model.inputs},
            }
            print(json.dumps(output, indent=2))
    finally:
        generator.PROVIDER = old_provider
        generator._local_model = old_model
        db.close()
        engine.dispose()


if __name__ == "__main__":
    main()
