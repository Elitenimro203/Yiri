from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.logique_programme import axe_est_deverrouille
from app.models.axe import Axe
from app.models.entree_suivi import EntreeSuivi
from app.models.utilisateur import Utilisateur
from app.routers.axes import _get_axe_ou_404
from app.routers.programmes import _get_programme_ou_404
from app.schemas.axe import EntreeSuiviOut

router = APIRouter(tags=["suivi"])


@router.get("/programmes/{programme_id}/suivi", response_model=list[EntreeSuiviOut])
def lire_grille_suivi(
    programme_id: int,
    semaine: int = Query(..., ge=1, le=4),
    current_user: Utilisateur = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _get_programme_ou_404(programme_id, current_user, db)  # vérifie la propriété, lève 404 sinon

    entrees = (
        db.query(EntreeSuivi)
        .join(EntreeSuivi.axe)
        .filter(Axe.id_programme == programme_id, EntreeSuivi.semaine == semaine)
        .all()
    )
    # Note volontaire : on ne renvoie QUE les entrées existantes (pas les 70 cases
    # possibles avec coche=False par défaut). Le frontend traite "absence d'entrée"
    # comme "non coché" — ça évite de créer 70 lignes en base à chaque premier
    # affichage d'une semaine, pour des cases jamais touchées.
    return entrees


@router.put("/axes/{axe_id}/suivi/{semaine}/{jour}", response_model=EntreeSuiviOut)
def toggle_case(
    axe_id: int,
    semaine: int,
    jour: int,
    current_user: Utilisateur = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not (0 <= jour <= 6):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="jour doit être entre 0 et 6")

    axe = _get_axe_ou_404(axe_id, current_user, db)

    # RG-04 + RG-09, appliqué ici et nulle part ailleurs qu'au serveur : même si le
    # frontend grise déjà les cases verrouillées par confort visuel, cette vérification
    # est la SEULE qui compte pour la sécurité — un client modifié ou un appel curl
    # direct ne doit jamais pouvoir cocher un axe verrouillé.
    if not axe_est_deverrouille(axe.programme, axe):
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail=f"Cet axe se débloque en semaine {axe.phase_deverrouillage}",
        )

    entree = (
        db.query(EntreeSuivi)
        .filter(EntreeSuivi.id_axe == axe_id, EntreeSuivi.semaine == semaine, EntreeSuivi.jour == jour)
        .first()
    )

    if entree is None:
        # Upsert manuel plutôt qu'un INSERT ... ON CONFLICT — plus portable entre
        # SQLite (dev) et PostgreSQL (prod), au prix d'un aller-retour DB en plus.
        # Signalé comme compromis Portabilité vs Performance (priorités #8 vs #5) :
        # acceptable ici vu le faible volume d'écritures (un utilisateur, ~10 cases/jour).
        entree = EntreeSuivi(id_axe=axe_id, semaine=semaine, jour=jour, coche=True)
        entree.date_coche = datetime.now(timezone.utc)
        db.add(entree)
    else:
        entree.coche = not entree.coche
        entree.date_coche = datetime.now(timezone.utc) if entree.coche else None

    db.commit()
    db.refresh(entree)
    return entree


@router.delete("/programmes/{programme_id}/suivi", status_code=status.HTTP_204_NO_CONTENT)
def reinitialiser_semaine(
    programme_id: int,
    semaine: int = Query(..., ge=1, le=4),
    current_user: Utilisateur = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _get_programme_ou_404(programme_id, current_user, db)

    (
        db.query(EntreeSuivi)
        .filter(
            EntreeSuivi.axe.has(id_programme=programme_id),
            EntreeSuivi.semaine == semaine,
        )
        .delete(synchronize_session=False)
    )
    db.commit()
