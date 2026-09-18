from datetime import datetime
from typing import Literal

from pydantic import BaseModel

TypeEvenement = Literal[
    "season_started",
    "season_ended",
    "construction_created",
    "action",
    "observation",
    "reflection",
    "decision",
]


class SeasonContext(BaseModel):
    id_saison: int
    nom: str


class ConstructionContext(BaseModel):
    id_construction: int
    nom: str


class TrajectoryEvent(BaseModel):
    """
    Une seule ligne de la Trajectoire — une projection de lecture d'un objet
    métier existant (Programme, Axe, EntreeSuivi, Observation, Bilan),
    jamais une nouvelle donnée persistée (§3). Volontairement PAS de champ
    score/progression/pourcentage/importance/significant/turning_point/
    insight/transformation/tree_stage (§4) : la Trajectoire montre, elle
    n'interprète pas.
    """
    type: TypeEvenement
    date: datetime
    source_type: str
    source_id: int
    title: str
    content: str | None
    season: SeasonContext | None
    construction: ConstructionContext | None


class TrajectoryPage(BaseModel):
    items: list[TrajectoryEvent]
    total: int
    limit: int
    offset: int
