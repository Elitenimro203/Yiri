from sqlalchemy import Column, Integer, Boolean, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship

from app.core.database import Base


class EntreeSuivi(Base):
    __tablename__ = "entrees_suivi"

    id_entree = Column(Integer, primary_key=True, index=True)
    id_axe = Column(Integer, ForeignKey("axes.id_axe"), nullable=False)
    semaine = Column(Integer, nullable=False)
    jour = Column(Integer, nullable=False)  # 0 = Lundi ... 6 = Dimanche
    coche = Column(Boolean, default=False, nullable=False)
    date_coche = Column(DateTime, nullable=True)

    axe = relationship("Axe", back_populates="entrees")

    __table_args__ = (
        # RG-05 : un seul enregistrement possible par (axe, semaine, jour).
        # Contrainte posée en base, pas seulement vérifiée en Python — si demain un autre
        # service écrit directement en DB (script de migration, admin...), l'intégrité
        # tient quand même. Ne jamais faire confiance uniquement à la couche applicative
        # pour une règle d'unicité métier.
        UniqueConstraint("id_axe", "semaine", "jour", name="uq_entree_axe_semaine_jour"),
    )
