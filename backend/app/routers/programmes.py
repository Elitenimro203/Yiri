from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.logique_programme import NB_SEMAINES_MAX
from app.models.programme import Programme, ModeProgression
from app.models.utilisateur import Utilisateur
from app.schemas.programme import ProgrammeCreate, ProgrammeUpdate, ProgrammeOut

router = APIRouter(prefix="/programmes", tags=["programmes"])


def _get_programme_ou_404(programme_id: int, current_user: Utilisateur, db: Session) -> Programme:
    """
    Helper partagé par toutes les routes /programmes/{id}/...

    ⚠️ SÉCURITÉ : le filtre `id_utilisateur == current_user.id_utilisateur` n'est PAS
    optionnel. Sans lui, n'importe quel utilisateur connecté pourrait lire/modifier le
    programme d'un autre en devinant un id_programme dans l'URL — c'est une faille
    IDOR (Insecure Direct Object Reference), l'une des plus fréquentes en API REST.
    On renvoie 404 (pas 403) pour ne même pas révéler que l'id existe.
    """
    programme = (
        db.query(Programme)
        .filter(
            Programme.id_programme == programme_id,
            Programme.id_utilisateur == current_user.id_utilisateur,
        )
        .first()
    )
    if programme is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Programme introuvable")
    return programme


@router.get("", response_model=list[ProgrammeOut])
def lister_programmes(
    current_user: Utilisateur = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return db.query(Programme).filter(Programme.id_utilisateur == current_user.id_utilisateur).all()


@router.post("", response_model=ProgrammeOut, status_code=status.HTTP_201_CREATED)
def creer_programme(
    payload: ProgrammeCreate,
    current_user: Utilisateur = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    programme = Programme(id_utilisateur=current_user.id_utilisateur, **payload.model_dump())
    db.add(programme)
    db.commit()
    db.refresh(programme)
    return programme


@router.get("/{programme_id}", response_model=ProgrammeOut)
def detail_programme(
    programme_id: int,
    current_user: Utilisateur = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return _get_programme_ou_404(programme_id, current_user, db)


@router.patch("/{programme_id}", response_model=ProgrammeOut)
def modifier_programme(
    programme_id: int,
    payload: ProgrammeUpdate,
    current_user: Utilisateur = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    programme = _get_programme_ou_404(programme_id, current_user, db)
    # exclude_unset=True : seuls les champs explicitement envoyés sont appliqués.
    # 💡 Piège classique : faire `programme.x = payload.x` pour tous les champs sans
    # exclude_unset → un PATCH partiel écraserait les champs non envoyés avec leur
    # valeur par défaut Pydantic (None), au lieu de les laisser inchangés.
    for champ, valeur in payload.model_dump(exclude_unset=True).items():
        setattr(programme, champ, valeur)
    db.commit()
    db.refresh(programme)
    return programme


@router.post("/{programme_id}/semaine-suivante", response_model=ProgrammeOut)
def avancer_semaine(
    programme_id: int,
    current_user: Utilisateur = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    programme = _get_programme_ou_404(programme_id, current_user, db)

    if programme.mode_progression != ModeProgression.manuel:
        # RG-08 : en mode auto, la semaine est calculée par date — avancer manuellement
        # créerait une incohérence entre semaine_courante (stockée) et la réalité calculée.
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Le programme est en mode 'auto' : la semaine avance automatiquement par date",
        )

    if programme.semaine_courante >= NB_SEMAINES_MAX:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Déjà à la dernière semaine du plan ({NB_SEMAINES_MAX})",
        )

    programme.semaine_courante += 1
    db.commit()
    db.refresh(programme)
    return programme


@router.delete("/{programme_id}", status_code=status.HTTP_204_NO_CONTENT)
def supprimer_programme(
    programme_id: int,
    current_user: Utilisateur = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    programme = _get_programme_ou_404(programme_id, current_user, db)
    db.delete(programme)  # cascade="all, delete-orphan" sur la relation supprime axes/entrées/notifs liés
    db.commit()
