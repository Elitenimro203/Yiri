from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.push_subscription import PushSubscription
from app.models.utilisateur import Utilisateur
from app.schemas.push import PushSubscriptionCreate, PushSubscriptionOut, VapidPublicKeyOut

router = APIRouter(prefix="/push", tags=["push"])
settings = get_settings()


@router.get("/vapid-public-key", response_model=VapidPublicKeyOut)
def get_vapid_public_key():
    """
    Endpoint public (pas d'auth) — le frontend en a besoin AVANT que l'utilisateur
    soit forcément connecté sur cet appareil, pour proposer l'abonnement dès
    l'écran de login si on veut. Une clé publique n'est, par définition, pas un secret.
    """
    return VapidPublicKeyOut(vapid_public_key=settings.VAPID_PUBLIC_KEY)


@router.post("/subscribe", response_model=PushSubscriptionOut, status_code=status.HTTP_201_CREATED)
def subscribe(
    payload: PushSubscriptionCreate,
    current_user: Utilisateur = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sub = PushSubscription(
        id_utilisateur=current_user.id_utilisateur,
        endpoint=payload.endpoint,
        cle_p256dh=payload.cle_p256dh,
        cle_auth=payload.cle_auth,
    )
    db.add(sub)
    try:
        db.commit()
    except IntegrityError:
        # Le navigateur a re-souscrit avec le même endpoint (ex: après avoir
        # révoqué puis ré-autorisé) — on traite ça comme un succès idempotent,
        # pas une erreur, plutôt que d'obliger le frontend à gérer un cas
        # spécial pour quelque chose d'aussi bénin qu'un doublon d'abonnement.
        db.rollback()
        existant = (
            db.query(PushSubscription)
            .filter(
                PushSubscription.id_utilisateur == current_user.id_utilisateur,
                PushSubscription.endpoint == payload.endpoint,
            )
            .first()
        )
        return existant
    db.refresh(sub)
    return sub


@router.delete("/subscribe", status_code=status.HTTP_204_NO_CONTENT)
def unsubscribe(
    payload: PushSubscriptionCreate,
    current_user: Utilisateur = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db.query(PushSubscription).filter(
        PushSubscription.id_utilisateur == current_user.id_utilisateur,
        PushSubscription.endpoint == payload.endpoint,
    ).delete()
    db.commit()
