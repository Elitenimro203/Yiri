from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

from app.core.config import get_settings

settings = get_settings()

# Railway (et Heroku avant lui) fournissent parfois l'URL Postgres avec le
# préfixe historique "postgres://", et dans tous les cas une URL "postgresql://"
# generique sans préciser le driver. SQLAlchemy 2.x a besoin de savoir
# EXPLICITEMENT quel driver utiliser — sans ça, il essaie psycopg2 par défaut,
# qui n'est pas installé ici (on utilise psycopg 3, plus récent). On force
# donc le dialecte "postgresql+psycopg://" pour matcher le package installé
# (voir requirements.txt : psycopg[binary]).
database_url = settings.DATABASE_URL
if database_url.startswith("postgres://"):
    database_url = database_url.replace("postgres://", "postgresql+psycopg://", 1)
elif database_url.startswith("postgresql://"):
    database_url = database_url.replace("postgresql://", "postgresql+psycopg://", 1)

# check_same_thread=False : nécessaire uniquement pour SQLite (dev/prototype).
# En prod avec PostgreSQL, ce connect_arg n'existe pas — signalé pour ne pas le copier bêtement.
connect_args = {"check_same_thread": False} if database_url.startswith("sqlite") else {}

engine = create_engine(database_url, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """Dependency FastAPI — une session par requête, toujours fermée après."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
