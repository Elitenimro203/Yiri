from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.programme import Programme, StatutProgramme
from app.models.utilisateur import Utilisateur
from app.schemas.saison import SaisonCreate, SaisonOut, SaisonUpdate

router = APIRouter(prefix="/seasons", tags=["seasons"])


def _programme_vers_saison(p: Programme) -> SaisonOut:
    """
    Mapping explicite plutôt que `from_attributes` automatique : les noms de
    champs divergent délibérément (id_saison vs id_programme — voir
    schemas/saison.py) et les champs Wakati (semaine_courante, etc.) ne
    doivent jamais fuiter dans cette sortie.
    """
    return SaisonOut(
        id_saison=p.id_programme,
        nom=p.nom,
        intention=p.intention,
        date_debut=p.date_debut,
        date_fin=p.date_fin,
        statut=p.statut,
    )


def _get_saison_ou_404(saison_id: int, current_user: Utilisateur, db: Session) -> Programme:
    """Même principe anti-IDOR que _get_programme_ou_404 (routers/programmes.py, inchangé) —
    même table, donc même filtre, exposé ici sous le nom Saison pour ce nouveau router."""
    p = (
        db.query(Programme)
        .filter(Programme.id_programme == saison_id, Programme.id_utilisateur == current_user.id_utilisateur)
        .first()
    )
    if p is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Saison introuvable")
    return p


@router.get("", response_model=list[SaisonOut])
def lister_saisons(
    current_user: Utilisateur = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    programmes = db.query(Programme).filter(Programme.id_utilisateur == current_user.id_utilisateur).all()
    return [_programme_vers_saison(p) for p in programmes]


@router.get("/active", response_model=SaisonOut)
def saison_active(
    current_user: Utilisateur = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    p = (
        db.query(Programme)
        .filter(Programme.id_utilisateur == current_user.id_utilisateur, Programme.statut == StatutProgramme.actif)
        .first()
    )
    if p is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Aucune Saison active")
    return _programme_vers_saison(p)


@router.post("", response_model=SaisonOut, status_code=status.HTTP_201_CREATED)
def creer_saison(
    payload: SaisonCreate,
    current_user: Utilisateur = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Mission 5 §3 : "un utilisateur peut avoir au maximum une Saison
    principale active" — appliqué ici, au moment de la création (toute
    nouvelle Saison démarre active, comme un Programme historique).
    Volontairement PAS appliqué rétroactivement aux données existantes :
    aucune ligne historique n'est modifiée ou rejetée à la lecture, seule la
    création d'un DEUXIÈME actif est refusée (voir rapport final, §11 —
    décision provisoire, pas une contrainte en base).
    """
    deja_active = (
        db.query(Programme)
        .filter(Programme.id_utilisateur == current_user.id_utilisateur, Programme.statut == StatutProgramme.actif)
        .first()
    )
    if deja_active is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Une Saison est déjà active ({deja_active.nom}) — termine-la ou archive-la avant d'en commencer une nouvelle.",
        )

    programme = Programme(
        id_utilisateur=current_user.id_utilisateur,
        nom=payload.nom,
        intention=payload.intention,
        date_debut=payload.date_debut,
        date_fin=payload.date_fin,
    )
    db.add(programme)
    db.commit()
    db.refresh(programme)
    return _programme_vers_saison(programme)


@router.get("/{saison_id}", response_model=SaisonOut)
def get_saison(
    saison_id: int,
    current_user: Utilisateur = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return _programme_vers_saison(_get_saison_ou_404(saison_id, current_user, db))


@router.patch("/{saison_id}", response_model=SaisonOut)
def modifier_saison(
    saison_id: int,
    payload: SaisonUpdate,
    current_user: Utilisateur = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    programme = _get_saison_ou_404(saison_id, current_user, db)
    for champ, valeur in payload.model_dump(exclude_unset=True).items():
        setattr(programme, champ, valeur)
    db.commit()
    db.refresh(programme)
    return _programme_vers_saison(programme)


@router.post("/{saison_id}/terminer", response_model=SaisonOut)
def terminer_saison(
    saison_id: int,
    current_user: Utilisateur = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    programme = _get_saison_ou_404(saison_id, current_user, db)
    programme.statut = StatutProgramme.termine
    db.commit()
    db.refresh(programme)
    return _programme_vers_saison(programme)


@router.post("/{saison_id}/archiver", response_model=SaisonOut)
def archiver_saison(
    saison_id: int,
    current_user: Utilisateur = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    programme = _get_saison_ou_404(saison_id, current_user, db)
    programme.statut = StatutProgramme.archive
    db.commit()
    db.refresh(programme)
    return _programme_vers_saison(programme)
