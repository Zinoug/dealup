def sqlalchemy_database_url(url: str) -> str:
    """Select psycopg 3 for standard PostgreSQL URLs injected by Railway."""
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+psycopg://", 1)
    return url
