from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import and_, or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.logique_programme import axe_est_deverrouille, nb_jours_actifs
from app.models.axe import Axe
from app.models.bilan import Bilan
from app.models.entree_suivi import EntreeSuivi
from app.models.programme import Programme
from app.models.utilisateur import Utilisateur
from app.routers.axes import _get_axe_ou_404
from app.routers.programmes import _get_programme_ou_404
from app.schemas.bilan import BilanCreate, BilanOut, ReflexionCreate

router = APIRouter(tags=["bilans"])


def _score_semaine(db: Session, programme: Programme, semaine: int) -> int:
    """
    Score global de la semaine — même logique que l'agrégation par pilier
    (RG-10), mais toutes dimensions confondues. Recalculé à la volée à partir
    des vraies entrées, jamais stocké ailleurs qu'en snapshot dans le bilan lui-même.
    """
    axes = db.query(Axe).filter(Axe.id_programme == programme.id_programme).all()
    axes_deverrouilles = [a for a in axes if axe_est_deverrouille(programme, a, semaine)]
    if not axes_deverrouilles:
        return 0

    possibles = sum(nb_jours_actifs(a) for a in axes_deverrouilles)
    ids_axes = [a.id_axe for a in axes_deverrouilles]
    cochees = (
        db.query(EntreeSuivi)
        .filter(EntreeSuivi.id_axe.in_(ids_axes), EntreeSuivi.semaine == semaine, EntreeSuivi.coche.is_(True))
        .count()
    )
    return round(100 * cochees / possibles) if possibles else 0


def _get_bilan_ou_404(bilan_id: int, current_user: Utilisateur, db: Session) -> Bilan:
    """
    Anti-IDOR pour un Bilan/Réflexion pris individuellement (Mission 4 §17).

    Deux façons de posséder un Bilan, selon son âge :
    - id_utilisateur renseigné (toute nouvelle ligne, hebdomadaire ou libre)
      → comparaison directe ;
    - id_utilisateur absent (ligne historique d'avant Mission 4, jamais
      rétro-remplie — voir §5) → propriété déduite via
      Bilan → Programme → Utilisateur, comme le code legacy le faisait déjà
      implicitement via _get_programme_ou_404.

    Un Bilan sans id_utilisateur ET sans programme (ne devrait jamais arriver
    pour une ligne créée après Mission 4, les deux routes de création en
    garantissent au moins un) est traité comme n'appartenant à personne —
    refus par défaut, jamais un accès accordé par erreur.
    """
    bilan = db.query(Bilan).filter(Bilan.id_bilan == bilan_id).first()
    if bilan is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bilan introuvable")

    est_proprietaire = False
    if bilan.id_utilisateur is not None:
        est_proprietaire = bilan.id_utilisateur == current_user.id_utilisateur
    elif bilan.programme is not None:
        est_proprietaire = bilan.programme.id_utilisateur == current_user.id_utilisateur

    if not est_proprietaire:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bilan introuvable")
    return bilan


