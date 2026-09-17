from sqlalchemy import Column, Integer, String, Time, Boolean, ForeignKey
from sqlalchemy.orm import relationship

from app.core.database import Base


class Notification(Base):
    __tablename__ = "notifications"

    id_notification = Column(Integer, primary_key=True, index=True)
    id_utilisateur = Column(Integer, ForeignKey("utilisateurs.id_utilisateur"), nullable=False)
    id_axe = Column(Integer, ForeignKey("axes.id_axe"), nullable=True)  # RG-06 : nullable = rappel global
    libelle = Column(String(100), nullable=False)
    heure = Column(Time, nullable=False)
    jours_actifs = Column(String(20), nullable=False)  # ex: "1,2,3,4,5,6,7"
    actif = Column(Boolean, default=True, nullable=False)

    utilisateur = relationship("Utilisateur", back_populates="notifications")
    axe = relationship("Axe", back_populates="notifications")
