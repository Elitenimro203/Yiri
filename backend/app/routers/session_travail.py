from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.logique_programme import axe_est_deverrouille
from app.models.axe import Axe
from app.models.session_travail import SessionTravail
from app.models.utilisateur import Utilisateur
from app.routers.axes import _get_axe_ou_404
from app.schemas.session_travail import SessionCreate, SessionOut, TempsParAxe

router = APIRouter(tags=["sessions"])

DUREE_FOCUS_DEFAUT = 25
DUREE_PAUSE_DEFAUT = 5


@router.get("/sessions/active", response_model=SessionOut | None)
def session_active(
    current_user: Utilisateur = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Renvoie la session en cours (date_fin NULL) s'il y en a une, sinon null.
    Indispensable pour que le frontend retrouve un chrono en cours après un
    rafraîchissement de page — sans ça, l'état du timer serait perdu.
    """
    return (
        db.query(SessionTravail)
        .filter(SessionTravail.id_utilisateur == current_user.id_utilisateur, SessionTravail.date_fin.is_(None))
        .first()
    )


@router.post("/axes/{axe_id}/sessions/demarrer", response_model=SessionOut, status_code=status.HTTP_201_CREATED)
def demarrer_session(
    axe_id: int,
    payload: SessionCreate,
    current_user: Utilisateur = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    axe = _get_axe_ou_404(axe_id, current_user, db)

    # RG-04, même logique que pour cocher une case : pas de temps productif
    # comptabilisé sur un axe qui n'est pas encore censé être travaillé.
    if not axe_est_deverrouille(axe.programme, axe):
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail=f"Cet axe se débloque en semaine {axe.phase_deverrouillage}",
        )

    # RG-14 : une seule session active à la fois par utilisateur — décision
    # volontaire pour rester simple et lisible, réévaluable plus tard si un
    # vrai besoin de sessions parallèles apparaît chez les utilisateurs.
    deja_active = (
        db.query(SessionTravail)
        .filter(SessionTravail.id_utilisateur == current_user.id_utilisateur, SessionTravail.date_fin.is_(None))
        .first()
    )
    if deja_active is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Une session est déjà active sur l'axe {deja_active.id_axe} — termine-la d'abord",
        )

    session = SessionTravail(
        id_utilisateur=current_user.id_utilisateur,
        id_axe=axe_id,
        type=payload.type,
        duree_focus_minutes=payload.duree_focus_minutes or (DUREE_FOCUS_DEFAUT if payload.type == "pomodoro" else None),
        duree_pause_minutes=payload.duree_pause_minutes or (DUREE_PAUSE_DEFAUT if payload.type == "pomodoro" else None),
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


@router.post("/sessions/{session_id}/terminer", response_model=SessionOut)
def terminer_session(
    session_id: int,
    current_user: Utilisateur = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    session = (
        db.query(SessionTravail)
        .filter(SessionTravail.id_session == session_id, SessionTravail.id_utilisateur == current_user.id_utilisateur)
        .first()
    )
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session introuvable")
    if session.date_fin is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Cette session est déjà terminée")

    maintenant = datetime.now(timezone.utc)
    session.date_fin = maintenant
    # date_debut est stockée sans tzinfo (naive) par SQLAlchemy/SQLite —
    # on neutralise le décalage pour un calcul de durée fiable sur les deux
    # moteurs (SQLite en dev, Postgres en prod, qui gère les tz différemment).
    debut = session.date_debut if session.date_debut.tzinfo else session.date_debut.replace(tzinfo=timezone.utc)
    session.duree_secondes = max(0, int((maintenant - debut).total_seconds()))
    db.commit()
    db.refresh(session)
    return session


@router.get("/axes/{axe_id}/sessions", response_model=list[SessionOut])
def lister_sessions_axe(
    axe_id: int,
    current_user: Utilisateur = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _get_axe_ou_404(axe_id, current_user, db)  # vérifie la propriété
    return (
        db.query(SessionTravail)
        .filter(SessionTravail.id_axe == axe_id)
        .order_by(SessionTravail.date_debut.desc())
        .all()
    )


@router.get("/programmes/{programme_id}/temps-par-axe", response_model=list[TempsParAxe])
def temps_par_axe(
    programme_id: int,
    current_user: Utilisateur = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Agrège le temps total loggé (sessions terminées uniquement) par axe, pour
    tout le programme — sert de base à un futur affichage "productivité" sans
    recalcul côté frontend.
    """
    from app.routers.programmes import _get_programme_ou_404

    _get_programme_ou_404(programme_id, current_user, db)

    resultats = (
        db.query(
            Axe.id_axe,
            Axe.nom,
            func.coalesce(func.sum(SessionTravail.duree_secondes), 0).label("duree_totale"),
            func.count(SessionTravail.id_session).label("nb_sessions"),
        )
        .outerjoin(
            SessionTravail,
            (SessionTravail.id_axe == Axe.id_axe) & (SessionTravail.duree_secondes.isnot(None)),
        )
        .filter(Axe.id_programme == programme_id)
        .group_by(Axe.id_axe, Axe.nom)
        .all()
    )

    return [
        TempsParAxe(id_axe=r.id_axe, nom_axe=r.nom, duree_totale_secondes=r.duree_totale, nb_sessions=r.nb_sessions)
        for r in resultats
    ]
