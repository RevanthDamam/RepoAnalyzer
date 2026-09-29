import hashlib

def compute_sha256(filepath: str) -> str:
    """Computes SHA256 identifier of a file for caching checks."""
    sha256 = hashlib.sha256()
    try:
        with open(filepath, 'rb') as f:
            while chunk := f.read(8192):
                sha256.update(chunk)
        return sha256.hexdigest()
    except Exception:
        return ""
