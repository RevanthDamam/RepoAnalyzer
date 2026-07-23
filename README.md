# RepoAnalyzer

RepoAnalyzer is a **zero-AI-scan** codebase intelligence platform built with **React**, **FastAPI**, **SQLite**, and **Groq LLM**. It crawls any local repository or public GitHub URL, ranks files by importance, performs static AST analysis, builds a directed import graph, indexes vector embeddings, and answers developer questions via context-aware RAG — all without spending AI tokens during the scan itself.

The UI is fully **responsive and mobile-friendly**, working seamlessly on phones, tablets, and desktops.

---

## 🏗️ Architecture Pipeline

| Stage | Step | AI Cost |
|-------|------|---------|
| 1 | **Repository Crawler** — Walks filesystem, extracts paths, sizes, extensions, hashes | None |
| 2 | **File Classifier** — Ranks files 0–100 by naming templates and directory location | None |
| 3 | **Technology Detector** — Reads `package.json`, `requirements.txt`, `Dockerfile` etc. to extract the framework stack | None |
| 4 | **Static Analysis Pipeline** — Runs AST symbol extraction (classes, functions, routes) and cyclomatic complexity | None |
| 5 | **Dependency Graph** — Builds directed import/require graph, computes fan-in / fan-out per file | None |
| 6 | **Feature Detection** — Audits code for auth, payments, redis, docker, testing patterns | None |
| 7 | **Embeddings** — Generates dense vector representations for README, file paths, and code symbols | None |
| 8 | **Intent Routing** — Intercepts common queries (Docker, auth, redis, symbols) with zero LLM token spend | None |
| 9 | **RAG Retrieval** — Top-8 cosine similarity vector search, plus exact file source injection | None |
| 10 | **Groq LLM Answer** — Single-agent or collaborative multi-agent Groq responses over full context | Groq API |

> **No AI is used during the repository scan.** Groq is only called when the user asks a question in the chat panel.

---

## ⚡ Quick Start

### Prerequisites
- Python 3.10+
- Node.js 18+
- A Groq API key (free at [console.groq.com](https://console.groq.com))

### 1. Backend (FastAPI + PostgreSQL)

```bash
cd backend

# Create and activate virtual environment
python -m venv venv
.\venv\Scripts\activate          # Windows
source venv/bin/activate         # macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env and set your GROQ_API_KEY
```

**`backend/.env`**
```ini
GROQ_API_KEY=your_actual_groq_key
GROQ_MODEL=llama-3.1-8b-instant
```

```bash
# Start dev server
uvicorn app.main:app --reload --port 8000
```

The API runs at `http://127.0.0.1:8000`.

---

### 2. Frontend (React + Vite)

```bash
cd frontend
npm install
npm run dev
```

The UI runs at `http://localhost:5173`.

**`frontend/.env.local`** (local development)
```ini
VITE_API_BASE_URL=http://localhost:8000
```

**`frontend/.env.production`** (production / Vercel deploy)
```ini
VITE_API_BASE_URL=https://your-backend.onrender.com
```

All API requests are centralized through `src/utils/api.js` (`apiFetch`) which reads `VITE_API_BASE_URL` automatically.

---

## 🗂️ Features at a Glance

| Panel | What it shows |
|-------|---------------|
| **Overview** | Total files indexed, language distribution donut, AI-generated project summary, and a full categorized table of every library/framework detected from `requirements.txt` and `package.json` |
| **Files** | Hierarchical file tree explorer with collapsible sidebar and inline syntax-highlighted source code viewer |
| **AI Chat** | Ask any question about the codebase — answered by Groq with file-source citations and optional multi-agent collaboration mode |
| **Architecture** | Interactive infinite-canvas node graph of the full directory tree, with a slide-out details panel per file/folder |
| **Dependencies** | Directed import graph — only shows files with active imports/exports, with fan-in/fan-out counters |

---

## 📱 Mobile Support

The entire UI is responsive and optimized for mobile and tablet:

- **Navigation tabs** horizontally scroll on narrow screens.
- **File Explorer** sidebar renders as a **slide-out drawer overlay** on mobile, auto-closing on file selection.
- **Architecture details panel** slides up from the **bottom of the screen** on mobile.
- **Dashboard** cards stack into a single-column layout on small viewports.
- **Dependencies** sidebar and detail area stack vertically on mobile.
- Cinematic headings scale responsively using `clamp()`.

---

## 🔑 Environment Variables

### Backend

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GROQ_API_KEY` | Yes | — | Groq API key for LLM chat answers |
| `GROQ_MODEL` | No | `llama-3.1-8b-instant` | Groq model to use |

> **SQLite** is used by default — no external database setup needed. The DB file `repo_analyzer.db` is created automatically in the project root on first run.

### Frontend

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_API_BASE_URL` | No | _(empty — same-origin proxy)_ | Base URL of the FastAPI backend |

---

## 📦 Tech Stack

**Backend** — Python, FastAPI, Uvicorn, SQLAlchemy, PostgerSQL, sentence-transformers, NumPy, Groq SDK

**Frontend** — React 19, Vite, lucide-react, vanilla CSS (fully responsive)

---

## 🚀 Deployment

| Service | Role |
|---------|------|
| **Render** | Hosts the FastAPI backend as a Web Service |
| **Vercel** | Hosts the React/Vite frontend as a static site |

Set `VITE_API_BASE_URL` in your Vercel environment variables to point at your Render backend URL before deploying.

---

## 📄 License

MIT
