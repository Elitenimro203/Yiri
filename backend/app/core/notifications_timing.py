from datetime import datetime, time as time_cls

from app.models.notification import Notification


def notification_doit_partir(notif: Notification, maintenant: datetime) -> bool:
    """
    Pure et testable sans DB ni réseau : est-ce que CE rappel doit se déclencher
    à CET instant précis ? Séparée de l'envoi (qui a des effets de bord et des
    dépendances externes) pour qu'on puisse tester la logique de timing seule,
    sans avoir à simuler un vrai navigateur abonné au push.
    """
    if not notif.actif:
        return False

    jour_iso = maintenant.isoweekday()  # 1=lundi..7=dimanche, même convention que jours_actifs
    jours = {int(j.strip()) for j in notif.jours_actifs.split(',')}
    if jour_iso not in jours:
        return False

    # On compare heure+minute seulement — la comparaison exacte à la seconde
    # near serait irréaliste vu que le planificateur tourne à intervalle
    # (typiquement chaque minute), pas en continu.
    return maintenant.hour == notif.heure.hour and maintenant.minute == notif.heure.minute
