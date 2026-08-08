"""
Config centralisée. Toutes les variables sensibles viennent de l'environnement,
jamais codées en dur — sinon elles finissent dans Git et dans l'historique.
"""
import os
from functools import lru_cache

from dotenv import load_dotenv

# BUG CORRIGÉ : sans cet appel, le fichier .env n'était jamais lu — os.environ
# ne contient que les vraies variables d'environnement système. load_dotenv()
# doit être appelé AVANT la définition de la classe Settings ci-dessous, car
# SECRET_KEY est lu au moment où le corps de la classe s'exécute (à l'import
# du module), pas seulement quand get_settings() est appelée.
load_dotenv()


class Settings:
    DATABASE_URL: str = os.environ.get("DATABASE_URL", "sqlite:///./homme_complet.db")
    SECRET_KEY: str = os.environ["SECRET_KEY"]  # pas de défaut : on VEUT crasher au démarrage si absent
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.environ.get("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))
    # CSV d'origines autorisées, ex: "https://mon-app.vercel.app,http://localhost:5173"
    # Défaut "*" pour le dev local — à restreindre en prod via la variable d'env.
    ALLOWED_ORIGINS: list[str] = [
        o.strip() for o in os.environ.get("ALLOWED_ORIGINS", "*").split(",") if o.strip()
    ]
    # Notifications push web (RG-13) — None si absent : le planificateur
    # désactive simplement l'envoi plutôt que de planter au démarrage, pour
    # ne pas bloquer le reste de l'app si ce n'est pas encore configuré.
    VAPID_PUBLIC_KEY: str | None = os.environ.get("VAPID_PUBLIC_KEY")
    VAPID_PRIVATE_KEY: str | None = os.environ.get("VAPID_PRIVATE_KEY")
    VAPID_CLAIMS_EMAIL: str = os.environ.get("VAPID_CLAIMS_EMAIL", "mailto:contact@example.com")


@lru_cache
def get_settings() -> Settings:
    # lru_cache : on lit les env vars une seule fois au démarrage, pas à chaque requête.
    # 💡 Piège classique : lire os.environ.get(...) directement dans chaque fonction qui en a besoin
    # → si une var change en cours de run (rare mais arrive en test), le comportement devient
    # incohérent selon le moment de lecture, et c'est impossible à tester proprement.
    return Settings()
