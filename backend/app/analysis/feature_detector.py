import os
import re

def detect_repo_features(repo_path: str, files_list: list) -> dict:
    """
    Scans files and folder structures to construct a structured JSON of codebase features.
    No AI, zero token cost.
    """
    features = {
        "authentication": False,
        "jwt": False,
        "oauth": False,
        "payments": False,
        "docker": False,
        "redis": False,
        "cron": False,
        "database_connected": False
    }
    
    file_map = {f["path"]: f for f in files_list}
    
    # 1. Direct file existence checks
    if "Dockerfile" in file_map or "docker-compose.yml" in file_map:
        features["docker"] = True
        
    # 2. Scanning code contents of key files
    # We will search the top-importance files (like package.json, requirements.txt, config files, router files)
    # for specific text patterns
    important_files = [f for f in files_list if f["importance_score"] >= 80]
    
    auth_terms = re.compile(r'clerk|next-auth|passport|jsonwebtoken|auth0|supabase\.auth|firebase\.auth|bcrypt|oauth', re.I)
    jwt_terms = re.compile(r'jwt|jsonwebtoken|signToken|verifyToken|bearer', re.I)
    oauth_terms = re.compile(r'oauth|google|github|facebook|apple|client_id|client_secret', re.I)
    payment_terms = re.compile(r'stripe|paypal|razorpay|charge|checkout|billing|invoice', re.I)
    redis_terms = re.compile(r'redis|ioredis|celery', re.I)
    cron_terms = re.compile(r'cron|scheduler|setInterval|scheduleJob|celery\.beat', re.I)
    db_terms = re.compile(r'postgres|mysql|sqlite|mongodb|mongoose|prisma|sqlalchemy|sequelize|typeorm|pg', re.I)

    for f in important_files:
        full_path = os.path.join(repo_path, f["path"])
        if not os.path.exists(full_path):
            continue
            
        try:
            with open(full_path, "r", encoding="utf-8", errors="ignore") as file_obj:
                content = file_obj.read()
                
            if auth_terms.search(content):
                features["authentication"] = True
            if jwt_terms.search(content):
                features["jwt"] = True
            if oauth_terms.search(content):
                features["oauth"] = True
            if payment_terms.search(content):
                features["payments"] = True
            if redis_terms.search(content):
                features["redis"] = True
            if cron_terms.search(content):
                features["cron"] = True
            if db_terms.search(content):
                features["database_connected"] = True
                
        except Exception:
            pass
            
    return features
