from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.axe import Axe
from app.models.notification import Notification
from app.models.utilisateur import Utilisateur
from app.schemas.notification import NotificationCreate, NotificationUpdate, NotificationOut

router = APIRouter(prefix="/notifications", tags=["notifications"])


def _get_notification_ou_404(notif_id: int, current_user: Utilisateur, db: Session) -> Notification:
    notif = (
        db.query(Notification)
        .filter(Notification.id_notification == notif_id, Notification.id_utilisateur == current_user.id_utilisateur)
        .first()
    )
    if notif is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification introuvable")
    return notif


@router.get("", response_model=list[NotificationOut])
def lister_notifications(
    current_user: Utilisateur = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return db.query(Notification).filter(Notification.id_utilisateur == current_user.id_utilisateur).all()


@router.post("", response_model=NotificationOut, status_code=status.HTTP_201_CREATED)
def creer_notification(
    payload: NotificationCreate,
    current_user: Utilisateur = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if payload.id_axe is not None:
        # Vérifie que l'axe référencé appartient bien à un programme de cet utilisateur —
        # sinon on pourrait créer un rappel pointant vers l'axe de quelqu'un d'autre.
        axe_existe = (
            db.query(Axe)
            .join(Axe.programme)
            .filter(Axe.id_axe == payload.id_axe, Axe.programme.has(id_utilisateur=current_user.id_utilisateur))
            .first()
        )
        if axe_existe is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Axe référencé introuvable")

    notif = Notification(id_utilisateur=current_user.id_utilisateur, **payload.model_dump())
    db.add(notif)
    db.commit()
    db.refresh(notif)
    return notif


@router.patch("/{notif_id}", response_model=NotificationOut)
def modifier_notification(
    notif_id: int,
    payload: NotificationUpdate,
    current_user: Utilisateur = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    notif = _get_notification_ou_404(notif_id, current_user, db)
    for champ, valeur in payload.model_dump(exclude_unset=True).items():
        setattr(notif, champ, valeur)
    db.commit()
    db.refresh(notif)
    return notif


@router.delete("/{notif_id}", status_code=status.HTTP_204_NO_CONTENT)
def supprimer_notification(
    notif_id: int,
    current_user: Utilisateur = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    notif = _get_notification_ou_404(notif_id, current_user, db)
    db.delete(notif)
    db.commit()
