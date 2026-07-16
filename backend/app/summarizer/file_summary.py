import os
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

def generate_file_summary(client: Groq, filename: str, relative_path: str, code_content: str, symbols: list) -> str:
    """
    Stage 5: Generate AI file summary.
    Includes parsed code symbols (AST facts) to ground the model and reduce hallucinations.
    """
    if not client:
        return f"Placeholder summary for {filename} (No Groq API Key)."
        
    symbols_text = ""
    if symbols:
        symbols_text = "\nSTATIC SYMBOLS (AST FACT INDEX):\n" + "\n".join([f"- Name: {s['name']} (Type: {s['type']}, Lines: {s['line_start']}-{s['line_end']})" for s in symbols])
        
    prompt = f"""You are a professional codebase inspector. Analyze the following code from file '{relative_path}' and write a structured summary.
Your summary MUST be under 150 words. Focus on describing:
1. Core Responsibility: Main purpose of this file.
2. Code Flow: Briefly how it behaves or hooks.
3. Dependencies: External tools or database queries.

Use the provided static symbol checklist to ensure accuracy and prevent hallucinations.
{symbols_text}

Code content:
```
{code_content}
```
"""
    try:
        completion = client.chat.completions.create(
            messages=[
                {"role": "system", "content": "You are a concise codebase analyzer. Summarize files precisely under 150 words. Do not write intros or outros."},
                {"role": "user", "content": prompt}
            ],
            model=GROQ_MODEL,
            temperature=0.1,
            max_tokens=250
        )
        return completion.choices[0].message.content.strip()
    except Exception as e:
        return f"Failed to generate summary: {str(e)}"
