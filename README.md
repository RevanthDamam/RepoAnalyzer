# RepoAnalyzer

RepoAnalyzer is a **zero-AI-scan** codebase intelligence platform built with **React**, **FastAPI**, **SQLite**, and **Groq LLM**. It crawls any local repository, ranks files by importance, performs static AST analysis, builds a directed import graph, indexes vector embeddings, and answers developer questions via context-aware RAG — all without spending AI tokens during the scan itself.

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

### 1. Backend (FastAPI + SQLite)

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

---

## 🗂️ Features at a Glance

| Panel | What it shows |
|-------|---------------|
| **Overview** | Total files indexed, language distribution donut, and a full categorized table of every library/framework detected from `requirements.txt` and `package.json` |
| **File Explorer** | Importance-ranked file list with symbols, LOC, complexity score |
| **Chat** | Ask any question about the codebase — answered by Groq with file-source citations |
| **Architecture** | Parsed API routes, class definitions, and function signatures |
| **Dependencies** | Directed import graph — only shows files with active imports/exports |
| **Security** | Static checks for hardcoded secrets, dangerous calls, and missing guards |
| **Quality** | LOC counters, cyclomatic complexity grades, code smell list |
| **Learning Path** | Auto-generated step-by-step developer onboarding guide |

---

## 🔑 Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GROQ_API_KEY` | Yes | — | Groq API key for LLM chat answers |
| `GROQ_MODEL` | No | `llama-3.1-8b-instant` | Groq model to use |

> **SQLite** is used by default — no external database setup needed. The DB file `repo_analyzer.db` is created automatically in `backend/` on first run.

---

## 📦 Tech Stack

**Backend** — Python, FastAPI, Uvicorn, SQLAlchemy, SQLite, sentence-transformers, NumPy, Groq SDK

**Frontend** — React 19, Vite, lucide-react, vanilla CSS

---

## 📄 License

MIT
