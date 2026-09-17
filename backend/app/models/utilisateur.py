from datetime import datetime, timezone

from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.orm import relationship

from app.core.database import Base


class Utilisateur(Base):
    __tablename__ = "utilisateurs"

    id_utilisateur = Column(Integer, primary_key=True, index=True)
    email = Column(String(150), unique=True, nullable=False, index=True)
    mot_de_passe_hash = Column(String(255), nullable=False)
    nom = Column(String(100), nullable=False)
    date_creation = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    programmes = relationship("Programme", back_populates="utilisateur", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="utilisateur", cascade="all, delete-orphan")
    push_subscriptions = relationship("PushSubscription", back_populates="utilisateur", cascade="all, delete-orphan")
    sessions_travail = relationship("SessionTravail", back_populates="utilisateur", cascade="all, delete-orphan")
    # Mission 3 : une Observation appartient toujours directement à
    # l'utilisateur (indépendamment d'un Axe ou d'une Action) — voir
    # models/observation.py.
    observations = relationship("Observation", back_populates="utilisateur", cascade="all, delete-orphan")
    # Mission 4 : Bilan/Réflexion peut désormais être rattaché directement à
    # l'utilisateur (voir models/bilan.py) — nécessaire pour qu'une Réflexion
    # libre (sans Programme) soit tout de même nettoyée si l'utilisateur est
    # supprimé. Les anciens Bilans restent aussi rattachés à leur Programme
    # (Programme.bilans, cascade existante, inchangée) ; les deux chemins de
    # cascade coexistent sans conflit, SQLAlchemy ne supprime jamais deux fois
    # la même ligne.
    bilans = relationship("Bilan", back_populates="utilisateur", cascade="all, delete-orphan")
    # Mission 5 : une Construction peut exister sans Saison (Axe.id_programme
    # nullable) — même raison que observations/bilans ci-dessus, il faut un
    # chemin de propriété qui ne dépende pas d'un Programme parent.
    axes = relationship("Axe", back_populates="utilisateur", cascade="all, delete-orphan")
