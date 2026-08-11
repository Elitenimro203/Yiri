from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.core.database import Base, engine
from app.core.scheduler import demarrer_scheduler, arreter_scheduler
from app import models  # noqa: F401 — nécessaire pour que Base.metadata voie toutes les tables
from app.routers import auth, programmes, axes, suivi, notifications, bilans, push

settings = get_settings()
app = FastAPI(title="Yiri — API", version="0.1.0")

# Origines configurables via ALLOWED_ORIGINS (voir .env.example) — "*" par
# défaut pour le dev local, à restreindre à l'URL Vercel réelle en prod.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    # create_all() convient pour démarrer vite. Dès que le schéma doit évoluer sans
    # perdre de données (ajouter une colonne, etc.), remplacer par Alembic — create_all()
    # ne fait JAMAIS de migration, il crée seulement les tables absentes.
    Base.metadata.create_all(bind=engine)
    demarrer_scheduler()


@app.on_event("shutdown")
def on_shutdown():
    arreter_scheduler()


app.include_router(auth.router)
app.include_router(programmes.router)
app.include_router(axes.router)
app.include_router(suivi.router)
app.include_router(notifications.router)
app.include_router(bilans.router)
app.include_router(push.router)


@app.get("/health")
def health_check():
    return {"status": "ok"}
