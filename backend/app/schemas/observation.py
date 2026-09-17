from datetime import datetime

from pydantic import BaseModel, Field


class ObservationCreate(BaseModel):
    contenu: str = Field(min_length=1, max_length=2000)
    id_axe: int | None = None
    id_entree: int | None = None


class ObservationUpdate(BaseModel):
    """
    Tous les champs optionnels (mise à jour partielle, même convention que
    EngagementUpdate/AxeUpdate). Les associations peuvent être modifiées —
    y compris remises à `null` explicitement — mais leur cohérence mutuelle
    est revérifiée dans le router (voir routers/observations.py), pas ici :
    un payload partiel ne connaît pas l'état déjà persisté.
    """
    contenu: str | None = Field(default=None, min_length=1, max_length=2000)
    id_axe: int | None = None
    id_entree: int | None = None


class ObservationOut(BaseModel):
    id_observation: int
    id_utilisateur: int
    id_axe: int | None
    id_entree: int | None
    contenu: str
    date_creation: datetime

    class Config:
        from_attributes = True
