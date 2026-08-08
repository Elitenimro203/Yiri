"""
Import centralisé de tous les modèles.

Pourquoi ce fichier existe : SQLAlchemy a besoin que chaque modèle soit importé
au moins une fois avant que Base.metadata.create_all() (ou Alembic) puisse voir
les tables. Sans ce fichier, on doit se souvenir d'importer chaque modèle dans
main.py à la main — source classique de bug "table not found" quand on ajoute
un nouveau modèle et qu'on oublie de l'importer quelque part.
"""
from app.models.utilisateur import Utilisateur  # noqa: F401
from app.models.programme import Programme, ModeProgression, StatutProgramme  # noqa: F401
from app.models.axe import Axe  # noqa: F401
from app.models.entree_suivi import EntreeSuivi  # noqa: F401
from app.models.notification import Notification  # noqa: F401
from app.models.bilan import Bilan, DecisionBilan  # noqa: F401
from app.models.push_subscription import PushSubscription  # noqa: F401
