import os
from sqlalchemy.orm import Session
from ..database.models import File, Dependency

def analyze_codebase_quality(db: Session, repo_id: int) -> dict:
    """
    Computes codebase static metrics (LOC, Avg Complexity) and returns 
    a checklist of code smells (large files, complex files, tight coupling).
    """
    files = db.query(File).filter(File.repo_id == repo_id).all()
    if not files:
        return {
            "score_grade": "A",
            "smells": [],
            "metrics": {
                "total_loc": 0,
                "avg_complexity": 1.0,
                "complex_files_count": 0,
                "large_files_count": 0
            }
        }
        
    total_loc = 0
    total_complexity = 0
    large_files = []
    complex_files = []
    coupled_files = []
    smells = []
    
    for f in files:
        total_loc += f.lines_of_code
        total_complexity += f.complexity_score
        
        # 1. Large files check (LOC > 300)
        if f.lines_of_code > 300:
            large_files.append(f)
            smells.append({
                "path": f.path,
                "type": "large_file",
                "message": f"Large file detected ({f.lines_of_code} LOC). Consider splitting into modules."
            })
            
        # 2. Complex logic check (Cyclomatic Complexity > 15)
        if f.complexity_score > 15:
            complex_files.append(f)
            smells.append({
                "path": f.path,
                "type": "complexity",
                "message": f"High cyclomatic complexity ({f.complexity_score}). Consider refactoring nested logic."
            })
            
        # 3. High Coupling check (fan_out > 10)
        if f.fan_out > 10:
            coupled_files.append(f)
            smells.append({
                "path": f.path,
                "type": "coupling",
                "message": f"Tight coupling ({f.fan_out} imports). File depends on too many components."
            })
            
    # Calculate grade index
    avg_complexity = total_complexity / len(files)
    
    # Simple grading rule
    if avg_complexity <= 3.0 and len(smells) <= 2:
        grade = "A"
    elif avg_complexity <= 6.0 and len(smells) <= 5:
        grade = "B"
    elif avg_complexity <= 10.0 and len(smells) <= 10:
        grade = "C"
    elif avg_complexity <= 15.0 and len(smells) <= 15:
        grade = "D"
    else:
        grade = "F"
        
    return {
        "score_grade": grade,
        "smells": smells[:30],  # Caps list
        "metrics": {
            "total_loc": total_loc,
            "avg_complexity": round(avg_complexity, 1),
            "complex_files_count": len(complex_files),
            "large_files_count": len(large_files)
        }
    }