@router.get("/programmes/{programme_id}/bilans", response_model=list[BilanOut])
def lister_bilans(
    programme_id: int,
    current_user: Utilisateur = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _get_programme_ou_404(programme_id, current_user, db)
    return (
        db.query(Bilan)
        .filter(Bilan.id_programme == programme_id)
        .order_by(Bilan.semaine)
        .all()
    )


@router.get("/programmes/{programme_id}/bilans/{semaine}", response_model=BilanOut)
def get_bilan(
    programme_id: int,
    semaine: int,
    current_user: Utilisateur = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _get_programme_ou_404(programme_id, current_user, db)
    bilan = (
        db.query(Bilan)
        .filter(Bilan.id_programme == programme_id, Bilan.semaine == semaine)
        .first()
    )
    if bilan is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Aucun bilan pour cette semaine")
    return bilan


@router.post("/programmes/{programme_id}/bilans", response_model=BilanOut, status_code=status.HTTP_201_CREATED)
def creer_bilan(
    programme_id: int,
    payload: BilanCreate,
    current_user: Utilisateur = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Flux hebdomadaire historique — inchangé depuis Mission 1.5b (aucun effet
    d'avancement automatique). Mission 4 : accepte en plus les champs
    optionnels du nouveau vocabulaire de Réflexion (remarque, comprehension,
    type_decision, id_axe), pour permettre d'enrichir un Bilan de semaine
    classique sans forcer à passer par le nouveau flux libre.
    """
    programme = _get_programme_ou_404(programme_id, current_user, db)

    if payload.semaine > programme.semaine_courante:
        # On ne clôture pas une semaine qui n'a pas encore commencé.
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Impossible de clôturer la semaine {payload.semaine} : le programme en est à la semaine {programme.semaine_courante}",
        )

    if payload.id_axe is not None:
        _get_axe_ou_404(payload.id_axe, current_user, db)  # 404 si absent ou pas au user

    score = _score_semaine(db, programme, payload.semaine)

    bilan = Bilan(
        id_programme=programme_id,
        id_utilisateur=current_user.id_utilisateur,
        id_axe=payload.id_axe,
        semaine=payload.semaine,
        score_snapshot=score,
        quoi_a_marche=payload.quoi_a_marche,
        quoi_n_a_pas_marche=payload.quoi_n_a_pas_marche,
        ajustement_semaine_suivante=payload.ajustement_semaine_suivante,
        remarque=payload.remarque,
        comprehension=payload.comprehension,
        decision=payload.decision,
        type_decision=payload.type_decision,
    )
    db.add(bilan)
    try:
        db.commit()
    except IntegrityError:
        # RG-12 : un seul bilan par (programme, semaine) — même pattern anti-race
        # condition que RG-01 (email unique) : on intercepte la contrainte DB
        # plutôt qu'un SELECT préalable.
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Un bilan existe déjà pour la semaine {payload.semaine}",
        )
    db.refresh(bilan)

    # Mission 1.5b : la décision enregistrée dans un Bilan (consolider/avancer)
    # est désormais purement réflexive/descriptive — elle ne déclenche plus
    # aucune mutation de programme.semaine_courante. L'avancement réel reste
    # possible exclusivement via l'action explicite POST
    # /programmes/{id}/semaine-suivante (voir routers/programmes.py).
    return bilan


@router.post("/bilans", response_model=BilanOut, status_code=status.HTTP_201_CREATED)
def creer_reflexion(
    payload: ReflexionCreate,
    current_user: Utilisateur = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Flux moderne — Mission 4 (§14, "Réflexion libre") : ni Programme ni
    semaine ne sont requis. Rejoint la même table et la même contrainte
    d'unicité (id_programme, semaine) que l'ancien flux si les deux sont
    fournis — un seul concept, pas un système parallèle (§20).

    Comme pour tout le reste de l'API, aucun ID fourni par le client n'est
    utilisé sans vérifier la propriété : id_programme et id_axe sont
    revérifiés ici, jamais supposés valides.
    """
    programme = None
    if payload.id_programme is not None:
        programme = _get_programme_ou_404(payload.id_programme, current_user, db)
    if payload.id_axe is not None:
        _get_axe_ou_404(payload.id_axe, current_user, db)

    # Score : uniquement calculable s'il y a un vrai Programme + semaine à
    # regarder (§10 — pas de nouveau score inventé pour le flux libre).
    score = _score_semaine(db, programme, payload.semaine) if (programme and payload.semaine) else None

    bilan = Bilan(
        id_programme=payload.id_programme,
        id_utilisateur=current_user.id_utilisateur,
        id_axe=payload.id_axe,
        semaine=payload.semaine,
        score_snapshot=score,
        ajustement_semaine_suivante=payload.ajustement_semaine_suivante,
        remarque=payload.remarque,
        comprehension=payload.comprehension,
        type_decision=payload.type_decision,
    )
    db.add(bilan)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Une Réflexion existe déjà pour ce Programme et cette semaine",
        )
    db.refresh(bilan)
    return bilan


def _tous_bilans_utilisateur(current_user: Utilisateur, db: Session):
    """
    Requête de base (sans tri), réutilisée par lister_mes_reflexions ET par
    la Trajectoire (routers/trajectory.py, Mission 7) — même principe que
    _toutes_actions_utilisateur (routers/actions.py) : une seule
    implémentation de la condition de propriété.
    """
    return (
        db.query(Bilan)
        .outerjoin(Bilan.programme)
        .filter(
            or_(
                Bilan.id_utilisateur == current_user.id_utilisateur,
                and_(Bilan.id_utilisateur.is_(None), Programme.id_utilisateur == current_user.id_utilisateur),
            )
        )
    )


@router.get("/bilans", response_model=list[BilanOut])
def lister_mes_reflexions(
    current_user: Utilisateur = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Toutes les Réflexions/Bilans de l'utilisateur courant, qu'elles soient
    rattachées à un Programme (ancien flux ou nouveau flux enrichi) ou
    totalement libres — un seul concept, une seule liste (§20). Couvre aussi
    les Bilans historiques sans id_utilisateur, déduits via leur Programme.
    """
    return _tous_bilans_utilisateur(current_user, db).order_by(Bilan.date_creation.desc()).all()


@router.get("/bilans/{bilan_id}", response_model=BilanOut)
def get_reflexion(
    bilan_id: int,
    current_user: Utilisateur = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return _get_bilan_ou_404(bilan_id, current_user, db)
