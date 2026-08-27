# RepoAnalyzer Incremental Indexing Optimization Report

**Author:** Manus AI  
**Date:** 27 August 2026  
**Repository:** `RevanthDamam/RepoAnalyzer`

## Executive summary

RepoAnalyzer now uses a true metadata-first incremental indexing path. Each discovered file records its relative path, byte size, nanosecond modification time, and SHA-256 content hash. On the normal path, matching path, size, and mtime reuse the prior hash and avoid rereading the file. `STRICT_HASHING=true` remains available when every scan must recompute SHA-256. Files whose content hash is unchanged skip static file reads, complexity calculation, AST/symbol replacement, and downstream changed-file work. New, modified, or removed files are still handled correctly.

Static analysis now parses the original source rather than a destructive compressed copy. This preserves Python AST line numbers and raw source segments, avoids a second full-file allocation, and retains the existing complexity and symbol behavior. Database commits for static symbols and embeddings are batched. Embeddings are content-hash aware, generated in bounded batches, and committed incrementally so a later run can reuse completed units after a partial failure or cancellation.

The repository becomes `completed` and statically browsable before the embedding phase begins. A persistent `embedding_status` field reports `pending`, `running`, `completed`, or `failed`; exact path, filename, and symbol retrieval remains available even when vector coverage is incomplete. Existing hybrid RAG behavior is preserved and now merges bounded exact matches with vector candidates.

## Updated pipeline

| Stage | Previous behavior | Optimized behavior |
|---|---|---|
| Discovery and hashing | Read and hashed every analyzable file | Compare cached path/size/mtime first; hash only new or metadata-changed files unless strict mode is enabled |
| File persistence | Updated file metadata without incremental work classification | Computes changed, skipped, and removed path sets and persists size/mtime/hash metadata |
| Static analysis | Read, compressed, and parsed every file | Reads and parses only changed files using original source; unchanged symbols and metrics remain intact |
| Dependencies | Rebuilt on every scan and import resolution can scan every repository path | Skips when there are no changed paths; changed scans use a precomputed suffix index and bounded inserts, while rebuilding the full graph to preserve fan-in/fan-out correctness |
| Features and technology | Recomputed on every scan | Recomputed only when files changed or the repository has no cached result |
| Embeddings | Cleared and regenerated | Reuses content-hash matches, generates only missing units, commits batches, and removes stale rows after replacement succeeds |
| User availability | Static and embedding work completed as one blocking phase | Repository is browsable after static analysis; embedding progress is separately observable and resumable |
| Folder persistence | Query and commit for each folder | Prefetch existing folder paths and insert missing folders in one batch |
| Retrieval | Vector search plus exact source snippets | Vector candidates are merged with bounded exact file/path/symbol candidates and deduplicated |

The orchestration and progress metrics are implemented in [`routes.py`][1], discovery in [`crawler.py`][2], original-source static processing in [`folder_summary.py`][3] and [`ast_parser.py`][4], and cache-aware embedding persistence in [`generator.py`][5].

## Implementation details

### Incremental file detection

`File.size_bytes` and `File.mtime_ns` provide the cheap pre-check, while the existing `File.hash` remains the authoritative content identity used to decide whether static work is required. A cached hash is reused only when the relative path, size, and mtime match. Strict mode bypasses that reuse and recomputes SHA-256 for every analyzable file. Removed paths are included in the changed set so their database records and dependent semantic rows are cleaned up.

### Correct static analysis for large source files

The static pipeline no longer creates a compressed source copy before complexity and AST processing. Complexity is calculated from the original text, and Python symbol extraction uses `ast.parse` and `ast.get_source_segment` against that same original text. Consequently, blank lines and comments continue to occupy their original positions, so symbol line locations remain meaningful. JavaScript and TypeScript line-based extraction also sees the original source line numbering.

Only changed files are opened, parsed, and have their symbols replaced. Folder reconciliation remains inexpensive metadata work, and unchanged symbols and file metrics are retained. Static commits use `STATIC_ANALYSIS_BATCH_SIZE` rather than committing once per file.

### Old baseline comparison

