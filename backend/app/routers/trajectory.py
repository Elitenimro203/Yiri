from datetime import date as date_type, datetime, time

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.observation import Observation
from app.models.programme import Programme
from app.models.utilisateur import Utilisateur
from app.routers.actions import _toutes_actions_utilisateur
from app.routers.bilans import _tous_bilans_utilisateur
from app.routers.constructions import _toutes_constructions_utilisateur
from app.schemas.trajectory import ConstructionContext, SeasonContext, TrajectoryEvent, TrajectoryPage

router = APIRouter(prefix="/trajectory", tags=["trajectory"])

# Tri secondaire, stable, en cas d'égalité de date (§11) — un ordre
# arbitraire mais déterministe, qui ne prétend JAMAIS qu'un événement a causé
# un autre. Ne sert qu'à éviter un ordre différent à chaque appel quand deux
# événements partagent exactement la même date.
_PRIORITE_TYPE = {
    "decision": 0,
    "reflection": 1,
    "observation": 2,
    "action": 3,
    "construction_created": 4,
    "season_ended": 5,
    "season_started": 6,
}


def _contexte_saison(axe) -> SeasonContext | None:
    if axe is not None and axe.id_programme is not None and axe.programme is not None:
        return SeasonContext(id_saison=axe.programme.id_programme, nom=axe.programme.nom)
    return None


def _construire_evenements(current_user: Utilisateur, db: Session) -> list[TrajectoryEvent]:
    """
    Assemble la Trajectoire complète de l'utilisateur à partir des sources
    existantes — Saison/Construction/Action/Observation/Bilan — sans créer
    ni persister la moindre nouvelle donnée (§3). Chaque sous-section
    réutilise la requête de propriété déjà éprouvée de son router d'origine
    (_toutes_actions_utilisateur, _tous_bilans_utilisateur,
    _toutes_constructions_utilisateur) : aucune condition d'anti-IDOR n'est
    re-dérivée ici.
    """
    evenements: list[TrajectoryEvent] = []

    # --- Saisons (§5, §8) --------------------------------------------------
    programmes = db.query(Programme).filter(Programme.id_utilisateur == current_user.id_utilisateur).all()
    for p in programmes:
        saison_ctx = SeasonContext(id_saison=p.id_programme, nom=p.nom)
        evenements.append(TrajectoryEvent(
            type="season_started",
            date=datetime.combine(p.date_debut, time.min),
            source_type="programme", source_id=p.id_programme,
            title=f"Saison commencée : {p.nom}", content=p.intention,
            season=saison_ctx, construction=None,
        ))
        if p.date_fin is not None:  # jamais déduit, uniquement si explicitement renseigné (§5/§2)
            evenements.append(TrajectoryEvent(
                type="season_ended",
                date=datetime.combine(p.date_fin, time.min),
                source_type="programme", source_id=p.id_programme,
                title=f"Saison terminée : {p.nom}", content=None,
                season=saison_ctx, construction=None,
            ))

    # --- Constructions (§5, §8) --------------------------------------------
    # Pas d'événement de changement de statut : aucune date historique de
    # transition n'existe dans le modèle actuel (§2/§17 — pas d'historisation
    # ajoutée dans cette mission), donc catégorie conditionnelle non
    # produite pour l'instant plutôt que datée artificiellement.
    axes = _toutes_constructions_utilisateur(current_user, db).all()
    for a in axes:
        if a.date_creation is None:  # Axe historique Wakati : pas de date réelle connue
            continue
        evenements.append(TrajectoryEvent(
            type="construction_created",
            date=a.date_creation,
            source_type="axe", source_id=a.id_axe,
            title=f"Construction créée : {a.nom}", content=a.intention,
            season=_contexte_saison(a), construction=ConstructionContext(id_construction=a.id_axe, nom=a.nom),
        ))

    # --- Actions (§5, §8) ---------------------------------------------------
    entrees = _toutes_actions_utilisateur(current_user, db).all()
    for e in entrees:
        date_effective = e.date_action or e.date_coche  # fallback historique uniquement (§5)
        if date_effective is None:
            continue
        axe = e.axe
        evenements.append(TrajectoryEvent(
            type="action",
            date=date_effective,
            source_type="entree_suivi", source_id=e.id_entree,
            title=f"Action : {axe.nom}", content=e.contenu,
            season=_contexte_saison(axe), construction=ConstructionContext(id_construction=axe.id_axe, nom=axe.nom),
        ))

    # --- Observations (§5, §8) ----------------------------------------------
    observations = db.query(Observation).filter(Observation.id_utilisateur == current_user.id_utilisateur).all()
    for o in observations:
        # Contexte réel le plus précis disponible : l'Axe explicite si fourni,
        # sinon celui de l'Action associée — jamais inventé (§8).
        axe = None
        if o.id_axe is not None:
            axe = o.axe
        elif o.id_entree is not None and o.entree is not None:
            axe = o.entree.axe
        construction_ctx = ConstructionContext(id_construction=axe.id_axe, nom=axe.nom) if axe is not None else None
        evenements.append(TrajectoryEvent(
            type="observation",
            date=o.date_creation,
            source_type="observation", source_id=o.id_observation,
            title="Observation" if construction_ctx is None else f"Observation : {construction_ctx.nom}",
            content=o.contenu,
            season=_contexte_saison(axe), construction=construction_ctx,
        ))

    # --- Bilans -> reflection / decision (§6, §7) ---------------------------
    bilans = _tous_bilans_utilisateur(current_user, db).all()
    for b in bilans:
        axe = b.axe if b.id_axe is not None else None
        construction_ctx = ConstructionContext(id_construction=axe.id_axe, nom=axe.nom) if axe is not None else None
        saison_ctx = SeasonContext(id_saison=b.programme.id_programme, nom=b.programme.nom) if b.id_programme is not None and b.programme is not None else None

        # §7 : un ancien Bilan (score/semaine/decision legacy consolider ou
        # avancer, sans remarque/comprehension/type_decision) ne produit
        # AUCUN événement moderne — il n'apparaît simplement pas ici, sans
        # que ses données ne soient transformées ou réinterprétées.
        if b.remarque is not None or b.comprehension is not None:
            contenu = "\n\n".join(p for p in (b.remarque, b.comprehension) if p)
            evenements.append(TrajectoryEvent(
                type="reflection",
                date=b.date_creation,
                source_type="bilan", source_id=b.id_bilan,
                title="Réflexion" if construction_ctx is None else f"Réflexion : {construction_ctx.nom}",
                content=contenu,
                season=saison_ctx, construction=construction_ctx,
            ))
        if b.type_decision is not None:
            # Même date que la Reflection ci-dessus si elles proviennent du
            # même Bilan — jamais de lien causal affirmé entre les deux (§6).
            evenements.append(TrajectoryEvent(
                type="decision",
                date=b.date_creation,
                source_type="bilan", source_id=b.id_bilan,
                title="Décision" if construction_ctx is None else f"Décision : {construction_ctx.nom}",
                content=b.type_decision,
                season=saison_ctx, construction=construction_ctx,
            ))

    return evenements


