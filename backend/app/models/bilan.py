import enum
from datetime import datetime, timezone

from sqlalchemy import Column, Integer, String, Text, Enum, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship

from app.core.database import Base


class DecisionBilan(str, enum.Enum):
    consolider = "consolider"  # on ne rajoute pas de couche, on stabilise ce qui existe
    avancer = "avancer"        # on passe à la semaine suivante


class Bilan(Base):
    __tablename__ = "bilans"

    id_bilan = Column(Integer, primary_key=True, index=True)
    id_programme = Column(Integer, ForeignKey("programmes.id_programme"), nullable=False)
    semaine = Column(Integer, nullable=False)
    # Snapshot au moment de la clôture — jamais recalculé après coup. Un bilan
    # raconte "où tu en étais quand tu as clos cette semaine", pas un chiffre
    # qui bougerait si tu revenais cocher une case en retard plus tard.
    score_snapshot = Column(Integer, nullable=False)
    quoi_a_marche = Column(Text, nullable=True)
    quoi_n_a_pas_marche = Column(Text, nullable=True)
    ajustement_semaine_suivante = Column(Text, nullable=True)
    decision = Column(Enum(DecisionBilan), nullable=False)
    date_creation = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    programme = relationship("Programme", back_populates="bilans")

    __table_args__ = (
        # RG-12 : un seul bilan par (programme, semaine) — on clôture une
        # semaine une fois, on ne la re-clôture pas indéfiniment.
        UniqueConstraint("id_programme", "semaine", name="uq_bilan_programme_semaine"),
    )
