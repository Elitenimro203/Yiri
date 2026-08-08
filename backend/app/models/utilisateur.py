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
