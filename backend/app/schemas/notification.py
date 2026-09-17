from datetime import time

from pydantic import BaseModel, Field, field_validator


class NotificationCreate(BaseModel):
    libelle: str = Field(min_length=1, max_length=100)
    heure: time
    jours_actifs: str  # ex: "1,2,3,4,5,6,7"
    id_axe: int | None = None

    @field_validator("jours_actifs")
    @classmethod
    def valider_jours(cls, v: str) -> str:
        # Validation métier au niveau du schéma : refuse "8" ou "lundi" avant même
        # d'atteindre la logique métier. Échoue vite, échoue clairement (422 explicite).
        jours = v.split(",")
        for j in jours:
            if not j.strip().isdigit() or not (1 <= int(j.strip()) <= 7):
                raise ValueError(f"Jour invalide: '{j}' — attendu un entier entre 1 et 7")
        return v


class NotificationUpdate(BaseModel):
    libelle: str | None = None
    heure: time | None = None
    jours_actifs: str | None = None
    actif: bool | None = None


class NotificationOut(BaseModel):
    id_notification: int
    libelle: str
    heure: time
    jours_actifs: str
    actif: bool
    id_axe: int | None

    class Config:
        from_attributes = True
