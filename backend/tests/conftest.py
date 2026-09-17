"""
Mission 6, §16 : ce projet n'avait aucune infrastructure de test exploitable
avant cette mission (vérifié par audit — voir le rapport final). Ces
fixtures posent le strict nécessaire pour exécuter les tests de cette
mission, sans intention de couvrir rétroactivement les missions précédentes.

Base isolée : DATABASE_URL est réécrit AVANT tout import du package `app`,
vers un fichier SQLite dédié aux tests (jamais la base de dev réelle
`homme_complet.db`). Le fichier est supprimé en fin de session.
"""
import os
import sys
import uuid
from pathlib import Path

TEST_DB_PATH = Path(__file__).resolve().parent / "test_mission6.db"

os.environ.setdefault("SECRET_KEY", "test-secret-key-mission6-not-for-production")
os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB_PATH}"

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

if TEST_DB_PATH.exists():
    TEST_DB_PATH.unlink()

import pytest
from starlette.testclient import TestClient

import app.main as main_module
from app.core.database import engine


@pytest.fixture(scope="session")
def client():
    # `with` déclenche les événements startup/shutdown réels de l'app —
    # create_all() + toutes les migrations (Mission 2 à 6) + scheduler,
    # exactement comme en production. Pas de duplication de cette séquence
    # ici : c'est le comportement réel de l'app qui est testé, pas une
    # reconstruction manuelle du schéma.
    with TestClient(main_module.app) as c:
        yield c
    # Ferme explicitement toutes les connexions du pool SQLAlchemy avant de
    # supprimer le fichier. Sortir du `with` ci-dessus déclenche le shutdown
    # FastAPI, mais ne dispose jamais le pool de connexions — celui-ci reste
    # donc ouvert tant que l'objet `engine` est référencé. Sous Linux/macOS,
    # unlink() sur un fichier encore ouvert réussit quand même (sémantique
    # POSIX : l'entrée de répertoire est supprimée, l'espace disque libéré
    # au dernier close()) ; sous Windows, NTFS refuse la suppression tant
    # qu'un handle est ouvert sans FILE_SHARE_DELETE, ce que SQLite/SQLAlchemy
    # ne demandent pas par défaut → PermissionError (WinError 32) sans ce
    # dispose(). Nécessaire sur toutes les plateformes, pas un contournement
    # ponctuel de l'erreur.
    engine.dispose()
    if TEST_DB_PATH.exists():
        TEST_DB_PATH.unlink()


def email_unique(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:10]}@mission6.dev"


def enregistrer_et_connecter(client: TestClient, prefix: str) -> dict:
    """Crée un utilisateur unique et renvoie ses headers d'authentification."""
    email = email_unique(prefix)
    mot_de_passe = "testpass123"
    r = client.post("/auth/register", json={"email": email, "mot_de_passe": mot_de_passe, "nom": prefix})
    assert r.status_code == 201, r.text
    r = client.post("/auth/login", data={"username": email, "password": mot_de_passe})
    assert r.status_code == 200, r.text
    token = r.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
