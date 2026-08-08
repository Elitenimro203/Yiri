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


def axe_est_deverrouille(programme: Programme, axe: Axe, semaine: int | None = None) -> bool:
    """
    SEUL point de décision pour RG-04 (verrouillage par phase) + RG-09 (mode de
    déverrouillage). axes.py ET suivi.py appellent cette fonction — jamais de
    logique de verrouillage dupliquée ailleurs, sinon les deux endroits peuvent
    un jour diverger silencieusement.
    """
    if programme.mode_deverrouillage == ModeDeverrouillage.complet:
        return True
    semaine = semaine if semaine is not None else semaine_effective(programme)
    return semaine >= axe.phase_deverrouillage
