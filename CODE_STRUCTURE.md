# Codebase Structure & Component Map - RepoAnalyzer 2.0

This document outlines the directory structure of **RepoAnalyzer 2.0** and maps the responsibilities, exports, and integrations for every core backend module and frontend component.

---

## 📁 Directory Structure

```
RepoAnalyzer/
├── docker-compose.yml       # Docker configuration for local PostgreSQL DB (optional)
├── run.ps1                  # Startup script to run frontend and backend servers
├── README.md                # Quick-start setup and run instructions
├── CODE_STRUCTURE.md        # [This File] Codebase structure and component mappings
├── backend/
│   ├── requirements.txt     # Python dependency lists
│   ├── .env                 # Active local environment variables
│   └── app/
│       ├── __init__.py      # App package initialization
│       ├── main.py          # FastAPI application server & core mounting
│       ├── database/
│       │   ├── models.py      # SQLAlchemy schemas (File, Symbol, Dependency, etc.)
│       │   └── connection.py  # DB engine, session controls & SQLite fallbacks
│       ├── scanner/
│       │   ├── crawler.py     # Stage 1: Filesystem recursive crawling
│       │   ├── classifier.py  # Stage 2: Relevance file ranking (0-100)
│       │   ├── detector.py    # Stage 3: Static technology manifest detector
│       │   └── hasher.py      # Stage 8: SHA256 file hashing
│       ├── analysis/
│       │   ├── ast_parser.py  # Statically parses symbols, classes, routes via AST
│       │   ├── dependency.py  # Mappings directed imports graph & fan-in/fan-out LOC
│       │   ├── complexity.py  # Measures LOC & cyclomatic complexity indexes
│       │   ├── feature_detector.py # Extracts Payments, auth, redis features (no AI)
│       │   ├── quality.py     # Audits quality grades & registers code smells lists
│       │   └── learning.py    # Builds step-by-step developer onboarding paths
│       ├── summarizer/
│       │   ├── compression.py # Stage 10: Stripping comments & whitespaces
│       │   ├── file_summary.py # Stage 5: AI file summarization with AST tags
│       │   └── folder_summary.py # Stage 4: Hierarchical bottom-up summaries
│       ├── embeddings/
│       │   ├── generator.py   # Stage 6: Dense vectors calculation
│       │   └── search.py      # Cosine similarity matching via numpy
│       ├── rag/
│       │   ├── routing.py     # Intent-based routing interceptor (0 AI cost!)
│       │   ├── retrieval.py   # Context compile & raw logic injection
│       │   └── agents.py      # Groq single and multi-agent coordination
│       └── api/
│           └── routes.py      # Core APIRouter endpoints for scans & audits
└── frontend/
    ├── package.json         # Node scripts & dependency manifests
    ├── vite.config.js       # Vite build setup & backend proxy config
    └── src/
        ├── index.css        # Premium dark slate variables, layout grids, chat styles
        ├── App.jsx          # React routing & state controller
        ├── main.jsx         # React app entry point
        ├── utils/
        │   └── fileExplanation.js # Shared utility for generating brief file explanations
        └── components/
            ├── RepoSelector.jsx  # Scanned projects list & progress indexer input
            ├── Dashboard.jsx     # Statistics & tech stack visualization cards
            ├── FileTree.jsx      # Sorted file ranks view with score classification
            ├── ChatInterface.jsx # Chat interface, sub-agent boards, retrieved citations
            ├── Architecture.jsx  # Mappings OOP class lists and API endpoints
            ├── Dependencies.jsx  # Traces import relationships & impact scopes
            ├── Security.jsx      # Vulnerability checklists & guardrails
            ├── Quality.jsx       # LOC counters, complexity scores, smells list
            └── Learning.jsx      # Onboarding guide checklists & file loaders
```

---

## ⚙️ Backend Modules (`backend/app/`)

