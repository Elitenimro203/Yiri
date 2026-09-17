from datetime import date

from app.models.axe import Axe
from app.models.programme import Programme, ModeProgression, ModeDeverrouillage

NB_SEMAINES_MAX = 4  # borne du plan de montée en charge (voir programme-semaine-kouadio.md)


def semaine_effective(programme: Programme, aujourd_hui: date | None = None) -> int:
    """
    Renvoie la semaine à utiliser pour les calculs de déverrouillage (RG-04),
    selon le mode configuré sur le programme (RG-08).

    - mode = manuel : on fait confiance à `semaine_courante`, l'utilisateur la contrôle
      lui-même via POST /programmes/{id}/semaine-suivante.
    - mode = auto : on la RECALCULE à partir de date_debut, sans jamais écrire en base —
      la colonne semaine_courante sert alors juste de dernière valeur connue, utile si
      l'utilisateur repasse en mode manuel plus tard sans perdre son historique.
    """
    if programme.mode_progression == ModeProgression.manuel:
        return programme.semaine_courante

    aujourd_hui = aujourd_hui or date.today()
    jours_ecoules = (aujourd_hui - programme.date_debut).days
    semaine = (jours_ecoules // 7) + 1
    # On ne dépasse jamais NB_SEMAINES_MAX même si le calcul par date irait plus loin —
    # sinon un programme "oublié" en mode auto débloquerait des semaines qui n'existent pas.
    return max(1, min(semaine, NB_SEMAINES_MAX))


def jours_actifs_iso(axe: Axe) -> set[int]:
    """Renvoie l'ensemble des jours ISO (1=lundi..7=dimanche) où l'axe fait
    partie du rituel du jour. None/vide = tous les jours (RG-11)."""
    if not axe.jours_actifs:
        return {1, 2, 3, 4, 5, 6, 7}
    return {int(j.strip()) for j in axe.jours_actifs.split(',')}


def nb_jours_actifs(axe: Axe) -> int:
    return len(jours_actifs_iso(axe))


def axe_est_deverrouille(programme: Programme | None, axe: Axe, semaine: int | None = None) -> bool:
    """
    SEUL point de décision pour RG-04 (verrouillage par phase) + RG-09 (mode de
    déverrouillage). axes.py ET suivi.py appellent cette fonction — jamais de
    logique de verrouillage dupliquée ailleurs, sinon les deux endroits peuvent
    un jour diverger silencieusement.

    Mission 5 : une Construction moderne (créée via POST /constructions) peut
    avoir `phase_deverrouillage = None` — elle n'a jamais eu cette notion et
    ne doit pas en hériter artificiellement (§12). Si elle apparaît malgré
    tout dans une liste legacy (/programmes/{id}/axes, parce qu'elle est
    rattachée à une Saison), NULL est traité comme "toujours déverrouillé",
    jamais comme une comparaison numérique qui planterait (None n'est pas
    comparable à un entier en Python).

    Mission 5 (suite) : une Construction peut aussi exister sans Saison du
    tout (`axe.programme is None`, §4). Le verrouillage n'a alors
    structurellement aucun sens (il n'y a ni semaine_courante ni mode à lire)
    — traité comme "toujours déverrouillé", jamais comme un crash sur un
    Programme absent. Sans ce garde, toggle_case (routers/suivi.py) et
    demarrer_session (routers/session_travail.py) plantaient (AttributeError)
    dès qu'on les appelait sur une Construction sans Saison — bug réel
    corrigé ici, à la source, plutôt qu'un correctif dupliqué à chaque appelant.
    """
    if programme is None:
        return True
    if programme.mode_deverrouillage == ModeDeverrouillage.complet:
        return True
    if axe.phase_deverrouillage is None:
        return True
    semaine = semaine if semaine is not None else semaine_effective(programme)
    return semaine >= axe.phase_deverrouillage