The attached old repository is at commit `18a263f` (`Fix Groq model deprecation causing summary 502`). Its apparent speed advantage is not a valid functional performance baseline: the old static pipeline compresses Python source by removing indentation before calling the AST parser. On the shared deterministic fixture, the old run processed 81 files but produced **0 symbol rows and 0 embedding rows**. It was faster because required analysis silently failed or was skipped, so that behavior must not be restored.

To obtain an apples-to-apples control, the benchmark also includes `legacy-valid`, which keeps the old per-file symbol delete/commit/insert/commit pattern and sequential embedding calls but parses original source. On the same 81-file, 12,000-line fixture, the optimized current first pass took **6.0158 seconds with 58 database commits and 49 batched model calls**, while the valid legacy control took **6.1621 seconds with 323 database commits and 3,080 model calls**. Both produced 3,080 symbols and 3,080 embeddings. This measured comparison confirms that the transaction and embedding batching changes improve the valid path, while the old commit’s 0.1363-second result is functionally incomparable.

### Embedding cache, batching, and resumability

The embedding cache is keyed by entity type, path, and a deterministic SHA-256 hash of the embedding text. Existing legacy rows without `content_hash` are backfilled from their stored text when possible. Rows are not deleted until replacement rows have been committed. Local model generation uses `EMBEDDING_BATCH_SIZE` outer batches and `EMBEDDING_MODEL_BATCH_SIZE` model batches; each successfully generated batch is persisted immediately. If a later batch fails, already committed vectors remain available and the next indexing attempt can reuse them.

The current corpus intentionally remains compatible with the prior implementation: README and symbol entities are indexed with the same text format. No new external queue, Redis instance, Celery worker, or other infrastructure was introduced.

The dependency resolver now builds a suffix index once per full-graph rebuild. Exact paths remain the first lookup, while module/file suffix variants use indexed candidates instead of iterating through every repository path for every import. Dependency rows are inserted in `DEPENDENCY_BATCH_SIZE` chunks, preserving the existing full-rebuild semantics on changed scans.

### RAG and fallback behavior

Exact retrieval is bounded at the database query level across file paths, filenames, symbol names, and raw symbol code. The RAG query path combines up to four exact candidates with vector candidates, deduplicates by entity identity, and caps the combined candidate list at ten before existing context assembly and Groq answering. Exact source retrieval continues to use the established safe repository-file path and response limits.

### Observability and API compatibility

Existing `message` and `percent` progress fields remain unchanged. Progress payloads now additionally expose metrics such as `files_total`, `files_changed`, `files_skipped`, `files_processed`, `symbols_changed`, `symbols_total`, `embeddings_created`, `embeddings_reused`, stage timings, and total duration. Repository list/detail responses add the additive `embedding_status` field. Static completion is persisted before embeddings begin, while the final progress record includes the complete timing and work counters.

The crawler now emits heartbeat messages while walking and hashing large repositories, including a final `Crawling complete` message at 15 percent. This prevents the initial 10-percent label from appearing frozen and lets cancellation be observed during discovery. The heartbeat interval is configurable with `CRAWL_PROGRESS_INTERVAL_SECONDS` and defaults to 0.5 seconds. A local reproduction against the reported public `PDF_Reader_RAG` repository discovered 24 analyzable files in 0.0036 seconds, indicating that a deployment showing a prolonged 10-percent state should be restarted onto the latest commit and checked for runtime logs or a stale worker.

## Measurements

The benchmark was run locally on the final implementation using [`bench_incremental_indexing.py`][6]. It creates 80 small Python files plus a deterministic 258,818-byte source file requested at 12,000 lines, uses an in-process fake embedding model to exclude model-download and network variance, and measures the same discovery, persistence, static, dependency, and embedding orchestration used by the application. These are observed sandbox measurements, not production capacity guarantees.

| Pass | Wall time (s) | Files total | Files changed | Files skipped | Static files processed | Embeddings created | Embeddings reused |
|---|---:|---:|---:|---:|---:|---:|---:|
| First index | 5.9889 | 81 | 81 | 0 | 81 | 3,080 | 0 |
| Unchanged rescan | 0.9712 | 81 | 0 | 81 | 0 | 0 | 3,080 |
| One-file change | 1.0193 | 81 | 1 | 80 | 1 | 1 | 3,079 |

