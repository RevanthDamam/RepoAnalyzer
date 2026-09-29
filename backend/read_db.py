import sqlite3

conn = sqlite3.connect('c:/Users/revan/Downloads/Projects/RepoAnalyzer/backend/repo_analyzer.db')
cursor = conn.cursor()

# Get repos
cursor.execute("SELECT id, name, path FROM repositories")
repos = cursor.fetchall()
print("REPOSITORIES:")
for r in repos:
    print(r)

# Get files for each repo
for r in repos:
    repo_id = r[0]
    print(f"\nFILES FOR REPO {r[1]} (id={repo_id}):")
    cursor.execute("SELECT id, path, lines_of_code, complexity_score FROM files WHERE repo_id = ?", (repo_id,))
    files = cursor.fetchall()
    for f in files[:30]:
        print(f)
    if len(files) > 30:
        print(f"... and {len(files) - 30} more files")

conn.close()
