import os
from sqlalchemy.orm import Session
from ..database.models import Repository
from groq import Groq
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), ".env"))
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant")

def get_groq_client():
    if not GROQ_API_KEY:
        return None
    try:
        return Groq(api_key=GROQ_API_KEY)
    except Exception:
        return None
from .retrieval import build_context_from_results, retrieve_exact_files
from .routing import route_user_query
from ..embeddings.search import search_embeddings

def answer_single_agent(client, repo_name: str, tech_stack: dict, context: str, user_question: str) -> str:
    """Standard Single Agent prompt answering."""
    prompt = f"""You are a senior developer analyzing the codebase of project '{repo_name}'.
You are given the metadata and retrieved summaries of files and folders.

---
DETECTED TECHNOLOGIES:
- Language: {tech_stack.get('language')} (Languages: {', '.join(tech_stack.get('languages', []))})
- Web Framework: {tech_stack.get('framework')}
- Database: {tech_stack.get('database')}
- ORM: {tech_stack.get('orm')}
- Authentication: {tech_stack.get('auth')}
- Docker support: {tech_stack.get('docker')}
- Tailwind CSS: {tech_stack.get('tailwind')}
- Testing Framework: {tech_stack.get('testing')}
- Build Tool: {tech_stack.get('build_tool')}
- Package Manager: {tech_stack.get('package_manager')}
---

RETIREVED CODEBASE CONTEXT:
{context}

---
USER QUESTION:
{user_question}

Answer the user's question clearly, drawing details from the context provided. Use Markdown.
"""
    try:
        completion = client.chat.completions.create(
            messages=[
                {"role": "system", "content": "You are a senior software developer. Answer technical questions directly based on codebase context. Use Markdown."},
                {"role": "user", "content": prompt}
            ],
            model=GROQ_MODEL,
            temperature=0.2,
            max_tokens=1000
        )
        return completion.choices[0].message.content.strip()
    except Exception as e:
        return f"Error executing Groq: {str(e)}"

def answer_multi_agent(client, repo_name: str, tech_stack: dict, context: str, user_question: str) -> dict:
    """
    Stage 11: Multi-Agent Style answering.
    Spawns three domain sub-agents and compiles with a Synthesizer.
    """
    agents_responses = {}
    
    # 1. Architecture Agent
    arch_prompt = f"""You are the 'Architecture Agent'. Analyze the overall structure, organization, and design patterns of the project '{repo_name}'.
Review the context and answer this specific question: {user_question}
Focus ONLY on how directories, files, components, and module layout play into the answer.

Context:
{context}
"""
    # 2. Code Logic Agent
    code_prompt = f"""You are the 'Code Logic Agent'. Analyze the code components, functions, exports, API definitions, and logic of '{repo_name}'.
Review the context and answer this specific question: {user_question}
Focus ONLY on core execution logic, helper utilities, syntax details, and modules.

Context:
{context}
"""
    # 3. Database & Integration Agent
    db_prompt = f"""You are the 'Database & Integration Agent'. Analyze the databases, ORMs, config files, third-party services, deployment models (Docker), and authentication setups of '{repo_name}'.
Review the context and answer this specific question: {user_question}
Focus ONLY on databases, schemas, auth libraries, env setups, and deployment.

Context:
{context}
"""

    sub_agents = [
        ("Architecture Agent", arch_prompt),
        ("Code Logic Agent", code_prompt),
        ("Database & Integration Agent", db_prompt)
    ]
    
    for agent_name, prompt in sub_agents:
        try:
            comp = client.chat.completions.create(
                messages=[
                    {"role": "system", "content": f"You are the {agent_name} for a repository RAG system. Answer focusing ONLY on your domain. Under 150 words. Be technical and precise."},
                    {"role": "user", "content": prompt}
                ],
                model=GROQ_MODEL,
                temperature=0.1,
                max_tokens=300
            )
            agents_responses[agent_name] = comp.choices[0].message.content.strip()
        except Exception as e:
            agents_responses[agent_name] = f"Agent failed: {str(e)}"
            
    # 4. Synthesizer
    synth_context = "\n\n".join([f"=== {k} Analysis ===\n{v}" for k, v in agents_responses.items()])
    synth_prompt = f"""You are the 'Synthesizer Agent'. Your job is to compile a single, comprehensive answer to the user's question by combining the specialized analyses from the three domain agents.
    
User Question: {user_question}

Domain Analyses:
{synth_context}

Provide a unified, highly detailed response. Format with markdown headings. Refer to the specific sub-agents' findings.
"""
    try:
        comp = client.chat.completions.create(
            messages=[
                {"role": "system", "content": "You are a technical lead. Combine domain reports to present a single cohesive, high-quality response. Use Markdown."},
                {"role": "user", "content": synth_prompt}
            ],
            model=GROQ_MODEL,
            temperature=0.2,
            max_tokens=800
        )
        agents_responses["Synthesizer"] = comp.choices[0].message.content.strip()
    except Exception as e:
        agents_responses["Synthesizer"] = f"Failed to synthesize: {str(e)}"
        
    return agents_responses

def query_repository(db: Session, repo_id: int, query: str, mode: str = "single") -> dict:
    """
    Main RAG endpoint query pipeline.
    Runs static routing logic FIRST. If hit, returns answer instantly.
    Otherwise, crawls vector searches, injects code files, and queries Groq.
    """
    # STAGE 2.0 addition: Intent Routing (0 AI Tokens for fact match!)
    static_answer = route_user_query(db, repo_id, query)
    if static_answer is not None:
        return {
            "answer": static_answer,
            "sources": [{"path": "Static DB Facts Index", "type": "meta", "similarity": 1.0}],
            "context_length_chars": 0,
            "static_routed": True
        }
        
    repo = db.query(Repository).filter(Repository.id == repo_id).first()
    if not repo:
        return {"error": "Repository not found."}
        
    client = get_groq_client()
    if not client:
        return {
            "answer": "Groq API client is not configured. Please set the GROQ_API_KEY environment variable in backend/.env",
            "sources": []
        }
        
    search_results = search_embeddings(db, repo_id, query, top_k=8)
    vector_context = build_context_from_results(db, repo_id, search_results)
    file_context = retrieve_exact_files(db, repo_id, query, repo.path)
    
    full_context = ""
    if vector_context:
        full_context += "=== Matched Summaries & Descriptions ===\n" + vector_context + "\n"
    if file_context:
        full_context += "=== Referenced Source Code ===\n" + file_context + "\n"
        
    if not full_context.strip():
        full_context = "No relevant context found. Answer using metadata."
        
    sources = [{"path": res["path"], "type": res["entity_type"], "similarity": res["similarity"]} for res in search_results]
    tech_stack = repo.technologies or {}
    
    if mode == "multi":
        agent_answers = answer_multi_agent(client, repo.name, tech_stack, full_context, query)
        return {
            "answer": agent_answers.get("Synthesizer"),
            "sub_agents": {k: v for k, v in agent_answers.items() if k != "Synthesizer"},
            "sources": sources,
            "context_length_chars": len(full_context),
            "static_routed": False
        }
    else:
        answer = answer_single_agent(client, repo.name, tech_stack, full_context, query)
        return {
            "answer": answer,
            "sources": sources,
            "context_length_chars": len(full_context),
            "static_routed": False
        }
