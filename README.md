# RepoAnalyzer

RepoAnalyzer is an intelligent codebase indexing and semantical querying application built with **React**, **FastAPI**, **PostgreSQL**, and **Groq LLM**. It scans repos, ranks files by semantic importance, extracts framework technologies with no AI cost, hashes files for smart caching, generates hierarchical summaries, indexes vector embeddings, and performs context-compressed RAG queries.

---

## 🏗️ Architecture Pipeline (11 Stages)

1. **Repository Scanner (No AI)**: Walks the repo to extract paths, sizes, extensions, and hashes.
2. **Smart File Classification (No AI)**: Ranks files by importances (0 to 100) based on location and naming templates.
3. **Detect Technologies (No AI)**: Inspects package configs (e.g. `package.json`, `requirements.txt`) to extract framework metadata.
4. **Folder Summaries**: Bottom-up directory walk summarizing leaf folder elements first, propagating to root directories.
5. **File Summaries**: Analyzes important file logic, extracting core responsibilities and imports.
6. **Embeddings**: Formulates vector models for directories, files, and READMEs.
7. **Metadata DB**: Logs statistical details and detected frameworks for instant responses.
8. **Caching**: Computes SHA256 hashes of code elements to bypass LLM calls on unchanged files.
9. **User Question Retrieval**: Semi-structured semantic query matching top 8 sources.
10. **Context Compression Layer**: Strips code comments, redundant spacing, and formatting to conserve LLM tokens.
11. **Collaborative Multi-Agent Style**: Spawns domain sub-agents (Architecture, Code, and Database) and synthesizes their observations.

---

## ⚡ Quick Start

### 1. Database (PostgreSQL)
Ensure you have Docker running, then start the database container:
```bash
docker-compose up -d
```

### 2. Backend (FastAPI)
1. Navigate to backend:
   ```bash
   cd backend
   ```
2. Create and activate a virtual environment:
   ```bash
   python -m venv venv
   # On Windows:
   .\venv\Scripts\activate
   # On macOS/Linux:
   source venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Configure `.env` file (copy from `.env.example`):
   ```ini
   DATABASE_URL=postgresql://postgres:postgrespassword@localhost:5432/repo_analyzer
   GROQ_API_KEY=your_actual_groq_key
   EMBEDDING_PROVIDER=local
   ```
5. Run the dev server:
   ```bash
   uvicorn app.main:app --reload
   ```
   The backend API will run at `http://127.0.0.1:8000`.

### 3. Frontend (React + Vite)
1. Navigate to frontend:
   ```bash
   cd frontend
   ```
2. Install packages:
   ```bash
   npm install
   ```
3. Run Vite server:
   ```bash
   npm run dev
   ```
   The application UI will run at `http://localhost:5173`.