@router.get("", response_model=TrajectoryPage)
def get_trajectory(
    season_id: int | None = Query(default=None),
    construction_id: int | None = Query(default=None),
    date_from: date_type | None = Query(default=None, alias="from"),
    date_to: date_type | None = Query(default=None, alias="to"),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    current_user: Utilisateur = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Lecture seule — aucune donnée n'est créée, modifiée ou déduite ici au-delà
    de la simple mise en forme de ce qui existe déjà (§3). La liste complète
    est déjà scopée à current_user avant tout filtre : un season_id/
    construction_id appartenant à quelqu'un d'autre ne peut donc jamais faire
    fuiter une donnée, il produit simplement une liste vide plutôt qu'un 404
    qui confirmerait/infirmerait l'existence de l'ID chez un autre
    utilisateur (§10 : anti-IDOR sur chaque filtre).
    """
    evenements = _construire_evenements(current_user, db)

    if season_id is not None:
        evenements = [e for e in evenements if e.season is not None and e.season.id_saison == season_id]
    if construction_id is not None:
        evenements = [
            e for e in evenements
            if e.construction is not None and e.construction.id_construction == construction_id
        ]
    if date_from is not None:
        evenements = [e for e in evenements if e.date.date() >= date_from]
    if date_to is not None:
        evenements = [e for e in evenements if e.date.date() <= date_to]

    evenements.sort(key=lambda e: (e.date, -_PRIORITE_TYPE.get(e.type, 99)), reverse=True)

    total = len(evenements)
    page = evenements[offset: offset + limit]
    return TrajectoryPage(items=page, total=total, limit=limit, offset=offset)
