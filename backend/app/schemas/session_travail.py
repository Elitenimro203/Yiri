from datetime import datetime

from pydantic import BaseModel, Field

from app.models.session_travail import TypeSession


class SessionCreate(BaseModel):
    type: TypeSession = TypeSession.libre
    # Uniquement utilisés si type = pomodoro. Défaut 25/5 si non fournis —
    # standard par défaut, personnalisable si l'utilisateur le souhaite.
    duree_focus_minutes: int | None = Field(default=None, ge=1, le=120)
    duree_pause_minutes: int | None = Field(default=None, ge=1, le=60)


class SessionOut(BaseModel):
    id_session: int
    id_axe: int
    type: TypeSession
    date_debut: datetime
    date_fin: datetime | None
    duree_secondes: int | None
    duree_focus_minutes: int | None
    duree_pause_minutes: int | None

    class Config:
        from_attributes = True


class TempsParAxe(BaseModel):
    """Agrégation du temps total loggé sur un axe, pour une semaine donnée."""
    id_axe: int
    nom_axe: str
    duree_totale_secondes: int
    nb_sessions: int
