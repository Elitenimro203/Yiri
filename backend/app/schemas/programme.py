from datetime import date

from pydantic import BaseModel, Field

from app.models.programme import ModeProgression, StatutProgramme, ModeDeverrouillage


class ProgrammeCreate(BaseModel):
    nom: str = Field(min_length=1, max_length=100)
    date_debut: date
    mode_progression: ModeProgression = ModeProgression.manuel
    mode_deverrouillage: ModeDeverrouillage = ModeDeverrouillage.progressif


class ProgrammeUpdate(BaseModel):
    # Tous les champs optionnels : PATCH ne modifie que ce qui est fourni.
    nom: str | None = None
    mode_progression: ModeProgression | None = None
    statut: StatutProgramme | None = None
    mode_deverrouillage: ModeDeverrouillage | None = None


class ProgrammeOut(BaseModel):
    id_programme: int
    nom: str
    date_debut: date
    mode_progression: ModeProgression
    semaine_courante: int
    statut: StatutProgramme
    mode_deverrouillage: ModeDeverrouillage

    class Config:
        from_attributes = True
