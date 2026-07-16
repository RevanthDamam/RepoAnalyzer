import os

def calculate_complexity(content: str, filename: str) -> dict:
    """
    Statically measures:
    1. Lines of Code (LOC)
    2. Cyclomatic Complexity index by tracking branch splits:
       e.g., if, while, for, except, catch, switch, conditional operators.
    """
    if not content:
        return {"loc": 0, "complexity": 1}
        
    lines = content.splitlines()
    loc = len([l for l in lines if l.strip()])
    
    # Standard base complexity
    complexity = 1
    
    # Token keywords that trigger logical branch division
    branch_keywords = [
        r'\bif\b', r'\belif\b', r'\bwhile\b', r'\bfor\b', 
        r'\bexcept\b', r'\bcatch\b', r'\bcase\b', r'\b\?\b',
        r'\band\b', r'\bor\b', r'&&', r'\|\|'
    ]
    
    # Combined regex pattern
    import re
    combined_pattern = re.compile('|'.join(branch_keywords))
    
    # Scan lines for match triggers
    for line in lines:
        # Ignore comment lines
        stripped = line.strip()
        if stripped.startswith('#') or stripped.startswith('//') or stripped.startswith('*'):
            continue
        matches = combined_pattern.findall(line)
        complexity += len(matches)
        
    return {
        "loc": loc,
        "complexity": complexity
    }
