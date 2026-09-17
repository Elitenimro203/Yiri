from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.axe import Axe, StatutConstruction
from app.models.utilisateur import Utilisateur
from app.routers.axes import _get_axe_ou_404
from app.routers.seasons import _get_saison_ou_404
from app.schemas.construction import ConstructionCreate, ConstructionOut, ConstructionUpdate

router = APIRouter(prefix="/constructions", tags=["constructions"])


def _axe_vers_construction(a: Axe) -> ConstructionOut:
    return ConstructionOut(
        id_construction=a.id_axe,
        id_saison=a.id_programme,
        nom=a.nom,
        intention=a.intention,
        statut=StatutConstruction(a.status) if a.status else None,
        ordre_affichage=a.ordre_affichage,
        date_creation=a.date_creation,
    )


# _get_construction_ou_404 : alias explicite de _get_axe_ou_404 (routers/axes.py),
# volontairement PAS une seconde implémentation — Mission 5 §5 interdit deux
# sources de vérité pour la même vérification de propriété. Même fonction,
# même comportement, juste un nom qui parle le vocabulaire Construction ici.
_get_construction_ou_404 = _get_axe_ou_404


@router.get("", response_model=list[ConstructionOut])
def lister_constructions(
    season_id: int | None = Query(default=None),
    current_user: Utilisateur = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Toutes les Constructions de l'utilisateur — qu'elles soient rattachées à
    une Saison (ancienne ou nouvelle) ou totalement libres (§4 : "User →
    Construction hors Saison" doit être valide). Couvre aussi les Axes
    historiques sans id_utilisateur, déduits via leur Programme — un seul
    concept, une seule liste (même principe que GET /bilans, Mission 4).
    """
    requete = (
        db.query(Axe)
        .outerjoin(Axe.programme)
        .filter(
            or_(
                Axe.id_utilisateur == current_user.id_utilisateur,
                and_(Axe.id_utilisateur.is_(None), Axe.programme.has(id_utilisateur=current_user.id_utilisateur)),
            )
        )
    )
    if season_id is not None:
        requete = requete.filter(Axe.id_programme == season_id)
    axes = requete.order_by(Axe.ordre_affichage).all()
    return [_axe_vers_construction(a) for a in axes]


@router.post("", response_model=ConstructionOut, status_code=status.HTTP_201_CREATED)
def creer_construction(
    payload: ConstructionCreate,
    current_user: Utilisateur = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if payload.id_saison is not None:
        _get_saison_ou_404(payload.id_saison, current_user, db)  # 404 si absente ou pas au user

    axe = Axe(
        id_utilisateur=current_user.id_utilisateur,
        id_programme=payload.id_saison,
        nom=payload.nom,
        intention=payload.intention,
        status=StatutConstruction.active.value,
        ordre_affichage=0,
        # phase_deverrouillage/pilier/jours_actifs : laissés NULL — une
        # Construction moderne n'a pas ces notions (§10, §12).
    )
    db.add(axe)
    db.commit()
    db.refresh(axe)
    return _axe_vers_construction(axe)


@router.get("/{construction_id}", response_model=ConstructionOut)
def get_construction(
    construction_id: int,
    current_user: Utilisateur = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return _axe_vers_construction(_get_construction_ou_404(construction_id, current_user, db))


@router.patch("/{construction_id}", response_model=ConstructionOut)
def modifier_construction(
    construction_id: int,
    payload: ConstructionUpdate,
    current_user: Utilisateur = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    axe = _get_construction_ou_404(construction_id, current_user, db)
    donnees = payload.model_dump(exclude_unset=True)
    if "id_saison" in donnees and donnees["id_saison"] is not None:
        _get_saison_ou_404(donnees["id_saison"], current_user, db)
    for champ, valeur in donnees.items():
        setattr(axe, "id_programme" if champ == "id_saison" else champ, valeur)
    db.commit()
    db.refresh(axe)
    return _axe_vers_construction(axe)


def _changer_statut(construction_id: int, nouveau: StatutConstruction, current_user: Utilisateur, db: Session) -> ConstructionOut:
    axe = _get_construction_ou_404(construction_id, current_user, db)
    axe.status = nouveau.value
    db.commit()
    db.refresh(axe)
    return _axe_vers_construction(axe)


@router.post("/{construction_id}/pause", response_model=ConstructionOut)
def mettre_en_pause(construction_id: int, current_user: Utilisateur = Depends(get_current_user), db: Session = Depends(get_db)):
    return _changer_statut(construction_id, StatutConstruction.en_pause, current_user, db)


@router.post("/{construction_id}/reprendre", response_model=ConstructionOut)
def reprendre(construction_id: int, current_user: Utilisateur = Depends(get_current_user), db: Session = Depends(get_db)):
    return _changer_statut(construction_id, StatutConstruction.active, current_user, db)


@router.post("/{construction_id}/terminer", response_model=ConstructionOut)
def terminer(construction_id: int, current_user: Utilisateur = Depends(get_current_user), db: Session = Depends(get_db)):
    return _changer_statut(construction_id, StatutConstruction.terminee, current_user, db)


@router.post("/{construction_id}/abandonner", response_model=ConstructionOut)
def abandonner(construction_id: int, current_user: Utilisateur = Depends(get_current_user), db: Session = Depends(get_db)):
    return _changer_statut(construction_id, StatutConstruction.abandonnee, current_user, db)
