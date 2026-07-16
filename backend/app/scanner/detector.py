import os
import re
import json

def detect_technologies(repo_path: str, files_list: list) -> dict:
    """
    Stage 3: Inspects code manifests (package.json, requirements.txt, Cargo.toml, pyproject.toml)
    to identify build tools, packages, database connections, auth libraries, and frameworks WITHOUT AI.
    """
    techs = {
        "language": "Unknown",
        "languages": [],
        "framework": "Unknown",
        "database": "Unknown",
        "orm": "Unknown",
        "auth": "Unknown",
        "docker": False,
        "tailwind": False,
        "testing": "Unknown",
        "package_manager": "Unknown",
        "build_tool": "Unknown"
    }
    
    file_map = {f["path"]: f for f in files_list}
    
    # 1. Extensions to language matching
    ext_counts = {}
    for f in files_list:
        ext = f["extension"].lower()
        if ext:
            ext_counts[ext] = ext_counts.get(ext, 0) + 1
            
    lang_mapping = {
        ".py": "Python",
        ".ts": "TypeScript",
        ".tsx": "TypeScript (React)",
        ".js": "JavaScript",
        ".jsx": "JavaScript (React)",
        ".go": "Go",
        ".rs": "Rust",
        ".java": "Java",
        ".cs": "C#",
        ".rb": "Ruby",
        ".php": "PHP",
        ".sh": "Bash",
        ".kt": "Kotlin",
        ".swift": "Swift"
    }
    
    detected_langs = sorted(
        [(lang_mapping[ext], count) for ext, count in ext_counts.items() if ext in lang_mapping],
        key=lambda x: x[1],
        reverse=True
    )
    if detected_langs:
        techs["language"] = detected_langs[0][0]
        techs["languages"] = [l[0] for l in detected_langs[:3]]

    # 2. Check for Docker config
    if "Dockerfile" in file_map or "docker-compose.yml" in file_map:
        techs["docker"] = True

    # 3. Read package.json (Node environment)
    if "package.json" in file_map:
        techs["package_manager"] = "npm"
        if "pnpm-lock.yaml" in file_map:
            techs["package_manager"] = "pnpm"
        elif "yarn.lock" in file_map:
            techs["package_manager"] = "yarn"
        elif "package-lock.json" in file_map:
            techs["package_manager"] = "npm"
            
        try:
            full_pkg_path = os.path.join(repo_path, "package.json")
            with open(full_pkg_path, "r", encoding="utf-8") as f:
                pkg_data = json.load(f)
                
            deps = {**pkg_data.get("dependencies", {}), **pkg_data.get("devDependencies", {})}
            
            # Framework check
            if "next" in deps:
                techs["framework"] = "Next.js"
            elif "react" in deps:
                techs["framework"] = "React"
            elif "svelte" in deps or "@sveltejs/kit" in deps:
                techs["framework"] = "Svelte"
            elif "vue" in deps or "nuxt" in deps:
                techs["framework"] = "Vue"
            elif "express" in deps:
                techs["framework"] = "Express"
            elif "nest" in deps or "@nestjs/core" in deps:
                techs["framework"] = "NestJS"

            # Tailwind CSS check
            if "tailwindcss" in deps:
                techs["tailwind"] = True
                
            # ORM check
            if "prisma" in deps:
                techs["orm"] = "Prisma"
            elif "mongoose" in deps:
                techs["orm"] = "Mongoose"
            elif "sequelize" in deps:
                techs["orm"] = "Sequelize"
            elif "typeorm" in deps:
                techs["orm"] = "TypeORM"
                
            # Auth check
            if "next-auth" in deps or "@auth/core" in deps:
                techs["auth"] = "NextAuth"
            elif "@clerk/nextjs" in deps or "@clerk/clerk-react" in deps:
                techs["auth"] = "Clerk"
            elif "@supabase/supabase-js" in deps:
                techs["auth"] = "Supabase Auth"
            elif "firebase" in deps:
                techs["auth"] = "Firebase Auth"
            elif "passport" in deps:
                techs["auth"] = "Passport"
            elif "jsonwebtoken" in deps:
                techs["auth"] = "JWT"
                
            # Database check
            if "pg" in deps or "pg-promise" in deps:
                techs["database"] = "Postgres"
            elif "mysql" in deps or "mysql2" in deps:
                techs["database"] = "MySQL"
            elif "mongodb" in deps:
                techs["database"] = "MongoDB"
            elif "redis" in deps or "ioredis" in deps:
                techs["database"] = "Redis"
            elif "sqlite3" in deps or "better-sqlite3" in deps:
                techs["database"] = "SQLite"

            # Testing frameworks
            if "jest" in deps:
                techs["testing"] = "Jest"
            elif "vitest" in deps:
                techs["testing"] = "Vitest"
            elif "playwright" in deps or "@playwright/test" in deps:
                techs["testing"] = "Playwright"
            elif "cypress" in deps:
                techs["testing"] = "Cypress"
                
            # Build tool
            if "vite" in deps:
                techs["build_tool"] = "Vite"
            elif "webpack" in deps:
                techs["build_tool"] = "Webpack"
                
        except Exception:
            pass

    # 4. Read requirements.txt, pyproject.toml (Python environment)
    if "requirements.txt" in file_map:
        techs["package_manager"] = "pip"
        try:
            full_req_path = os.path.join(repo_path, "requirements.txt")
            with open(full_req_path, "r", encoding="utf-8") as f:
                req_content = f.read()
                
            # Framework check
            if re.search(r"fastapi", req_content, re.I):
                techs["framework"] = "FastAPI"
            elif re.search(r"django", req_content, re.I):
                techs["framework"] = "Django"
            elif re.search(r"flask", req_content, re.I):
                techs["framework"] = "Flask"
                
            # ORM check
            if re.search(r"sqlalchemy", req_content, re.I):
                techs["orm"] = "SQLAlchemy"
            elif re.search(r"tortoise-orm", req_content, re.I):
                techs["orm"] = "Tortoise ORM"
            elif re.search(r"peewee", req_content, re.I):
                techs["orm"] = "Peewee"
            elif re.search(r"django", req_content, re.I):
                techs["orm"] = "Django ORM"
                
            # Database check
            if re.search(r"psycopg2|asyncpg", req_content, re.I):
                techs["database"] = "Postgres"
            elif re.search(r"pymongo|motor", req_content, re.I):
                techs["database"] = "MongoDB"
            elif re.search(r"redis", req_content, re.I):
                techs["database"] = "Redis"
            elif re.search(r"mysql", req_content, re.I):
                techs["database"] = "MySQL"
                
            # Testing
            if re.search(r"pytest", req_content, re.I):
                techs["testing"] = "pytest"
            elif re.search(r"unittest", req_content, re.I):
                techs["testing"] = "unittest"
                
        except Exception:
            pass
            
    if "pyproject.toml" in file_map:
        techs["package_manager"] = "poetry"
        try:
            full_toml_path = os.path.join(repo_path, "pyproject.toml")
            with open(full_toml_path, "r", encoding="utf-8") as f:
                toml_content = f.read()
            if "poetry" in toml_content:
                techs["package_manager"] = "poetry"
            if "fastapi" in toml_content:
                techs["framework"] = "FastAPI"
            elif "django" in toml_content:
                techs["framework"] = "Django"
            elif "flask" in toml_content:
                techs["framework"] = "Flask"
            if "sqlalchemy" in toml_content:
                techs["orm"] = "SQLAlchemy"
            if "pytest" in toml_content:
                techs["testing"] = "pytest"
        except Exception:
            pass

    # 5. Backup adjustments
    if "schema.prisma" in file_map:
        techs["orm"] = "Prisma"
        try:
            full_prisma_path = os.path.join(repo_path, "schema.prisma")
            with open(full_prisma_path, "r", encoding="utf-8") as f:
                prisma_content = f.read()
            db_match = re.search(r'provider\s*=\s*"([^"]+)"', prisma_content)
            if db_match:
                techs["database"] = db_match.group(1).capitalize()
        except Exception:
            pass
            
    if any("redis" in f["path"].lower() for f in files_list):
        if techs["database"] == "Unknown":
            techs["database"] = "Redis"

    return techs
