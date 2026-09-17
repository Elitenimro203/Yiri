from datetime import datetime, time, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.axe import Axe
from app.models.entree_suivi import EntreeSuivi
from app.models.utilisateur import Utilisateur
from app.routers.axes import _get_axe_ou_404
from app.routers.engagements import _get_engagement_ou_404
from app.schemas.action import ActionCreate, ActionOut

router = APIRouter(prefix="/actions", tags=["actions"])


@router.post("", response_model=ActionOut, status_code=status.HTTP_201_CREATED)
def creer_action(
    payload: ActionCreate,
    current_user: Utilisateur = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Anti-IDOR — même helper que partout ailleurs. Volontairement AUCUN
    # appel à axe_est_deverrouille ici (§11) : une Action moderne n'est
    # jamais bloquée par phase_deverrouillage, contrairement à l'ancien
    # toggle_case (routers/suivi.py, legacy, inchangé) qui continue, lui, de
    # vérifier ce verrou.
    _get_axe_ou_404(payload.id_axe, current_user, db)

    if payload.id_engagement is not None:
        engagement = _get_engagement_ou_404(payload.id_engagement, current_user, db)  # anti-IDOR
        if engagement.id_axe != payload.id_axe:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Cet Engagement n'appartient pas à la Construction indiquée",
            )
        # Test 10 (§16) : créer une Action ne réactive JAMAIS un Engagement
        # suspendu — `engagement.actif` n'est ni lu ni modifié ici,
        # intentionnellement. Un Engagement suspendu reste un historique
        # valide pour les Actions déjà associées (Test 9).

    if payload.date_action is not None:
        aujourd_hui = datetime.now(timezone.utc).date()
        if payload.date_action > aujourd_hui:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="La date d'une Action ne peut pas être dans le futur",
            )
        date_action = datetime.combine(payload.date_action, time.min, tzinfo=timezone.utc)
    else:
        # §9 : la date n'est jamais fournie aveuglément par le client sans
        # validation — ici, en son absence, le serveur choisit "aujourd'hui"
        # lui-même plutôt que d'accepter un défaut implicite côté client.
        date_action = datetime.now(timezone.utc)

    action = EntreeSuivi(
        id_axe=payload.id_axe,
        id_engagement=payload.id_engagement,
        semaine=None,
        jour=None,
        # L'enregistrement de l'Action EST le fait qu'elle a eu lieu — pas un
        # toggle (§2). `coche` reste techniquement nécessaire (colonne NOT
        # NULL, legacy), toujours True pour une Action moderne, jamais
        # inversé après coup contrairement au mécanisme Wakati.
        coche=True,
        date_action=date_action,
        contenu=payload.contenu,
    )
    db.add(action)
    db.commit()
    db.refresh(action)
    return action


@router.get("", response_model=list[ActionOut])
def lister_actions(
    axe_id: int | None = Query(default=None),
    engagement_id: int | None = Query(default=None),
    current_user: Utilisateur = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Renvoie les Actions réelles de l'utilisateur — modernes (date_action
    renseignée) ET legacy (cases Wakati cochées, Test 11 : elles restent
    lisibles). `coche=False` est exclu : une case décochée n'est pas un fait
    qui s'est produit, c'est l'absence d'un fait (§2 : "l'Action appartient à
    la réalité").
    """
    requete = (
        db.query(EntreeSuivi)
        .join(EntreeSuivi.axe)
        .filter(
            EntreeSuivi.coche.is_(True),
            or_(
                Axe.id_utilisateur == current_user.id_utilisateur,
                Axe.programme.has(id_utilisateur=current_user.id_utilisateur),
            ),
        )
    )
    if axe_id is not None:
        requete = requete.filter(EntreeSuivi.id_axe == axe_id)
    if engagement_id is not None:
        requete = requete.filter(EntreeSuivi.id_engagement == engagement_id)

    resultats = requete.all()
    # Tri par date réelle effective (date_action si présente, sinon
    # date_coche pour le legacy — jamais par semaine/jour, §12/Test 6).
    resultats.sort(key=lambda e: e.date_action or e.date_coche or datetime.min, reverse=True)
    return resultats


def _get_action_ou_404(action_id: int, current_user: Utilisateur, db: Session) -> EntreeSuivi:
    action = db.query(EntreeSuivi).filter(EntreeSuivi.id_entree == action_id).first()
    if action is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Action introuvable")
    _get_axe_ou_404(action.id_axe, current_user, db)  # anti-IDOR
    return action


@router.get("/{action_id}", response_model=ActionOut)
def get_action(
    action_id: int,
    current_user: Utilisateur = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return _get_action_ou_404(action_id, current_user, db)
