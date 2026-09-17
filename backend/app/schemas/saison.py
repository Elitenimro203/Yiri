from datetime import date

from pydantic import BaseModel, Field, model_validator

from app.models.programme import StatutProgramme


class SaisonCreate(BaseModel):
    """
    Volontairement dépourvu de tout champ Wakati (mode_progression,
    mode_deverrouillage, semaine) — une Saison ne doit rien exiger de tout
    cela (Mission 5 §3). Les valeurs par défaut historiques de `Programme`
    (mode_progression=manuel, mode_deverrouillage=progressif) s'appliquent
    silencieusement en base, mais n'ont aucune signification pour ce
    nouveau flux : aucune Construction créée via /constructions n'en dépend
    (voir routers/constructions.py).
    """
    nom: str = Field(min_length=1, max_length=100)
    intention: str | None = Field(default=None, max_length=2000)
    date_debut: date
    date_fin: date | None = None

    @model_validator(mode="after")
    def _dates_coherentes(self):
        if self.date_fin is not None and self.date_fin < self.date_debut:
            raise ValueError("date_fin ne peut pas précéder date_debut")
        return self


class SaisonUpdate(BaseModel):
    """
    Ne permet PAS de changer `statut` ici — les transitions d'état passent
    par les actions explicites dédiées (POST /seasons/{id}/terminer et
    /archiver), pas par un PATCH générique. Une Saison ne "redevient" jamais
    active depuis un état terminé/archivé dans cette mission (non demandé).
    """
    nom: str | None = Field(default=None, min_length=1, max_length=100)
    intention: str | None = None
    date_fin: date | None = None


class SaisonOut(BaseModel):
    """
    id_saison est un alias de lecture sur Programme.id_programme (voir
    routers/seasons.py, _programme_vers_saison) — même ligne physique, pas
    une nouvelle entité. Les champs Wakati (semaine_courante,
    mode_progression, mode_deverrouillage) sont délibérément absents de
    cette sortie : ils existent toujours en base (rien n'est supprimé) mais
    n'ont pas leur place dans le vocabulaire Saison (Mission 5 §3/§12).
    """
    id_saison: int
    nom: str
    intention: str | None
    date_debut: date
    date_fin: date | None
    statut: StatutProgramme

    class Config:
        from_attributes = True
