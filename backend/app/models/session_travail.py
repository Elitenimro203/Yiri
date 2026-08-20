import enum
from datetime import datetime, timezone

from sqlalchemy import Column, Integer, String, DateTime, Enum, ForeignKey
from sqlalchemy.orm import relationship

from app.core.database import Base


class TypeSession(str, enum.Enum):
    libre = "libre"        # chrono simple : démarrer / arrêter
    pomodoro = "pomodoro"  # cycles minutés focus/pause


class SessionTravail(Base):
    __tablename__ = "sessions_travail"

    id_session = Column(Integer, primary_key=True, index=True)
    # Dénormalisé volontairement (comme Notification/PushSubscription) : évite
    # une jointure axe -> programme -> utilisateur à chaque vérification
    # "l'utilisateur a-t-il déjà une session active ?" (RG-14).
    id_utilisateur = Column(Integer, ForeignKey("utilisateurs.id_utilisateur"), nullable=False)
    id_axe = Column(Integer, ForeignKey("axes.id_axe"), nullable=False)
    type = Column(Enum(TypeSession), nullable=False, default=TypeSession.libre)
    date_debut = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    date_fin = Column(DateTime, nullable=True)  # NULL tant que la session est active
    duree_secondes = Column(Integer, nullable=True)  # calculé à la clôture, jamais avant

    # Uniquement pertinent si type = pomodoro — NULL sinon. Stocké PAR SESSION
    # (pas un réglage global utilisateur) pour rester personnalisable sans
    # complexifier un système de préférences séparé (RG-14, décision Kouadio :
    # standard par défaut, personnalisable si l'utilisateur le souhaite).
    duree_focus_minutes = Column(Integer, nullable=True)
    duree_pause_minutes = Column(Integer, nullable=True)

    utilisateur = relationship("Utilisateur", back_populates="sessions_travail")
    axe = relationship("Axe", back_populates="sessions_travail")
