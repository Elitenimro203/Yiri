import json
import logging

from pywebpush import webpush, WebPushException
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.push_subscription import PushSubscription

logger = logging.getLogger(__name__)
settings = get_settings()


def envoyer_push(db: Session, subscription: PushSubscription, titre: str, corps: str) -> bool:
    """
    Envoie une notification à UN abonnement. Renvoie False (et supprime
    l'abonnement) s'il est expiré/révoqué — un navigateur peut invalider un
    abonnement sans prévenir (désinstallation, changement d'appareil...), et
    le service de push renvoie alors 404/410. Sans ce nettoyage, on
    réessaierait indéfiniment un abonnement mort à chaque cycle.
    """
    if not settings.VAPID_PRIVATE_KEY:
        logger.warning("VAPID_PRIVATE_KEY absent — envoi push ignoré")
        return False

    try:
        webpush(
            subscription_info={
                "endpoint": subscription.endpoint,
                "keys": {"p256dh": subscription.cle_p256dh, "auth": subscription.cle_auth},
            },
            data=json.dumps({"title": titre, "body": corps}),
            vapid_private_key=settings.VAPID_PRIVATE_KEY,
            vapid_claims={"sub": settings.VAPID_CLAIMS_EMAIL},
        )
        return True
    except WebPushException as e:
        status_code = getattr(e.response, "status_code", None)
        if status_code in (404, 410):
            db.delete(subscription)
            db.commit()
            logger.info(f"Abonnement expiré supprimé (id={subscription.id_subscription})")
        else:
            logger.error(f"Échec envoi push (id={subscription.id_subscription}): {e}")
        return False
