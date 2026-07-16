import re

def compress_code(content: str, file_ext: str) -> str:
    """
    Stage 10: Context Compression Layer.
    Strips inline/block comments, docstrings, blank lines, and trailing spaces.
    """
    if not content:
        return ""
        
    ext = file_ext.lower()
    
    # 1. Strip comments based on language
    if ext in ('.py', '.yml', '.yaml', '.ini', '.conf', '.sh'):
        # Python, yaml, bash comment strip
        lines = content.splitlines()
        clean_lines = []
        in_triple_quotes = False
        triple_quote_char = None
        
        for line in lines:
            stripped = line.strip()
            # Handle docstrings
            if '"""' in stripped or "'''" in stripped:
                char = '"""' if '"""' in stripped else "'''"
                if not in_triple_quotes:
                    in_triple_quotes = True
                    triple_quote_char = char
                    before = line.split(char)[0].strip()
                    if before:
                        clean_lines.append(before)
                else:
                    if char == triple_quote_char:
                        in_triple_quotes = False
                        after = line.split(char)[-1].strip()
                        if after:
                            clean_lines.append(after)
                continue
                
            if in_triple_quotes:
                continue
                
            # Remove line comments
            if '#' in line:
                parts = line.split('#', 1)
                before_comment = parts[0]
                if before_comment.count('"') % 2 == 0 and before_comment.count("'") % 2 == 0:
                    line = before_comment
                    
            if line.strip():
                clean_lines.append(line)
        content = "\n".join(clean_lines)

    elif ext in ('.js', '.jsx', '.ts', '.tsx', '.go', '.rs', '.java', '.cs', '.cpp', '.h', '.css', '.scss'):
        # JS/TS/Go/C++ style comments
        # Remove block comments /* ... */
        content = re.sub(r'/\*.*?\*/', '', content, flags=re.DOTALL)
        
        # Remove line comments //
        lines = content.splitlines()
        clean_lines = []
        for line in lines:
            if '//' in line:
                parts = line.split('//', 1)
                before_comment = parts[0]
                if before_comment.count('"') % 2 == 0 and before_comment.count("'") % 2 == 0 and before_comment.count("`") % 2 == 0:
                    line = before_comment
            if line.strip():
                clean_lines.append(line)
        content = "\n".join(clean_lines)

    # 2. Compress multiple blank lines and spacing
    content = re.sub(r'\n\s*\n', '\n', content)
    lines = [re.sub(r'[ \t]+', ' ', line).strip() for line in content.splitlines()]
    
    return "\n".join([l for l in lines if l])
