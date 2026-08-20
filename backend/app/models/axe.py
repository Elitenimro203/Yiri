import enum

from sqlalchemy import Column, Integer, String, ForeignKey, Enum
from sqlalchemy.orm import relationship

from app.core.database import Base


class Pilier(str, enum.Enum):
    corps = "corps"
    esprit = "esprit"
    caractere = "caractere"
    impact = "impact"


class Axe(Base):
    __tablename__ = "axes"

    id_axe = Column(Integer, primary_key=True, index=True)
    id_programme = Column(Integer, ForeignKey("programmes.id_programme"), nullable=False)
    nom = Column(String(100), nullable=False)
    # RG-04 : semaine à partir de laquelle l'axe devient cochable
    phase_deverrouillage = Column(Integer, nullable=False)
    ordre_affichage = Column(Integer, nullable=False, default=0)
    # RG-10 : regroupement visuel/hiérarchique (Corps/Esprit/Caractère/Impact) —
    # purement additif, ne change rien au verrouillage (RG-04/RG-09) ni au suivi.
    pilier = Column(Enum(Pilier), nullable=False)
    # RG-11 : jours de la semaine où l'axe fait partie du "rituel du jour"
    # (même format que Notification.jours_actifs : "1,3,5", 1=lundi..7=dimanche).
    # NULL = actif tous les jours (comportement historique, rien ne casse).
    # C'est un filtre d'AFFICHAGE, pas un verrou : cocher un axe un jour hors de
    # sa liste reste autorisé (rattraper un jour manqué doit rester possible).
    jours_actifs = Column(String(20), nullable=True)

    programme = relationship("Programme", back_populates="axes")
    entrees = relationship("EntreeSuivi", back_populates="axe", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="axe")
    sessions_travail = relationship("SessionTravail", back_populates="axe", cascade="all, delete-orphan")
