# Codebase Structure & Component Map — RepoAnalyzer

This document outlines the directory structure of **RepoAnalyzer** and maps the responsibilities, exports, and integrations for every core backend module and frontend component.

---

## 📁 Directory Structure

```
RepoAnalyzer/
├── run.ps1                  # Startup script to run frontend and backend servers
├── docker-compose.yml       # Docker Compose for containerised local dev
├── README.md                # Quick-start setup and run instructions
├── CODE_STRUCTURE.md        # [This File] Codebase structure and component mappings
├── backend/
│   ├── requirements.txt     # Python dependency list
│   ├── .env                 # Active local environment variables (API keys)
│   └── app/
│       ├── __init__.py      # App package initialization
│       ├── main.py          # FastAPI application server & core mounting
│       ├── database/
│       │   ├── models.py      # SQLAlchemy schemas (Repository, File, Symbol, Dependency, Embedding)
│       │   └── connection.py  # DB engine, session controls & SQLite/Postgres setup
│       ├── scanner/
│       │   ├── crawler.py     # Stage 1: Filesystem recursive crawling
│       │   ├── classifier.py  # Stage 2: Relevance file ranking (0–100)
│       │   ├── detector.py    # Stage 3: Static technology manifest detector
│       │   └── hasher.py      # SHA256 file hashing
│       ├── analysis/
│       │   ├── ast_parser.py  # Statically parses symbols, classes, routes via AST
│       │   ├── dependency.py  # Builds directed import graph & computes fan-in/fan-out
│       │   ├── complexity.py  # Measures LOC & cyclomatic complexity indexes
│       │   ├── feature_detector.py # Extracts auth, payments, redis, docker features (no AI)
│       │   ├── quality.py     # Audits quality grades & registers code smell lists
│       │   └── learning.py    # Builds step-by-step developer onboarding paths
│       ├── summarizer/
│       │   ├── compression.py # Strips comments & whitespace for context compression
│       │   └── folder_summary.py # Hierarchical bottom-up static folder analysis
│       ├── embeddings/
│       │   ├── generator.py   # Dense vector calculation (sentence-transformers)
│       │   └── search.py      # Cosine similarity matching via NumPy
│       ├── rag/
│       │   ├── routing.py     # Intent-based routing interceptor (0 AI cost)
│       │   ├── retrieval.py   # Context compilation & raw code injection
│       │   └── agents.py      # Groq single-agent & multi-agent coordination
│       └── api/
│           └── routes.py      # Core APIRouter endpoints for scans, queries & audits
└── frontend/
    ├── package.json         # Node scripts & dependency manifests
    ├── vite.config.js       # Vite build setup & dev-server proxy config
    ├── index.html           # HTML shell
    ├── .env.local           # Local dev environment (VITE_API_BASE_URL → localhost)
    ├── .env.production      # Production environment (VITE_API_BASE_URL → Render URL)
    └── src/
        ├── index.css        # Premium dark-gold design tokens, layout grids, mobile media queries
        ├── App.jsx          # Central React router, tab state, and repo/file selection
        ├── main.jsx         # React app entry point
        ├── utils/
        │   ├── api.js             # Centralised apiFetch helper (reads VITE_API_BASE_URL)
        │   └── fileExplanation.js # Static file explanation heuristics
        └── components/
            ├── RepoSelector.jsx  # Project selector, scanning progress tracker & path input
            ├── Dashboard.jsx     # Overview: AI summary, language donut, files count, packages
            ├── FileTree.jsx      # Hierarchical sorted file tree with importance scores
            ├── FilesView.jsx     # Two-pane file explorer: tree sidebar + syntax-highlighted code viewer
            ├── ChatInterface.jsx # AI chat, sub-agent collaboration boards, RAG source citations
            ├── Architecture.jsx  # Interactive infinite-canvas node graph of the directory tree
            ├── Dependencies.jsx  # Directed import graph with fan-in/fan-out analysis
            ├── Security.jsx      # Vulnerability checklists & hardcoded secret detection
            ├── Quality.jsx       # LOC counters, complexity scores, smell lists & grade
            └── Learning.jsx      # Auto-generated developer onboarding guide with file badges
```

---

## ⚙️ Backend Modules (`backend/app/`)

