import enum

from datetime import datetime, timezone

from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Enum
from sqlalchemy.orm import relationship

from app.core.database import Base


class Pilier(str, enum.Enum):
    corps = "corps"
    esprit = "esprit"
    caractere = "caractere"
    impact = "impact"


class StatutConstruction(str, enum.Enum):
    """
    Mission 5 §4. Stocké en texte simple (pas un ENUM SQL natif comme
    `Pilier`), même choix que `Bilan.type_decision` (Mission 4) : une colonne
    neuve n'a aucune contrainte héritée à faire évoluer, donc pas besoin de
    gérer un type ENUM Postgres supplémentaire dans une migration manuelle.
    """
    active = "active"
    en_pause = "en_pause"
    terminee = "terminee"
    abandonnee = "abandonnee"


class Axe(Base):
    __tablename__ = "axes"

    id_axe = Column(Integer, primary_key=True, index=True)
    # Mission 5 : nullable — une Construction peut exister hors Saison
    # (§4 : "Le cas suivant doit être valide : User → Construction hors
    # Saison"). Toujours renseigné pour tout Axe historique (comportement
    # inchangé pour Wakati).
    id_programme = Column(Integer, ForeignKey("programmes.id_programme"), nullable=True)
    # Mission 5 : rattachement direct à l'utilisateur — même raison que
    # Bilan.id_utilisateur (Mission 4) et Observation.id_utilisateur
    # (Mission 3) : sans Programme, il n'y a plus de chemine
    # Axe → Programme → Utilisateur pour l'anti-IDOR (voir
    # routers/constructions.py, _get_construction_ou_404). Nullable
    # uniquement pour ne pas casser les lignes historiques ; toujours
    # renseigné pour toute nouvelle Construction, avec ou sans Saison.
    id_utilisateur = Column(Integer, ForeignKey("utilisateurs.id_utilisateur"), nullable=True)
    nom = Column(String(100), nullable=False)
    # RG-04 : semaine à partir de laquelle l'axe devient cochable. Nullable
    # depuis Mission 5 (§12) : une Construction nouvellement créée ne doit
    # pas être artificiellement "verrouillée" simplement parce que l'ancien
    # système possède cette notion — NULL = jamais concerné par ce
    # mécanisme (voir logique_programme.axe_est_deverrouille, inchangée,
    # qui traite NULL comme "toujours déverrouillé").
    phase_deverrouillage = Column(Integer, nullable=True)
    ordre_affichage = Column(Integer, nullable=False, default=0)
    # RG-10 : regroupement visuel/hiérarchique (Corps/Esprit/Caractère/Impact).
    # Nullable depuis Mission 5 (§11) : les piliers deviennent une
    # catégorisation historique facultative, pas une des "quatre dimensions
    # obligatoires" qu'une nouvelle Construction devrait remplir.
    pilier = Column(Enum(Pilier), nullable=True)
    # RG-11 : jours de la semaine où l'axe fait partie du "rituel du jour"
    # (même format que Notification.jours_actifs : "1,3,5", 1=lundi..7=dimanche).
    # NULL = actif tous les jours (comportement historique, rien ne casse).
    # C'est un filtre d'AFFICHAGE, pas un verrou : cocher un axe un jour hors de
    # sa liste reste autorisé (rattraper un jour manqué doit rester possible).
    jours_actifs = Column(String(20), nullable=True)
    # Mission 5, nouveaux champs Construction (§4) — tous nullable, jamais
    # fabriqués pour l'historique (§23 : "ne fabrique aucune intention
    # fictive" — le même principe s'applique à `status` et `date_creation`,
    # qui n'existaient pas conceptuellement pour un Axe Wakati).
    intention = Column(Text, nullable=True)
    status = Column(String(20), nullable=True)
    date_creation = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=True)

    programme = relationship("Programme", back_populates="axes")
    utilisateur = relationship("Utilisateur", back_populates="axes")
    entrees = relationship("EntreeSuivi", back_populates="axe", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="axe")
    sessions_travail = relationship("SessionTravail", back_populates="axe", cascade="all, delete-orphan")
    # Mission 2 : Axe 1 → N Engagements. phase_deverrouillage/jours_actifs/
    # pilier/ordre_affichage restent inchangés (dette Wakati volontairement
    # conservée pour cette phase — voir Mission 1.5).
    engagements = relationship("Engagement", back_populates="axe", cascade="all, delete-orphan")
    # Mission 3 : pas de cascade delete — une Observation appartient
    # d'abord à l'utilisateur (voir Utilisateur.observations), pas à l'Axe ;
    # supprimer un Axe ne doit pas effacer ce que l'utilisateur a remarqué.
    observations = relationship("Observation", back_populates="axe")
    # Mission 4 : même principe que observations — pas de cascade, une
    # Réflexion appartient d'abord à l'utilisateur (Bilan.id_utilisateur),
    # pas à l'Axe qu'elle mentionne éventuellement.
    bilans = relationship("Bilan", back_populates="axe")
