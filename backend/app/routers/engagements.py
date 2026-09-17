from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.engagement import Engagement
from app.models.utilisateur import Utilisateur
from app.routers.axes import _get_axe_ou_404
from app.schemas.engagement import EngagementCreate, EngagementOut, EngagementUpdate

router = APIRouter(tags=["engagements"])


@router.get("/axes/{axe_id}/engagements", response_model=list[EngagementOut])
def lister_engagements(
    axe_id: int,
    current_user: Utilisateur = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _get_axe_ou_404(axe_id, current_user, db)  # vérifie aussi la propriété (anti-IDOR)
    return (
        db.query(Engagement)
        .filter(Engagement.id_axe == axe_id)
        .order_by(Engagement.id_engagement)
        .all()
    )


@router.post("/axes/{axe_id}/engagements", response_model=EngagementOut, status_code=status.HTTP_201_CREATED)
def creer_engagement(
    axe_id: int,
    payload: EngagementCreate,
    current_user: Utilisateur = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _get_axe_ou_404(axe_id, current_user, db)  # vérifie aussi la propriété (anti-IDOR)
    engagement = Engagement(id_axe=axe_id, **payload.model_dump())
    db.add(engagement)
    db.commit()
    db.refresh(engagement)
    return engagement


def _get_engagement_ou_404(engagement_id: int, current_user: Utilisateur, db: Session) -> Engagement:
    """
    Anti-IDOR — vérifie la propriété en réutilisant _get_axe_ou_404
    (routers/axes.py) plutôt qu'une seconde implémentation. L'ancienne
    version faisait un INNER JOIN direct vers Programme, qui excluait
    silencieusement tout Engagement d'une Construction sans Saison (même
    bug que celui corrigé en Mission 5 sur _get_axe_ou_404 — pas détecté à
    l'époque car cette fonction est une implémentation séparée). Corrigé en
    Mission 6, à l'occasion de l'audit préalable (§7).
    """
    engagement = db.query(Engagement).filter(Engagement.id_engagement == engagement_id).first()
    if engagement is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Engagement introuvable")
    _get_axe_ou_404(engagement.id_axe, current_user, db)  # lève 404 si l'axe n'appartient pas à current_user
    return engagement


@router.get("/engagements/{engagement_id}", response_model=EngagementOut)
def get_engagement(
    engagement_id: int,
    current_user: Utilisateur = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return _get_engagement_ou_404(engagement_id, current_user, db)


@router.patch("/engagements/{engagement_id}", response_model=EngagementOut)
def modifier_engagement(
    engagement_id: int,
    payload: EngagementUpdate,
    current_user: Utilisateur = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Sert aussi à activer/désactiver (`{"actif": false}`) — pas d'endpoint
    dédié, même logique que modifier_axe (routers/axes.py).
    """
    engagement = _get_engagement_ou_404(engagement_id, current_user, db)

    donnees = payload.model_dump(exclude_unset=True)

    nouvelle_debut = donnees.get("date_debut", engagement.date_debut)
    nouvelle_fin = donnees.get("date_fin", engagement.date_fin)
    if nouvelle_fin is not None and nouvelle_debut is not None and nouvelle_fin < nouvelle_debut:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="date_fin ne peut pas être antérieure à date_debut",
        )

    for champ, valeur in donnees.items():
        setattr(engagement, champ, valeur)
    db.commit()
    db.refresh(engagement)
    return engagement
