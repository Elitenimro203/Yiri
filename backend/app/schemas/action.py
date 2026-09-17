from datetime import date, datetime

from pydantic import BaseModel, Field


class ActionCreate(BaseModel):
    id_axe: int
    # Facultatif — une Action spontanée doit pouvoir exister sans Engagement
    # (§2/§10). Si fourni, vérifié côté serveur : doit appartenir à
    # l'utilisateur ET à la Construction indiquée (routers/actions.py).
    id_engagement: int | None = None
    # Facultatif — si absent, le serveur utilise la date du jour (UTC). Si
    # fourni, validé côté serveur (pas dans le futur) : jamais une confiance
    # aveugle en la date client (§9).
    date_action: date | None = None
    contenu: str | None = Field(default=None, max_length=500)


class ActionOut(BaseModel):
    id_entree: int
    id_axe: int
    id_engagement: int | None
    date_action: datetime | None
    contenu: str | None
    # Le vocabulaire legacy (semaine/jour/coche/date_coche) est
    # volontairement absent ici — même principe de masquage que
    # ConstructionOut/SaisonOut (Mission 5) : la nouvelle vue ne doit pas
    # remettre en avant ce qu'elle cherche justement à ne plus utiliser
    # comme référence temporelle principale (§12).

    class Config:
        from_attributes = True