### 🔌 Database (`database/`)
* **[models.py](file:///c:/Users/revan/Downloads/Projects/RepoAnalyzer/backend/app/database/models.py)**: SQLAlchemy models including `Repository` (techs, features JSON), `File` (metrics, score, hash), `Folder` (path, summary), `Symbol` (type, lines, raw code), `Dependency` (import edge nodes), and `Embedding` (vector coordinates).
* **[connection.py](file:///c:/Users/revan/Downloads/Projects/RepoAnalyzer/backend/app/database/connection.py)**: DB engine generation, sessions, and SQLite fallbacks.

### 🔍 Scanner (`scanner/`)
* **[crawler.py](file:///c:/Users/revan/Downloads/Projects/RepoAnalyzer/backend/app/scanner/crawler.py)**: Stage 1 recursive filesystem walk.
* **[classifier.py](file:///c:/Users/revan/Downloads/Projects/RepoAnalyzer/backend/app/scanner/classifier.py)**: Stage 2 rule-based importance scoring.
* **[detector.py](file:///c:/Users/revan/Downloads/Projects/RepoAnalyzer/backend/app/scanner/detector.py)**: Stage 3 technology detector from manifest parsing (no AI).
* **[hasher.py](file:///c:/Users/revan/Downloads/Projects/RepoAnalyzer/backend/app/scanner/hasher.py)**: Stage 8 file hash compiler.

### 📊 Analysis (`analysis/`)
* **[ast_parser.py](file:///c:/Users/revan/Downloads/Projects/RepoAnalyzer/backend/app/analysis/ast_parser.py)**: Parses python `ast` and JS/TS regex structures to log symbols, classes, functions, and API endpoints.
* **[dependency.py](file:///c:/Users/revan/Downloads/Projects/RepoAnalyzer/backend/app/analysis/dependency.py)**: Compiles import relationships and computes file `fan_in`/`fan_out` metrics.
* **[complexity.py](file:///c:/Users/revan/Downloads/Projects/RepoAnalyzer/backend/app/analysis/complexity.py)**: Computes LOC and cyclomatic complexity (branches, loops, conditionals).
* **[feature_detector.py](file:///c:/Users/revan/Downloads/Projects/RepoAnalyzer/backend/app/analysis/feature_detector.py)**: Statically audits code files for database, authentication, redis, cron, payments, and docker.
* **[quality.py](file:///c:/Users/revan/Downloads/Projects/RepoAnalyzer/backend/app/analysis/quality.py)**: Runs static audits identifying code smells (too large files, complex branches, tight coupling) and generates a rating grade (A-F).
* **[learning.py](file:///c:/Users/revan/Downloads/Projects/RepoAnalyzer/backend/app/analysis/learning.py)**: Builds step-by-step developer onboarding paths.

### 📝 Summarizer (`summarizer/`)
* **[compression.py](file:///c:/Users/revan/Downloads/Projects/RepoAnalyzer/backend/app/summarizer/compression.py)**: Stage 10 regex filter to strip comments and spaces.
* **[file_summary.py](file:///c:/Users/revan/Downloads/Projects/RepoAnalyzer/backend/app/summarizer/file_summary.py)**: Groq file summarizer integrating AST symbol checklists to reduce hallucinations.
* **[folder_summary.py](file:///c:/Users/revan/Downloads/Projects/RepoAnalyzer/backend/app/summarizer/folder_summary.py)**: Walk folder directories bottom-up, generating cached folder summary maps.

### 🧬 Embeddings (`embeddings/`)
* **[generator.py](file:///c:/Users/revan/Downloads/Projects/RepoAnalyzer/backend/app/embeddings/generator.py)**: Dense vectors calculations for readme, files, folders, and code symbols.
* **[search.py](file:///c:/Users/revan/Downloads/Projects/RepoAnalyzer/backend/app/embeddings/search.py)**: Cosine similarity matching using numpy.

### 🧠 Retrieval Engine (`rag/`)
* **[routing.py](file:///c:/Users/revan/Downloads/Projects/RepoAnalyzer/backend/app/rag/routing.py)**: Intent-based query router intercepting Docker, auth, redis, payments, symbol locate, and dependency impact queries instantly (0 AI cost!).
* **[retrieval.py](file:///c:/Users/revan/Downloads/Projects/RepoAnalyzer/backend/app/rag/retrieval.py)**: Context compilation and raw code injection.
* **[agents.py](file:///c:/Users/revan/Downloads/Projects/RepoAnalyzer/backend/app/rag/agents.py)**: RAG entrypoint running single-agent promptings or collaborative multi-agent synthesizer reports.

### 🚀 API Router (`api/`)
* **[routes.py](file:///c:/Users/revan/Downloads/Projects/RepoAnalyzer/backend/app/api/routes.py)**: Configures API endpoints for scan queueing, repository dashboard queries, and newly added analytical panels (architecture, dependencies, quality, and onboarding).

---

## 🎨 Frontend Panels (`frontend/src/`)

### 🛠️ Utilities (`utils/`)
* **[fileExplanation.js](file:///c:/Users/revan/Downloads/Projects/RepoAnalyzer/frontend/src/utils/fileExplanation.js)**: Shared helper that returns a brief explanation for a given code file, prioritizing AI-generated summaries and using structured fallbacks for various configuration and component file paths.

### 🧩 Components (`components/`)
* **[App.jsx](file:///c:/Users/revan/Downloads/Projects/RepoAnalyzer/frontend/src/App.jsx)**: Central router with tab states for `Overview`, `Architecture`, `Dependencies`, `Security`, `Quality`, and `Learning Path`. Mounts sidebars for code ranking and details.
* **[RepoSelector.jsx](file:///c:/Users/revan/Downloads/Projects/RepoAnalyzer/frontend/src/components/RepoSelector.jsx)**: Workspace selection panel with scanning progress metrics.
* **[Dashboard.jsx](file:///c:/Users/revan/Downloads/Projects/RepoAnalyzer/frontend/src/components/Dashboard.jsx)**: Displays static technology categories (ORMs, Auth, Database, Frameworks) and counters.
* **[FileTree.jsx](file:///c:/Users/revan/Downloads/Projects/RepoAnalyzer/frontend/src/components/FileTree.jsx)**: Relevance ranked list of codebase files.
* **[ChatInterface.jsx](file:///c:/Users/revan/Downloads/Projects/RepoAnalyzer/frontend/src/components/ChatInterface.jsx)**: QA bot with collaborative boards and citation details.
* **[Architecture.jsx](file:///c:/Users/revan/Downloads/Projects/RepoAnalyzer/frontend/src/components/Architecture.jsx)**: Displays static route endpoints and class symbols parsed from files.
* **[Dependencies.jsx](file:///c:/Users/revan/Downloads/Projects/RepoAnalyzer/frontend/src/components/Dependencies.jsx)**: Displays directed import dependencies. Enables interactive node inspection to see file imports and dependent modules.
* **[Security.jsx](file:///c:/Users/revan/Downloads/Projects/RepoAnalyzer/frontend/src/components/Security.jsx)**: Visualizes static security checks for dangerous function calls or hardcoded secrets.
* **[Quality.jsx](file:///c:/Users/revan/Downloads/Projects/RepoAnalyzer/frontend/src/components/Quality.jsx)**: Renders LOC counters, complexity scores, rating grades, and list of code smells.
* **[Learning.jsx](file:///c:/Users/revan/Downloads/Projects/RepoAnalyzer/frontend/src/components/Learning.jsx)**: Generates onboarding guides. Users can click any file path badge to open the source code in the details panel instantly.
