from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.logique_programme import NB_SEMAINES_MAX, axe_est_deverrouille, nb_jours_actifs
from app.models.axe import Axe
from app.models.bilan import Bilan, DecisionBilan
from app.models.entree_suivi import EntreeSuivi
from app.models.programme import Programme, ModeProgression
from app.models.utilisateur import Utilisateur
from app.routers.programmes import _get_programme_ou_404
from app.schemas.bilan import BilanCreate, BilanOut

router = APIRouter(prefix="/programmes/{programme_id}/bilans", tags=["bilans"])


def _score_semaine(db: Session, programme: Programme, semaine: int) -> int:
    """
    Score global de la semaine — même logique que l'agrégation par pilier
    (RG-10), mais toutes dimensions confondues. Recalculé à la volée à partir
    des vraies entrées, jamais stocké ailleurs qu'en snapshot dans le bilan lui-même.
    """
    axes = db.query(Axe).filter(Axe.id_programme == programme.id_programme).all()
    axes_deverrouilles = [a for a in axes if axe_est_deverrouille(programme, a, semaine)]
    if not axes_deverrouilles:
        return 0

    possibles = sum(nb_jours_actifs(a) for a in axes_deverrouilles)
    ids_axes = [a.id_axe for a in axes_deverrouilles]
    cochees = (
        db.query(EntreeSuivi)
        .filter(EntreeSuivi.id_axe.in_(ids_axes), EntreeSuivi.semaine == semaine, EntreeSuivi.coche.is_(True))
        .count()
    )
    return round(100 * cochees / possibles) if possibles else 0


@router.get("", response_model=list[BilanOut])
def lister_bilans(
    programme_id: int,
    current_user: Utilisateur = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _get_programme_ou_404(programme_id, current_user, db)
    return (
        db.query(Bilan)
        .filter(Bilan.id_programme == programme_id)
        .order_by(Bilan.semaine)
        .all()
    )


@router.get("/{semaine}", response_model=BilanOut)
def get_bilan(
    programme_id: int,
    semaine: int,
    current_user: Utilisateur = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _get_programme_ou_404(programme_id, current_user, db)
    bilan = (
        db.query(Bilan)
        .filter(Bilan.id_programme == programme_id, Bilan.semaine == semaine)
        .first()
    )
    if bilan is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Aucun bilan pour cette semaine")
    return bilan


@router.post("", response_model=BilanOut, status_code=status.HTTP_201_CREATED)
def creer_bilan(
    programme_id: int,
    payload: BilanCreate,
    current_user: Utilisateur = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    programme = _get_programme_ou_404(programme_id, current_user, db)

    if payload.semaine > programme.semaine_courante:
        # On ne clôture pas une semaine qui n'a pas encore commencé.
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Impossible de clôturer la semaine {payload.semaine} : le programme en est à la semaine {programme.semaine_courante}",
        )

    score = _score_semaine(db, programme, payload.semaine)

    bilan = Bilan(
        id_programme=programme_id,
        semaine=payload.semaine,
        score_snapshot=score,
        quoi_a_marche=payload.quoi_a_marche,
        quoi_n_a_pas_marche=payload.quoi_n_a_pas_marche,
        ajustement_semaine_suivante=payload.ajustement_semaine_suivante,
        decision=payload.decision,
    )
    db.add(bilan)
    try:
        db.commit()
    except IntegrityError:
        # RG-12 : un seul bilan par (programme, semaine) — même pattern anti-race
        # condition que RG-01 (email unique) : on intercepte la contrainte DB
        # plutôt qu'un SELECT préalable.
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Un bilan existe déjà pour la semaine {payload.semaine}",
        )
    db.refresh(bilan)

    # Décision "avancer" : ne déclenche l'avancement réel que si on clôture
    # bien la semaine EN COURS (pas un bilan rétroactif sur une semaine passée)
    # et que le programme est en mode manuel (en mode auto, la semaine avance
    # de toute façon par la date, RG-08).
    if (
        payload.decision == DecisionBilan.avancer
        and payload.semaine == programme.semaine_courante
        and programme.mode_progression == ModeProgression.manuel
        and programme.semaine_courante < NB_SEMAINES_MAX
    ):
        programme.semaine_courante += 1
        db.commit()

    return bilan
