from datetime import datetime, timezone

from sqlalchemy import Column, Integer, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship

from app.core.database import Base


class Observation(Base):
    """
    Ce que l'utilisateur remarque dans la réalité, à partir de ce qui s'est
    passé — pas une note, pas un score, pas un diagnostic. `contenu` est
    délibérément un simple texte libre : Yiri conserve le fait remarqué, pas
    une interprétation calculée (l'interprétation appartient à la Réflexion,
    voir Mission 1.5 / futures missions).

    Une Observation appartient toujours directement à un utilisateur (pas
    seulement via un Axe) — elle doit pouvoir exister sans Construction et
    sans Action, pour capturer ce qui arrive dans la vie même hors du cadre
    prévu par un programme (Mission 3, §4).

    `id_axe` et `id_entree` sont tous les deux nullable et indépendants l'un
    de l'autre en base ; leur cohérence mutuelle (une EntreeSuivi fournie
    doit appartenir à l'Axe fourni, si les deux sont présents) est vérifiée
    dans le router, pas ici — voir routers/observations.py.
    """
    __tablename__ = "observations"

    id_observation = Column(Integer, primary_key=True, index=True)
    id_utilisateur = Column(Integer, ForeignKey("utilisateurs.id_utilisateur"), nullable=False)
    # Nom technique "axe" conservé (Construction n'existe pas encore en tant
    # que table — voir Mission 2).
    id_axe = Column(Integer, ForeignKey("axes.id_axe"), nullable=True)
    id_entree = Column(Integer, ForeignKey("entrees_suivi.id_entree"), nullable=True)
    contenu = Column(Text, nullable=False)
    # Contrôlée côté serveur uniquement (voir schemas/observation.py) — le
    # client ne peut pas fabriquer une date de création arbitraire.
    date_creation = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    utilisateur = relationship("Utilisateur", back_populates="observations")
    axe = relationship("Axe", back_populates="observations")
    entree = relationship("EntreeSuivi", back_populates="observations")