The first pass parsed 3,080 symbols. The unchanged pass parsed zero files and encoded zero new embeddings. The one-file change processed one static file and generated one new embedding while reusing 3,079 existing vectors. The fake model received 3,081 total inputs across all three passes, confirming that the unchanged pass did not encode the repository again. The benchmark is intentionally practical rather than a 50,000-line stress test; production measurements should be collected with the target repository and embedding provider.

## Database migration and deployment settings

Startup migration remains lightweight and backward-compatible. Existing databases receive `repositories.embedding_status`, `files.size_bytes`, `files.mtime_ns`, and `embeddings.content_hash` when missing. New installations receive these columns through the SQLAlchemy models. No destructive migration or data reset is required.

| Variable | Default | Purpose |
|---|---:|---|
| `STRICT_HASHING` | `false` | Recompute SHA-256 on every analyzable file when set to `true`, `1`, or `yes` |
| `CRAWL_PROGRESS_INTERVAL_SECONDS` | `0.5` | Minimum interval between crawler heartbeat progress updates |
| `STATIC_ANALYSIS_BATCH_SIZE` | `100` | Number of changed files between static-analysis commits |
| `DEPENDENCY_BATCH_SIZE` | `1000` | Number of dependency rows inserted per batch |
| `EMBEDDING_BATCH_SIZE` | `64` | Number of texts per embedding-generation/persistence batch |
| `EMBEDDING_MODEL_BATCH_SIZE` | `32` | Number of texts passed to the local model per encode call |

These settings are documented in [`backend/.env.example`][7]. A deployment should restart the backend after changing them. Existing repositories do not require a manual reset; the next scan backfills metadata and embedding hashes as needed.

## Validation completed

The final validation included backend bytecode compilation, `git diff --check`, a temporary end-to-end incremental regression, a temporary legacy-schema migration regression, the deterministic benchmark, frontend lint, frontend production build, and a source scan confirming that `dangerouslySetInnerHTML` is not present in `frontend/src`. The incremental regression verified strict hashing, cheap hash reuse, original Python line locations, zero static work on an unchanged scan, one-file reprocessing, embedding reuse, and changed-symbol regeneration. Frontend lint completed with **0 errors and 3 pre-existing hook-dependency warnings**; the production build completed successfully.

## Remaining bottlenecks and deliberate trade-offs

Dependency analysis still rebuilds the full graph when any file changes. This is deliberate: selective edge updates can incorrectly leave fan-in/fan-out metrics stale for files affected indirectly by an import change. The unchanged path skips dependency work entirely, which is the important large-repository rescan case.

Vector search still loads repository embedding rows into NumPy for cosine ranking. The exact path/name fallback is database-bounded, but a very large vector corpus may eventually justify a dedicated vector index. That additional infrastructure was not introduced because the current request prioritizes simple maintainable changes and the benchmark’s dominant improvement is eliminating redundant file parsing and embedding generation.

The in-memory cancellation set remains process-local, as before. Batch commits make embedding retries useful, but cancellation is observed at progress checkpoints rather than interrupting an individual model encode call. Multi-process cancellation or durable job scheduling would require infrastructure that was outside the requested scope.

## References

[1]: backend/app/api/routes.py "Scan orchestration, progress metrics, repository responses, and embedding phase status"
[2]: backend/app/scanner/crawler.py "Metadata-first repository crawler and strict hashing option"
[3]: backend/app/summarizer/folder_summary.py "Changed-file static analysis and batched symbol persistence"
[4]: backend/app/analysis/ast_parser.py "Original-source AST and line-based symbol extraction"
[5]: backend/app/embeddings/generator.py "Content-hash-aware, batched, resumable embedding persistence"
[6]: backend/bench_incremental_indexing.py "Deterministic incremental indexing benchmark harness"
[7]: backend/.env.example "Deployment and performance environment settings"
[8]: backend/app/scanner/crawler.py "Crawler heartbeat progress and cancellation checkpoints"
[9]: backend/app/analysis/dependency.py "Indexed dependency resolution and bounded dependency persistence"
[10]: backend/bench_incremental_indexing.py "Current, valid-legacy-control, and old-commit benchmark modes"
