from datetime import date

from pydantic import BaseModel, Field, model_validator

from app.models.engagement import TypeEngagement


class EngagementCreate(BaseModel):
    description: str = Field(min_length=1, max_length=2000)
    type: TypeEngagement = TypeEngagement.recurrent
    date_debut: date
    date_fin: date | None = None
    actif: bool = True

    @model_validator(mode="after")
    def _valider_coherence_dates(self):
        if self.date_fin is not None and self.date_fin < self.date_debut:
            raise ValueError("date_fin ne peut pas être antérieure à date_debut")
        return self


class EngagementUpdate(BaseModel):
    """
    Tous les champs optionnels (mise à jour partielle, même convention que
    AxeUpdate) — y compris `actif`, qui sert à suspendre/reprendre un
    engagement sans notion d'échec (RG Mission 2 : pas de pénalité).
    """
    description: str | None = Field(default=None, min_length=1, max_length=2000)
    type: TypeEngagement | None = None
    date_debut: date | None = None
    date_fin: date | None = None
    actif: bool | None = None

    @model_validator(mode="after")
    def _valider_coherence_dates(self):
        # Ne valide que si les deux dates sont fournies ENSEMBLE dans ce payload
        # — la cohérence avec une date déjà persistée (si une seule des deux
        # est envoyée) est revérifiée côté routeur, qui a accès à l'existant.
        if self.date_debut is not None and self.date_fin is not None and self.date_fin < self.date_debut:
            raise ValueError("date_fin ne peut pas être antérieure à date_debut")
        return self


class EngagementOut(BaseModel):
    id_engagement: int
    id_axe: int
    description: str
    type: TypeEngagement
    date_debut: date
    date_fin: date | None
    actif: bool

    class Config:
        from_attributes = True
