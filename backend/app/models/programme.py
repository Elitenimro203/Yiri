import enum

from sqlalchemy import Column, Integer, String, Text, Date, ForeignKey, Enum
from sqlalchemy.orm import relationship

from app.core.database import Base


class ModeProgression(str, enum.Enum):
    auto = "auto"
    manuel = "manuel"


class StatutProgramme(str, enum.Enum):
    actif = "actif"
    archive = "archive"
    # Mission 5 : troisième état ajouté pour que Programme puisse porter la
    # sémantique Saison (actif/terminee/archivee) sans renommer physiquement
    # la classe ni la table — voir §3/§8 Q1. Vérifié empiriquement : SQLite
    # ne matérialise aucune contrainte CHECK sur les colonnes Enum de ce
    # projet (`VARCHAR(n)` nu), donc cet ajout est sans effet migratoire côté
    # SQLite. PostgreSQL, lui, a un vrai type ENUM natif qui doit être étendu
    # explicitement — voir core/migrations.py.
    termine = "termine"


class ModeDeverrouillage(str, enum.Enum):
    progressif = "progressif"  # respecte phase_deverrouillage de chaque axe (comportement historique)
    complet = "complet"        # tous les axes déverrouillés dès le départ, peu importe leur phase


class Programme(Base):
    __tablename__ = "programmes"

    id_programme = Column(Integer, primary_key=True, index=True)
    id_utilisateur = Column(Integer, ForeignKey("utilisateurs.id_utilisateur"), nullable=False)
    nom = Column(String(100), nullable=False)
    date_debut = Column(Date, nullable=False)
    # Mission 5 : champs Saison ajoutés de façon additive (§3, §23). Nullable
    # pour tout l'historique — jamais fabriqués rétroactivement.
    intention = Column(Text, nullable=True)
    date_fin = Column(Date, nullable=True)
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
