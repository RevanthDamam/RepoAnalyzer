import os
import ast
import re

def parse_python_symbols(content: str) -> list:
    """Parses Python file using standard ast library to extract symbols."""
    symbols = []
    try:
        root = ast.parse(content)
    except SyntaxError:
        return []

    for node in ast.walk(root):
        if isinstance(node, ast.ClassDef):
            symbols.append({
                "name": node.name,
                "type": "class",
                "line_start": node.lineno,
                "line_end": getattr(node, "end_lineno", node.lineno),
                "raw_code": ast.get_source_segment(content, node) if hasattr(ast, "get_source_segment") else ""
            })
        elif isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            # Check if it is a class method by looking at parent (simplified walk)
            # Default to function
            sym_type = "function"
            
            # Simple route check by decorator
            for dec in node.decorator_list:
                if isinstance(dec, ast.Call) and isinstance(dec.func, ast.Attribute):
                    if dec.func.attr in ('get', 'post', 'put', 'delete', 'patch'):
                        sym_type = "route"
                elif isinstance(dec, ast.Attribute) and dec.attr in ('get', 'post', 'put', 'delete', 'patch'):
                    sym_type = "route"

            symbols.append({
                "name": node.name,
                "type": sym_type,
                "line_start": node.lineno,
                "line_end": getattr(node, "end_lineno", node.lineno),
                "raw_code": ast.get_source_segment(content, node) if hasattr(ast, "get_source_segment") else ""
            })
            
    return symbols

def parse_javascript_symbols(content: str) -> list:
    """Uses robust regex matching to extract JS/TS classes, methods, functions, and routes."""
    symbols = []
    lines = content.splitlines()
    
    # 1. Regex patterns
    # Class declaration: class MyClass or export class MyClass
    class_pattern = re.compile(r'(?:export\s+)?class\s+([A-Za-z0-9_$]+)')
    
    # Standard function: function myFunction( or export async function myFunction(
    func_pattern = re.compile(r'(?:export\s+)?(?:async\s+)?function\s+([A-Za-z0-9_$]+)\s*\(')
    
    # Arrow function export: export const myFunc = ( or const myFunc = async (
    arrow_pattern = re.compile(r'(?:export\s+)?const\s+([A-Za-z0-9_$]+)\s*=\s*(?:async\s*)?\(.*?\)\s*=>')
    
    # Route patterns (Express/Vite/FastAPI style in node)
    route_pattern = re.compile(r'(?:app|router|route)\.(get|post|put|delete|patch)\s*\(\s*[\'"`]([^\'"`]+)[\'"`]')

    for idx, line in enumerate(lines):
        line_num = idx + 1
        
        # Class match
        if class_match := class_pattern.search(line):
            symbols.append({
                "name": class_match.group(1),
                "type": "class",
                "line_start": line_num,
                "line_end": line_num + 3,  # Approximate offset
                "raw_code": line.strip()
            })
            continue

        # Function match
        if func_match := func_pattern.search(line):
            symbols.append({
                "name": func_match.group(1),
                "type": "function",
                "line_start": line_num,
                "line_end": line_num + 5,
                "raw_code": line.strip()
            })
            continue

        # Arrow function match
        if arrow_match := arrow_pattern.search(line):
            symbols.append({
                "name": arrow_match.group(1),
                "type": "function",
                "line_start": line_num,
                "line_end": line_num + 5,
                "raw_code": line.strip()
            })
            continue

        # Route match
        if route_match := route_pattern.search(line):
            method = route_match.group(1).upper()
            path = route_match.group(2)
            symbols.append({
                "name": f"{method} {path}",
                "type": "route",
                "line_start": line_num,
                "line_end": line_num + 2,
                "raw_code": line.strip()
            })
            
    return symbols

def parse_code_symbols(content: str, filename: str) -> list:
    """Dispatches parser based on file extension."""
    _, ext = os.path.splitext(filename.lower())
    if ext == '.py':
        return parse_python_symbols(content)
    elif ext in ('.js', '.jsx', '.ts', '.tsx'):
        return parse_javascript_symbols(content)
    return []
