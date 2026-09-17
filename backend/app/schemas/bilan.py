from datetime import datetime

from pydantic import BaseModel, Field, model_validator

from app.models.bilan import DecisionBilan, TypeDecision


class BilanCreate(BaseModel):
    """
    Flux historique hebdomadaire — INCHANGÉ depuis Mission 1.5b (utilisé par
    POST /programmes/{id}/bilans). `decision` reste obligatoire ici : ce
    chemin ferme toujours une semaine précise d'un Programme précis.

    Mission 4 : accepte en plus, en option, les nouveaux champs du flux
    Réflexion (`remarque`, `comprehension`, `type_decision`, `id_axe`) — un
    Bilan hebdomadaire classique peut être enrichi sans que ce soit
    obligatoire, pour ne rien casser côté frontend existant.
    """
    semaine: int = Field(ge=1, le=4)
    quoi_a_marche: str | None = Field(default=None, max_length=2000)
    quoi_n_a_pas_marche: str | None = Field(default=None, max_length=2000)
    ajustement_semaine_suivante: str | None = Field(default=None, max_length=2000)
    decision: DecisionBilan
    id_axe: int | None = None
    remarque: str | None = Field(default=None, max_length=2000)
    comprehension: str | None = Field(default=None, max_length=2000)
    type_decision: TypeDecision | None = None


class ReflexionCreate(BaseModel):
    """
    Flux moderne, libre — Mission 4 (utilisé par POST /bilans, sans
    programme_id dans l'URL). Ni `id_programme` ni `semaine` ne sont
    obligatoires : une Réflexion peut être globale, liée à une Construction,
    ou liée à un Programme+semaine précis (auquel cas elle rejoint la même
    contrainte d'unicité que l'ancien flux — voir §11/§20, un seul concept).

    `type_decision` est le seul champ obligatoire côté décision : le
    vocabulaire moderne (§8), pas l'ancien `decision` consolider/avancer,
    devenu sans objet pour ce chemin.
    """
    id_programme: int | None = None
    semaine: int | None = Field(default=None, ge=1, le=4)
    id_axe: int | None = None
    remarque: str | None = Field(default=None, max_length=2000)
    comprehension: str | None = Field(default=None, max_length=2000)
    type_decision: TypeDecision
    # "Ce que je change" — réutilise le champ historique, même sens (§4).
    ajustement_semaine_suivante: str | None = Field(default=None, max_length=2000)

    @model_validator(mode="after")
    def _semaine_implique_programme(self):
        if self.semaine is not None and self.id_programme is None:
            raise ValueError("Une semaine n'a de sens que rattachée à un Programme (id_programme requis)")
        return self


class BilanOut(BaseModel):
    id_bilan: int
    id_programme: int | None
    id_utilisateur: int | None
    id_axe: int | None
    semaine: int | None
    score_snapshot: int | None
    quoi_a_marche: str | None
    quoi_n_a_pas_marche: str | None
    ajustement_semaine_suivante: str | None
    remarque: str | None
    comprehension: str | None
    decision: DecisionBilan | None
    type_decision: TypeDecision | None
    date_creation: datetime

    class Config:
        from_attributes = True