### 🔌 Database (`database/`)
* **[models.py](file:///c:/Users/revan/Downloads/Projects/RepoAnalyzer/backend/app/database/models.py)**: SQLAlchemy models — `Repository` (techs, features, folder structure, cached `codebase_summary` JSON), `File` (metrics, importance score, hash, LOC, complexity, fan-in, fan-out, raw content), `Folder` (path), `Symbol` (type, lines, raw code), `Dependency` (import edge), `Embedding` (dense vector coordinates).
* **[connection.py](file:///c:/Users/revan/Downloads/Projects/RepoAnalyzer/backend/app/database/connection.py)**: DB engine factory, session management, and SQLite/Postgres database setup. Reads `DATABASE_URL` from the environment, falling back to a local SQLite file.

### 🔍 Scanner (`scanner/`)
* **[crawler.py](file:///c:/Users/revan/Downloads/Projects/RepoAnalyzer/backend/app/scanner/crawler.py)**: Stage 1 — recursive filesystem walk with `.gitignore` awareness.
* **[classifier.py](file:///c:/Users/revan/Downloads/Projects/RepoAnalyzer/backend/app/scanner/classifier.py)**: Stage 2 — rule-based file importance scoring (0–100) by path pattern and naming conventions.
* **[detector.py](file:///c:/Users/revan/Downloads/Projects/RepoAnalyzer/backend/app/scanner/detector.py)**: Stage 3 — technology stack detection from `package.json`, `requirements.txt`, `Dockerfile`, and `docker-compose.yml` (no AI).
* **[hasher.py](file:///c:/Users/revan/Downloads/Projects/RepoAnalyzer/backend/app/scanner/hasher.py)**: SHA-256 file hashing for change detection.

### 📊 Analysis (`analysis/`)
* **[ast_parser.py](file:///c:/Users/revan/Downloads/Projects/RepoAnalyzer/backend/app/analysis/ast_parser.py)**: Parses Python `ast` and JS/TS regex structures to log symbols, classes, functions, and API route endpoints.
* **[dependency.py](file:///c:/Users/revan/Downloads/Projects/RepoAnalyzer/backend/app/analysis/dependency.py)**: Compiles import relationships and computes per-file `fan_in` / `fan_out` metrics.
* **[complexity.py](file:///c:/Users/revan/Downloads/Projects/RepoAnalyzer/backend/app/analysis/complexity.py)**: Computes LOC and cyclomatic complexity (branches, loops, conditionals).
* **[feature_detector.py](file:///c:/Users/revan/Downloads/Projects/RepoAnalyzer/backend/app/analysis/feature_detector.py)**: Statically audits files for database, authentication, Redis, cron, payments, and Docker patterns.
* **[quality.py](file:///c:/Users/revan/Downloads/Projects/RepoAnalyzer/backend/app/analysis/quality.py)**: Identifies code smells (oversized files, high branching, tight coupling) and generates A–F rating grades.
* **[learning.py](file:///c:/Users/revan/Downloads/Projects/RepoAnalyzer/backend/app/analysis/learning.py)**: Builds step-by-step developer onboarding paths ordered by file importance.

### 📝 Summarizer (`summarizer/`)
* **[compression.py](file:///c:/Users/revan/Downloads/Projects/RepoAnalyzer/backend/app/summarizer/compression.py)**: Regex-based comment and whitespace stripping for RAG context compression.
* **[folder_summary.py](file:///c:/Users/revan/Downloads/Projects/RepoAnalyzer/backend/app/summarizer/folder_summary.py)**: Bottom-up folder hierarchy builder for static project structure maps.

### 🧬 Embeddings (`embeddings/`)
* **[generator.py](file:///c:/Users/revan/Downloads/Projects/RepoAnalyzer/backend/app/embeddings/generator.py)**: Dense vector generation for README content, files, folders, and code symbols using `sentence-transformers`.
* **[search.py](file:///c:/Users/revan/Downloads/Projects/RepoAnalyzer/backend/app/embeddings/search.py)**: Top-K cosine similarity retrieval using NumPy.

### 🧠 Retrieval Engine (`rag/`)
* **[routing.py](file:///c:/Users/revan/Downloads/Projects/RepoAnalyzer/backend/app/rag/routing.py)**: Intent-based query router — intercepts Docker, auth, Redis, payments, symbol-locate, and dependency impact queries instantly (0 AI tokens).
* **[retrieval.py](file:///c:/Users/revan/Downloads/Projects/RepoAnalyzer/backend/app/rag/retrieval.py)**: Full context compilation, vector search orchestration, and raw code injection.
* **[agents.py](file:///c:/Users/revan/Downloads/Projects/RepoAnalyzer/backend/app/rag/agents.py)**: RAG entrypoint — runs single-agent prompting or multi-agent collaborative synthesis with Architecture, Code Quality, and Dependency specialist agents.

### 🚀 API Router (`api/`)
* **[routes.py](file:///c:/Users/revan/Downloads/Projects/RepoAnalyzer/backend/app/api/routes.py)**: All REST endpoints — repository scanning (async background task), progress polling, file & dependency details, codebase summary caching/regeneration, package manifest, and query answering.

---

## 🎨 Frontend Panels (`frontend/src/`)

### 🛠️ Utilities (`utils/`)
* **[api.js](file:///c:/Users/revan/Downloads/Projects/RepoAnalyzer/frontend/src/utils/api.js)**: `apiFetch(path, options)` helper that prepends `VITE_API_BASE_URL` to every request, centralising the backend URL so switching between local and production only requires an env-var change.
* **[fileExplanation.js](file:///c:/Users/revan/Downloads/Projects/RepoAnalyzer/frontend/src/utils/fileExplanation.js)**: Heuristic lookup that returns a short plain-English description for common file names and paths.

### 🧩 Core App
* **[App.jsx](file:///c:/Users/revan/Downloads/Projects/RepoAnalyzer/frontend/src/App.jsx)**: Central router. Manages selected repo, selected file, active navigation tab (`overview` | `architecture` | `dependencies` | `files` | `chat`), and loading states. Renders the cinematic landing header, workspace pill navigation, and mounts the appropriate tab component. Uses `100dvh` height for correct mobile viewport handling.
* **[index.css](file:///c:/Users/revan/Downloads/Projects/RepoAnalyzer/frontend/src/index.css)**: Design system — CSS custom properties (gold/dark palette), glassmorphism utilities, workspace layout classes, chat bubble styles, and a comprehensive `@media (max-width: 768px)` block covering mobile drawer overlays, stacking grids, scrollable tab bars, and fluid typography.

### 🧩 Components (`components/`)
* **[RepoSelector.jsx](file:///c:/Users/revan/Downloads/Projects/RepoAnalyzer/frontend/src/components/RepoSelector.jsx)**: Landing panel with cinematic heading (`clamp()` responsive sizing), scanning input bar, example repo badges, and a live-polled list of scanned repositories with progress bars.
* **[Dashboard.jsx](file:///c:/Users/revan/Downloads/Projects/RepoAnalyzer/frontend/src/components/Dashboard.jsx)**: Overview dashboard — AI-generated codebase summary (via Groq), total files count, language conic-gradient donut chart, and a tabbed backend/frontend package table. Grid layout collapses to single-column on mobile.
* **[FileTree.jsx](file:///c:/Users/revan/Downloads/Projects/RepoAnalyzer/frontend/src/components/FileTree.jsx)**: Hierarchical, collapsible file tree sorted by importance score with extension-based icons and selection highlighting.
* **[FilesView.jsx](file:///c:/Users/revan/Downloads/Projects/RepoAnalyzer/frontend/src/components/FilesView.jsx)**: Two-pane file browser — left sidebar (`FileTree`) with collapse/expand toggle, right pane with regex-based syntax-highlighted code viewer (`CodeHighlight`). On mobile (`≤ 768px`) the sidebar becomes a **full-screen slide-out drawer overlay** that auto-closes on file selection.
* **[ChatInterface.jsx](file:///c:/Users/revan/Downloads/Projects/RepoAnalyzer/frontend/src/components/ChatInterface.jsx)**: RAG-powered chat UI — single-agent and collaborative multi-agent modes, sub-agent tabbed reports (Architecture / Code / Dependency agents), retrieved file citations with similarity scores. Input placeholder shortens on mobile.
* **[Architecture.jsx](file:///c:/Users/revan/Downloads/Projects/RepoAnalyzer/frontend/src/components/Architecture.jsx)**: Infinite-canvas node graph rendered from the live repository file tree. Supports mouse/touch pan and scroll-to-zoom. On desktop, a 380 px detail panel slides in from the right on node click; on mobile (`≤ 768px`) it slides up as a **50 vh bottom drawer**.
* **[Dependencies.jsx](file:///c:/Users/revan/Downloads/Projects/RepoAnalyzer/frontend/src/components/Dependencies.jsx)**: Import graph inspector — searchable file list (left sidebar on desktop, stacked on mobile) with fan-in / fan-out counts, plus a two-column detail panel (collapses to one column on mobile) showing inbound and outbound import lists.
* **[Security.jsx](file:///c:/Users/revan/Downloads/Projects/RepoAnalyzer/frontend/src/components/Security.jsx)**: Visualises static security checks — hardcoded secrets, dangerous function calls, and missing input guards per file.
* **[Quality.jsx](file:///c:/Users/revan/Downloads/Projects/RepoAnalyzer/frontend/src/components/Quality.jsx)**: LOC counters, cyclomatic complexity scores, A–F rating grade, and a full list of detected code smells.
* **[Learning.jsx](file:///c:/Users/revan/Downloads/Projects/RepoAnalyzer/frontend/src/components/Learning.jsx)**: Auto-generated step-by-step developer onboarding guide. File path badges open the source code in the file details panel on click.

---

## 📱 Mobile Responsiveness

The UI is fully responsive. Key adaptive behaviours:

| Breakpoint | Behaviour |
|------------|-----------|
| `≤ 768px` | Workspace navigation tabs become horizontally scrollable |
| `≤ 768px` | Dashboard two-column grid → single column |
| `≤ 768px` | File explorer sidebar → slide-out overlay drawer |
| `≤ 768px` | Architecture detail panel → bottom sheet drawer (50 vh) |
| `≤ 768px` | Dependencies sidebar and detail area → vertically stacked |
| `≤ 768px` | Cinematic heading scales via `clamp(2rem, 8vw, 3.6rem)` |

---

## 🌐 Deployment

| Target | Service | Config |
|--------|---------|--------|
| Backend | **Render** (Web Service) | Set `GROQ_API_KEY` in Render env vars |
| Frontend | **Vercel** (Static) | Set `VITE_API_BASE_URL` to Render backend URL |

All frontend API calls go through `src/utils/api.js` → `apiFetch()`, which reads `VITE_API_BASE_URL` at build time. No hardcoded URLs exist in component files.
