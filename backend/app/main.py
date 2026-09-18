from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.core.database import Base, engine
from app.core.migrations import (
    ajouter_id_engagement_sur_entrees_suivi,
    faire_evoluer_bilans_vers_reflexion,
    faire_evoluer_programme_vers_saison,
    faire_evoluer_axe_vers_construction,
    faire_evoluer_entrees_suivi_vers_action,
)
from app.core.scheduler import demarrer_scheduler, arreter_scheduler
from app import models  # noqa: F401 — nécessaire pour que Base.metadata voie toutes les tables
from app.routers import auth, programmes, axes, suivi, notifications, bilans, push, session_travail, engagements, observations, seasons, constructions, actions, trajectory

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
    # Mission 2 : create_all() ci-dessus crée la table `engagements` (neuve),
    # mais ne touche pas à `entrees_suivi` (déjà existante) — la nouvelle
    # colonne nullable id_engagement doit être ajoutée à part, après coup.
    ajouter_id_engagement_sur_entrees_suivi(engine)
    # Mission 4 : fait évoluer `bilans` vers le modèle Réflexion (colonnes
    # nullables ajoutées + contraintes NOT NULL historiques assouplies).
    faire_evoluer_bilans_vers_reflexion(engine)
    # Mission 5 : Programme/Axe deviennent le support physique de
    # Saison/Construction (Option A — voir core/migrations.py).
    faire_evoluer_programme_vers_saison(engine)
    faire_evoluer_axe_vers_construction(engine)
    # Mission 6 : EntreeSuivi apprend à représenter une Action réelle
    # (date_action/contenu ajoutés, semaine/jour assouplis).
    faire_evoluer_entrees_suivi_vers_action(engine)
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
app.include_router(session_travail.router)
app.include_router(engagements.router)
app.include_router(observations.router)
app.include_router(seasons.router)
app.include_router(constructions.router)
app.include_router(actions.router)
app.include_router(trajectory.router)


@app.get("/health")
def health_check():
    return {"status": "ok"}
