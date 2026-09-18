from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.entree_suivi import EntreeSuivi
from app.models.observation import Observation
from app.models.utilisateur import Utilisateur
from app.routers.axes import _get_axe_ou_404
from app.schemas.observation import ObservationCreate, ObservationOut, ObservationUpdate

router = APIRouter(prefix="/observations", tags=["observations"])


def _get_entree_ou_404(entree_id: int, current_user: Utilisateur, db: Session) -> EntreeSuivi:
    """
    Anti-IDOR — réutilise _get_axe_ou_404 (routers/axes.py), même principe
    que _get_action_ou_404 (routers/actions.py, Mission 6) : on récupère
    d'abord la ligne, puis on vérifie la propriété de son Axe via l'unique
    implémentation correcte, plutôt que de re-dériver la condition
    "id_utilisateur direct OU via Programme" une quatrième fois ici.

    Mission 7 §1 — bug corrigé : l'ancienne version ne vérifiait la
    propriété que via `Axe.programme.has(id_utilisateur=...)`, ce qui
    excluait à tort le chemin Construction sans Saison → Action →
    Observation (même bug que celui déjà corrigé sur _get_engagement_ou_404
    et creer_notification en Mission 6, jamais appliqué ici par oubli).
    """
    entree = db.query(EntreeSuivi).filter(EntreeSuivi.id_entree == entree_id).first()
    if entree is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Action (EntreeSuivi) introuvable")
    _get_axe_ou_404(entree.id_axe, current_user, db)  # lève 404 si l'axe n'appartient pas à current_user
    return entree


def _valider_associations(
    id_axe: int | None,
    id_entree: int | None,
    current_user: Utilisateur,
    db: Session,
) -> None:
    """
    Vérifie la propriété de chaque association fournie (jamais de confiance
    aveugle envers un ID client, Mission 3 §5), puis leur cohérence mutuelle :
    si les deux sont fournis, l'EntreeSuivi doit appartenir à l'Axe indiqué.
    En cas d'incohérence, on refuse explicitement plutôt que de déduire
    silencieusement l'un depuis l'autre (préférence explicite de la mission).
    """
    entree = None
    if id_axe is not None:
        _get_axe_ou_404(id_axe, current_user, db)  # 404 si absent ou pas au user
    if id_entree is not None:
        entree = _get_entree_ou_404(id_entree, current_user, db)
    if id_axe is not None and entree is not None and entree.id_axe != id_axe:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cette Action n'appartient pas à la Construction indiquée",
        )


@router.post("", response_model=ObservationOut, status_code=status.HTTP_201_CREATED)
def creer_observation(
    payload: ObservationCreate,
    current_user: Utilisateur = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _valider_associations(payload.id_axe, payload.id_entree, current_user, db)

    observation = Observation(
        id_utilisateur=current_user.id_utilisateur,
        id_axe=payload.id_axe,
        id_entree=payload.id_entree,
        contenu=payload.contenu,
        # date_creation : jamais fournie par le client (voir schemas/observation.py),
        # calculée côté serveur par le default du modèle.
    )
    db.add(observation)
    db.commit()
    db.refresh(observation)
    return observation


@router.get("", response_model=list[ObservationOut])
def lister_observations(
    axe_id: int | None = Query(default=None),
    depuis: date | None = Query(default=None, description="Filtre : observations créées à partir de cette date"),
    current_user: Utilisateur = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    requete = db.query(Observation).filter(Observation.id_utilisateur == current_user.id_utilisateur)
    if axe_id is not None:
        requete = requete.filter(Observation.id_axe == axe_id)
    if depuis is not None:
        requete = requete.filter(Observation.date_creation >= depuis)
    return requete.order_by(Observation.date_creation.desc()).all()


def _get_observation_ou_404(observation_id: int, current_user: Utilisateur, db: Session) -> Observation:
    observation = (
        db.query(Observation)
        .filter(
            Observation.id_observation == observation_id,
            Observation.id_utilisateur == current_user.id_utilisateur,
        )
        .first()
    )
    if observation is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Observation introuvable")
    return observation


@router.get("/{observation_id}", response_model=ObservationOut)
def get_observation(
    observation_id: int,
    current_user: Utilisateur = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return _get_observation_ou_404(observation_id, current_user, db)


@router.patch("/{observation_id}", response_model=ObservationOut)
def modifier_observation(
    observation_id: int,
    payload: ObservationUpdate,
    current_user: Utilisateur = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    observation = _get_observation_ou_404(observation_id, current_user, db)
    donnees = payload.model_dump(exclude_unset=True)

    nouvel_id_axe = donnees["id_axe"] if "id_axe" in donnees else observation.id_axe
    nouvel_id_entree = donnees["id_entree"] if "id_entree" in donnees else observation.id_entree
    _valider_associations(nouvel_id_axe, nouvel_id_entree, current_user, db)

    for champ, valeur in donnees.items():
        setattr(observation, champ, valeur)
    db.commit()
    db.refresh(observation)
    return observation


@router.delete("/{observation_id}", status_code=status.HTTP_204_NO_CONTENT)
def supprimer_observation(
    observation_id: int,
    current_user: Utilisateur = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    observation = _get_observation_ou_404(observation_id, current_user, db)
    db.delete(observation)
    db.commit()
