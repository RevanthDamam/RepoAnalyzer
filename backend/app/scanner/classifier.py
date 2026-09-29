import os

def score_file(relative_path: str, filename: str) -> int:
    """
    Stage 2: Smart File Classification.
    Scores files from 0 to 100 based on their extension, path location, and name.
    """
    path_lower = relative_path.lower()
    file_lower = filename.lower()
    
    # 1. Configs & core structural files (Score 95 - 100)
    if file_lower in ('package.json', 'requirements.txt', 'cargo.toml', 'go.mod', 'readme.md', 'dockerfile', 'docker-compose.yml', 'init.sql'):
        return 100
    if file_lower in ('tsconfig.json', 'vite.config.ts', 'vite.config.js', 'webpack.config.js', 'next.config.js', 'next.config.mjs', 'svelte.config.js', 'tailwind.config.js', 'tailwind.config.ts'):
        return 90
    if file_lower in ('schema.prisma', 'auth.ts', 'auth.js', 'middleware.ts', 'middleware.js', 'routes.ts', 'routes.js'):
        return 95
        
    # 2. Database files
    if 'prisma' in path_lower or 'database.py' in file_lower or 'db.ts' in file_lower or 'db.py' in file_lower:
        return 95
        
    # 3. Main/Entrypoint files
    if file_lower in ('main.py', 'app.py', 'server.js', 'index.js', 'index.ts', 'index.tsx', 'app.tsx', 'main.ts', 'main.tsx'):
        return 95

    # 4. Source code routes, layouts, pages, controllers
    if any(x in path_lower for x in ('/routes/', '/controllers/', '/pages/', '/app/', '/src/app/')):
        return 85
        
    # 5. Core logic/components (source code extensions)
    _, ext = os.path.splitext(file_lower)
    if ext in ('.py', '.ts', '.tsx', '.js', '.jsx', '.go', '.rs', '.java', '.cs', '.cpp', '.h'):
        # Check if it's a test file
        if 'test' in file_lower or 'spec' in file_lower:
            return 50  # Lower importance for tests
        return 70
        
    # 6. configuration / settings files inside code
    if 'settings' in file_lower or 'config' in file_lower:
        return 80
        
    # 7. Styling
    if ext in ('.css', '.scss', '.sass', '.less'):
        return 30
        
    # 8. Documentations
    if ext in ('.md', '.txt', '.rst'):
        return 40

    return 40
