import logging
from datetime import datetime

from apscheduler.schedulers.background import BackgroundScheduler

from app.core.database import SessionLocal
from app.core.notifications_timing import notification_doit_partir
from app.core.push_service import envoyer_push
from app.models.notification import Notification
from app.models.push_subscription import PushSubscription

logger = logging.getLogger(__name__)


def _libelle_notification(notif: Notification) -> tuple[str, str]:
    """(titre, corps) du message envoyé — dépend de si le rappel est lié à un axe ou global."""
    if notif.axe is not None:
        return ("L'homme complet", f"{notif.libelle} — {notif.axe.nom}")
    return ("L'homme complet", notif.libelle)


def verifier_et_envoyer_rappels():
    """
    Appelée chaque minute. Session DB dédiée (pas celle des requêtes HTTP) car
    ce job tourne hors contexte de requête, dans le thread du scheduler.
    """
    db = SessionLocal()
    try:
        maintenant = datetime.now()
        notifs = db.query(Notification).filter(Notification.actif.is_(True)).all()

        for notif in notifs:
            if not notification_doit_partir(notif, maintenant):
                continue

            titre, corps = _libelle_notification(notif)
            subs = (
                db.query(PushSubscription)
                .filter(PushSubscription.id_utilisateur == notif.id_utilisateur)
                .all()
            )
            for sub in subs:
                envoyer_push(db, sub, titre, corps)
    finally:
        db.close()


_scheduler: BackgroundScheduler | None = None


def demarrer_scheduler():
    global _scheduler
    if _scheduler is not None:
        return
    _scheduler = BackgroundScheduler()
    _scheduler.add_job(verifier_et_envoyer_rappels, "interval", minutes=1, id="rappels")
    _scheduler.start()
    logger.info("Planificateur de rappels démarré (vérification chaque minute)")


def arreter_scheduler():
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None
