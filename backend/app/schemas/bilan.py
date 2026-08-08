from datetime import datetime

from pydantic import BaseModel, Field

from app.models.bilan import DecisionBilan


class BilanCreate(BaseModel):
    semaine: int = Field(ge=1, le=4)
    quoi_a_marche: str | None = Field(default=None, max_length=2000)
    quoi_n_a_pas_marche: str | None = Field(default=None, max_length=2000)
    ajustement_semaine_suivante: str | None = Field(default=None, max_length=2000)
    decision: DecisionBilan


class BilanOut(BaseModel):
    id_bilan: int
    semaine: int
    score_snapshot: int
    quoi_a_marche: str | None
    quoi_n_a_pas_marche: str | None
    ajustement_semaine_suivante: str | None
    decision: DecisionBilan
    date_creation: datetime

    class Config:
        from_attributes = True
