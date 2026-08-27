"""Measure dependency extraction with and without persistent import-cache reuse.

Usage: python bench_dependency_cache.py [--files 1000]
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


def build_fixture(root: Path, count: int) -> list[str]:
    paths = []
    for index in range(count):
        path = root / "pkg" / f"module_{index:04d}.py"
        path.parent.mkdir(parents=True, exist_ok=True)
        target = (index + 1) % count
        path.write_text(f"from pkg.module_{target:04d} import value_{target}\nvalue_{index} = {index}\n")
        paths.append(path.relative_to(root).as_posix())
    return paths


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--files", type=int, default=1000)
    args = parser.parse_args()
    if args.files < 10:
        raise SystemExit("--files must be at least 10")

    with TemporaryDirectory() as directory:
        root = Path(directory)
        paths = build_fixture(root, args.files)
        engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(engine)
        db = sessionmaker(bind=engine)()
        repo = Repository(name="dependency-benchmark", path=str(root), status="scanning")
        db.add(repo)
        db.commit()
        for path in paths:
            db.add(File(repo_id=repo.id, path=path, filename=Path(path).name, extension=".py", importance_score=80))
        db.commit()

        cold_started = time.perf_counter()
        cold = analyze_dependencies(db, repo.id, str(root), changed_paths=set(paths))
        cold["seconds"] = round(time.perf_counter() - cold_started, 4)

        cached_started = time.perf_counter()
        cached = analyze_dependencies(
            db,
            repo.id,
            str(root),
            changed_paths={paths[0]},
            content_cache={paths[0]: (root / paths[0]).read_text(encoding="utf-8")},
        )
        cached["seconds"] = round(time.perf_counter() - cached_started, 4)
        print(json.dumps({"files": args.files, "cold": cold, "incremental_cached": cached}, indent=2))
        db.close()
        engine.dispose()


if __name__ == "__main__":
    main()
