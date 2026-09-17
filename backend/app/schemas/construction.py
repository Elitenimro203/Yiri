from datetime import datetime

from pydantic import BaseModel, Field

from app.models.axe import StatutConstruction


class ConstructionCreate(BaseModel):
    """
    Volontairement dépourvu de pilier/phase/semaine/cible numérique
    (Mission 5 §10/§14) — seuls nom et intention ont un sens pour une
    Construction ; `id_saison` est facultatif (§4 : une Construction peut
    exister hors Saison).
    """
    nom: str = Field(min_length=1, max_length=100)
    intention: str | None = Field(default=None, max_length=2000)
    id_saison: int | None = None


class ConstructionUpdate(BaseModel):
    """
    `statut` n'est PAS modifiable ici — les transitions (pause/reprendre/
    terminer/abandonner) passent par les actions dédiées ci-dessous, pour
    qu'aucune ne soit jamais traitée comme un simple champ à écraser sans
    intention explicite (§4 : "ne pas être considérée automatiquement comme
    un échec").
    """
    nom: str | None = Field(default=None, min_length=1, max_length=100)
    intention: str | None = None
    id_saison: int | None = None


class ConstructionOut(BaseModel):
    """
    id_construction est un alias de lecture sur Axe.id_axe ; id_saison sur
    Axe.id_programme — même ligne physique (voir routers/constructions.py,
    _axe_vers_construction). `pilier`/`phase_deverrouillage`/`jours_actifs`
    existent toujours en base mais sont volontairement absents de cette
    sortie (Mission 5 §11/§12) — l'ancienne API /programmes/{id}/axes
    continue, elle, à les exposer sans changement.

    `statut` peut être `None` pour une Construction historique (un Axe
    Wakati n'a jamais eu cette notion) — jamais fabriqué rétroactivement
    (§23). Le frontend traite `None` comme équivalent à `active` à
    l'affichage seulement, sans jamais l'écrire en base (voir
    ConstructionsPage.tsx).
    """
    id_construction: int
    id_saison: int | None
    nom: str
    intention: str | None
    statut: StatutConstruction | None
    ordre_affichage: int
    date_creation: datetime | None

    class Config:
        from_attributes = True
