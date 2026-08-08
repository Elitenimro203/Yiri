from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from app.models.axe import Pilier


def _valider_jours_actifs(v: str | None) -> str | None:
    if v is None:
        return v
    for j in v.split(','):
        if not j.strip().isdigit() or not (1 <= int(j.strip()) <= 7):
            raise ValueError(f"Jour invalide: '{j}' — attendu un entier entre 1 (lundi) et 7 (dimanche)")
    return v


class AxeCreate(BaseModel):
    nom: str = Field(min_length=1, max_length=100)
    phase_deverrouillage: int = Field(ge=1, le=4)
    ordre_affichage: int = 0
    pilier: Pilier
    # RG-11 : None = actif tous les jours (défaut, rien ne casse pour les axes existants)
    jours_actifs: str | None = None

    _valider = field_validator('jours_actifs')(_valider_jours_actifs)


class AxeUpdate(BaseModel):
    nom: str | None = None
    phase_deverrouillage: int | None = Field(default=None, ge=1, le=4)
    ordre_affichage: int | None = None
    pilier: Pilier | None = None
    jours_actifs: str | None = None

    _valider = field_validator('jours_actifs')(_valider_jours_actifs)


class AxeOut(BaseModel):
    id_axe: int
    nom: str
    phase_deverrouillage: int
    ordre_affichage: int
    pilier: Pilier
    jours_actifs: str | None
    deverrouille: bool  # calculé côté serveur, jamais stocké — voir RG-04

    class Config:
        from_attributes = True


class PilierProgres(BaseModel):
    pilier: Pilier
    pourcentage: int  # 0-100, arrondi
    cases_cochees: int
    cases_possibles: int  # somme des jours actifs des axes déverrouillés de ce pilier


class EntreeSuiviOut(BaseModel):
    id_axe: int
    semaine: int
    jour: int
    coche: bool
    date_coche: datetime | None

    class Config:
        from_attributes = True
