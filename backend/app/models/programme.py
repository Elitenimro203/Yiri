import enum

from sqlalchemy import Column, Integer, String, Date, ForeignKey, Enum
from sqlalchemy.orm import relationship

from app.core.database import Base


class ModeProgression(str, enum.Enum):
    auto = "auto"
    manuel = "manuel"


class StatutProgramme(str, enum.Enum):
    actif = "actif"
    archive = "archive"


class ModeDeverrouillage(str, enum.Enum):
    progressif = "progressif"  # respecte phase_deverrouillage de chaque axe (comportement historique)
    complet = "complet"        # tous les axes déverrouillés dès le départ, peu importe leur phase


class Programme(Base):
    __tablename__ = "programmes"

    id_programme = Column(Integer, primary_key=True, index=True)
    id_utilisateur = Column(Integer, ForeignKey("utilisateurs.id_utilisateur"), nullable=False)
    nom = Column(String(100), nullable=False)
    date_debut = Column(Date, nullable=False)
    # RG-08 : mode configurable, jamais codé en dur — pattern "configuration paramétrable"
    mode_progression = Column(Enum(ModeProgression), default=ModeProgression.manuel, nullable=False)
    semaine_courante = Column(Integer, default=1, nullable=False)
    statut = Column(Enum(StatutProgramme), default=StatutProgramme.actif, nullable=False)
    # RG-09 : même pattern que RG-08 — le verrouillage progressif est un choix
    # configurable du programme, pas une règle absolue codée en dur dans axes.py.
    mode_deverrouillage = Column(Enum(ModeDeverrouillage), default=ModeDeverrouillage.progressif, nullable=False)

    utilisateur = relationship("Utilisateur", back_populates="programmes")
    axes = relationship("Axe", back_populates="programme", cascade="all, delete-orphan")
    bilans = relationship("Bilan", back_populates="programme", cascade="all, delete-orphan")
