import enum

from sqlalchemy import Column, Integer, Text, Boolean, Date, ForeignKey, Enum
from sqlalchemy.orm import relationship

from app.core.database import Base


class TypeEngagement(str, enum.Enum):
    """
    Volontairement réduit à deux valeurs techniques (Mission 2) — pas de
    moteur de récurrence, pas de taxonomie sophistiquée. À enrichir plus tard
    si un vrai besoin apparaît, pas par anticipation.
    """
    recurrent = "recurrent"
    ponctuel = "ponctuel"


class Engagement(Base):
    """
    Ce que l'utilisateur accepte concrètement de faire pour une Construction
    (`Axe`, nom technique historique conservé pour cette phase — voir Mission 2).

    Un Engagement se décrit, il ne se note pas : pas de pourcentage de
    réussite, pas de streak, pas de score, pas de statut "échoué". `actif`
    indique seulement si l'engagement est actuellement suivi ou non
    (suspendu, terminé, abandonné — sans distinction à ce stade, la nuance
    viendra d'une mission ultérieure si elle s'avère nécessaire).

    `date_debut` décrit l'engagement dans le temps ; ce n'est PAS un nouveau
    système de verrouillage — contrairement à `Axe.phase_deverrouillage`,
    rien ici ne conditionne l'accès à quoi que ce soit.
    """
    __tablename__ = "engagements"

    id_engagement = Column(Integer, primary_key=True, index=True)
    id_axe = Column(Integer, ForeignKey("axes.id_axe"), nullable=False)
    description = Column(Text, nullable=False)
    type = Column(Enum(TypeEngagement), nullable=False, default=TypeEngagement.recurrent)
    date_debut = Column(Date, nullable=False)
    date_fin = Column(Date, nullable=True)
    actif = Column(Boolean, nullable=False, default=True)

    axe = relationship("Axe", back_populates="engagements")
    entrees = relationship("EntreeSuivi", back_populates="engagement")
