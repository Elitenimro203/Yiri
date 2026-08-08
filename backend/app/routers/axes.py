from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.logique_programme import axe_est_deverrouille, nb_jours_actifs
from app.models.axe import Axe, Pilier
from app.models.entree_suivi import EntreeSuivi
from app.models.programme import Programme
from app.models.utilisateur import Utilisateur
from app.routers.programmes import _get_programme_ou_404
from app.schemas.axe import AxeCreate, AxeOut, AxeUpdate, PilierProgres

router = APIRouter(tags=["axes"])


def _axe_vers_out(axe: Axe, programme: Programme) -> AxeOut:
    return AxeOut(
        id_axe=axe.id_axe,
        nom=axe.nom,
        phase_deverrouillage=axe.phase_deverrouillage,
        ordre_affichage=axe.ordre_affichage,
        pilier=axe.pilier,
        jours_actifs=axe.jours_actifs,
        # RG-04 + RG-09 : un axe ne "devient" pas déverrouillé, il L'EST ou non,
        # selon le programme parent — jamais stocké, toujours recalculé ici.
        deverrouille=axe_est_deverrouille(programme, axe),
    )


@router.get("/programmes/{programme_id}/axes", response_model=list[AxeOut])
def lister_axes(
    programme_id: int,
    current_user: Utilisateur = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    programme = _get_programme_ou_404(programme_id, current_user, db)
    axes = (
        db.query(Axe)
        .filter(Axe.id_programme == programme_id)
        .order_by(Axe.ordre_affichage)
        .all()
    )
    return [_axe_vers_out(a, programme) for a in axes]


@router.post("/programmes/{programme_id}/axes", response_model=AxeOut, status_code=status.HTTP_201_CREATED)
def creer_axe(
    programme_id: int,
    payload: AxeCreate,
    current_user: Utilisateur = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    programme = _get_programme_ou_404(programme_id, current_user, db)  # vérifie aussi la propriété
    axe = Axe(id_programme=programme_id, **payload.model_dump())
    db.add(axe)
    db.commit()
    db.refresh(axe)
    return _axe_vers_out(axe, programme)


@router.get("/programmes/{programme_id}/piliers", response_model=list[PilierProgres])
def progres_par_pilier(
    programme_id: int,
    semaine: int = Query(..., ge=1, le=4),
    current_user: Utilisateur = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Agrégation Corps/Esprit/Caractère/Impact (RG-10) — calculée à la demande à
    partir des axes + entrées réelles, jamais stockée. Un pilier sans axe
    déverrouillé cette semaine n'apparaît pas dans la réponse plutôt que de
    renvoyer un 0% trompeur (0% suggère un échec, "absent" suggère "pas encore
    débloqué" — distinction importante pour ne pas décourager inutilement).
    """
    programme = _get_programme_ou_404(programme_id, current_user, db)

    axes = db.query(Axe).filter(Axe.id_programme == programme_id).all()
    axes_deverrouilles = [a for a in axes if axe_est_deverrouille(programme, a, semaine)]

    if not axes_deverrouilles:
        return []

    ids_axes = [a.id_axe for a in axes_deverrouilles]
    entrees_cochees = (
        db.query(EntreeSuivi)
        .filter(EntreeSuivi.id_axe.in_(ids_axes), EntreeSuivi.semaine == semaine, EntreeSuivi.coche.is_(True))
        .all()
    )
    cases_par_axe: dict[int, int] = {}
    for e in entrees_cochees:
        cases_par_axe[e.id_axe] = cases_par_axe.get(e.id_axe, 0) + 1

    resultat: dict[Pilier, dict[str, int]] = {}
    for a in axes_deverrouilles:
        bucket = resultat.setdefault(a.pilier, {"cochees": 0, "possibles": 0})
        bucket["possibles"] += nb_jours_actifs(a)
        bucket["cochees"] += cases_par_axe.get(a.id_axe, 0)

    return [
        PilierProgres(
            pilier=p,
            cases_cochees=v["cochees"],
            cases_possibles=v["possibles"],
            pourcentage=round(100 * v["cochees"] / v["possibles"]) if v["possibles"] else 0,
        )
        for p, v in resultat.items()
    ]


def _get_axe_ou_404(axe_id: int, current_user: Utilisateur, db: Session) -> Axe:
    """
    Même principe anti-IDOR que _get_programme_ou_404, mais un axe n'a pas de FK
    directe vers utilisateur — on remonte via son programme parent (join).
    """
    axe = (
        db.query(Axe)
        .join(Axe.programme)
        .filter(Axe.id_axe == axe_id, Axe.programme.has(id_utilisateur=current_user.id_utilisateur))
        .first()
    )
    if axe is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Axe introuvable")
    return axe


@router.patch("/axes/{axe_id}", response_model=AxeOut)
def modifier_axe(
    axe_id: int,
    payload: AxeUpdate,
    current_user: Utilisateur = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    axe = _get_axe_ou_404(axe_id, current_user, db)
    for champ, valeur in payload.model_dump(exclude_unset=True).items():
        setattr(axe, champ, valeur)
    db.commit()
    db.refresh(axe)
    return _axe_vers_out(axe, axe.programme)


@router.delete("/axes/{axe_id}", status_code=status.HTTP_204_NO_CONTENT)
def supprimer_axe(
    axe_id: int,
    current_user: Utilisateur = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    axe = _get_axe_ou_404(axe_id, current_user, db)
    db.delete(axe)
    db.commit()
