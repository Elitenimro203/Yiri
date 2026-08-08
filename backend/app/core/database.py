from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

from app.core.config import get_settings

settings = get_settings()

# check_same_thread=False : nécessaire uniquement pour SQLite (dev/prototype).
# En prod avec PostgreSQL, ce connect_arg n'existe pas — signalé pour ne pas le copier bêtement.
connect_args = {"check_same_thread": False} if settings.DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(settings.DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """Dependency FastAPI — une session par requête, toujours fermée après."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
