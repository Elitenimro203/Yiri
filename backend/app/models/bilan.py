import enum
from datetime import datetime, timezone

from sqlalchemy import Column, Integer, String, Text, Enum, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship

from app.core.database import Base


class DecisionBilan(str, enum.Enum):
    """
    Vocabulaire historique (Wakati). Conservé tel quel pour les Bilans
    existants — voir Mission 4 §8. N'est plus obligatoire pour une nouvelle
    Réflexion créée via le flux moderne (voir TypeDecision ci-dessous) ;
    reste obligatoire pour l'ancien flux hebdomadaire (routers/bilans.py,
    POST /programmes/{id}/bilans), inchangé depuis Mission 1.5b.
    """
    consolider = "consolider"  # on ne rajoute pas de couche, on stabilise ce qui existe
    avancer = "avancer"        # historique — ne déclenche plus rien depuis Mission 1.5b


class TypeDecision(str, enum.Enum):
    """
    Vocabulaire moderne de décision (Mission 4 §8) — remplace progressivement
    DecisionBilan pour le nouveau flux Réflexion. Comme son prédécesseur, une
    valeur ici est une décision enregistrée, jamais une commande : rien dans
    le code ne doit lire ce champ pour déclencher une mutation automatique
    (avancement de semaine, déverrouillage, changement de statut d'Axe,
    modification d'Engagement — voir Mission 4 §9).
    """
    continuer = "continuer"
    modifier = "modifier"
    reduire = "reduire"
    suspendre = "suspendre"
    abandonner = "abandonner"
    approfondir = "approfondir"
    ne_rien_changer = "ne_rien_changer"


class Bilan(Base):
    """
    Mission 4 : ce modèle porte maintenant deux usages qui convergent
    progressivement vers un seul concept (Réflexion) sans jamais avoir été
    dupliqué en deux tables :

    - l'ancien Bilan hebdomadaire (id_programme + semaine obligatoires à la
      création, decision consolider/avancer, score_snapshot calculé) — flux
      inchangé, toujours servi par POST /programmes/{id}/bilans ;
    - la nouvelle Réflexion libre (id_utilisateur obligatoire en pratique,
      id_programme/semaine/decision/score_snapshot tous facultatifs) — servie
      par POST /bilans (routers/bilans.py).

    Les anciennes lignes n'ont pas de valeur dans id_utilisateur (colonne
    ajoutée après coup, jamais rétro-remplie — voir Mission 4 §5) : leur
    propriétaire se déduit alors de Bilan → Programme → Utilisateur dans le
    code (voir _get_bilan_ou_404, routers/bilans.py), jamais en base.
    """
    __tablename__ = "bilans"

    id_bilan = Column(Integer, primary_key=True, index=True)
    # Nullable depuis Mission 4 : une Réflexion peut être globale, sans
    # Programme (voir §5/§11). Les anciens Bilans ont toujours cette colonne
    # renseignée — rien ne change pour eux.
    id_programme = Column(Integer, ForeignKey("programmes.id_programme"), nullable=True)
    # Mission 4 : rattachement direct à l'utilisateur, pour que la Réflexion
    # n'ait pas besoin de passer par un Programme pour exister. Nullable
    # uniquement pour ne pas casser les lignes historiques (§5) — toujours
    # renseigné pour toute nouvelle ligne, ancienne ou moderne.
    id_utilisateur = Column(Integer, ForeignKey("utilisateurs.id_utilisateur"), nullable=True)
    # Mission 4 : association facultative à une Construction (§6).
    id_axe = Column(Integer, ForeignKey("axes.id_axe"), nullable=True)
    # Nullable depuis Mission 4 : une Réflexion libre n'est pas forcément
    # numérotée en semaine de programme (§11). Toujours renseignée pour un
    # Bilan hebdomadaire classique.
    semaine = Column(Integer, nullable=True)
    # Snapshot au moment de la clôture — jamais recalculé après coup. Nullable
    # depuis Mission 4 : sans Programme+semaine, il n'y a rien à calculer, et
    # ce n'est plus le centre de la nouvelle Réflexion (§10) — jamais un
    # nouveau score n'est créé pour la remplacer.
    score_snapshot = Column(Integer, nullable=True)
    # Champs historiques (quoi_a_marche/quoi_n_a_pas_marche) : conservés tels
    # quels, non repris automatiquement dans `remarque` (§4 — éviter deux
    # systèmes concurrents pour la même information, mais ne pas fusionner
    # rétroactivement des données qui n'ont pas la même forme : l'ancien
    # modèle sépare "ce qui a marché" / "ce qui n'a pas marché", le nouveau
    # `remarque` est une seule observation libre, pas nécessairement scindée).
    quoi_a_marche = Column(Text, nullable=True)
    quoi_n_a_pas_marche = Column(Text, nullable=True)
    # Réutilisé tel quel comme "ce que je change" du nouveau flux (§4, §13) —
    # même sens dans les deux flux, pas de nouveau champ dupliqué exprès.
    ajustement_semaine_suivante = Column(Text, nullable=True)
    # Mission 4, nouveaux champs du flux Réflexion (§4, §13) :
    # "ce que je remarque" — une observation libre, pas nécessairement scindée
    # positif/négatif comme les champs historiques ci-dessus.
    remarque = Column(Text, nullable=True)
    # "ce que j'en comprends" — explicitement une interprétation provisoire,
    # jamais un diagnostic (§13 : "ne pas diagnostiquer").
    comprehension = Column(Text, nullable=True)
    # decision (legacy) reste tel quel pour le flux hebdomadaire ; nullable
    # depuis Mission 4 car une Réflexion moderne n'est plus tenue de fournir
    # une valeur consolider/avancer devenue sans objet pour elle (§8).
    decision = Column(Enum(DecisionBilan), nullable=True)
    # Nouveau vocabulaire de décision (§8) — coexiste avec `decision`, ne le
    # remplace pas encore physiquement. Stocké en texte simple (pas un ENUM
    # SQL natif comme `decision`) : la validation se fait à la frontière
    # applicative (schemas/bilan.py), ce qui évite d'avoir à créer/gérer un
    # type ENUM Postgres supplémentaire dans une migration manuelle — plus
    # simple et donc plus sûr à faire évoluer que `decision`, qui lui a été
    # créé nativement dès le tout premier déploiement (create_all()).
    type_decision = Column(String(30), nullable=True)
    date_creation = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    programme = relationship("Programme", back_populates="bilans")
    utilisateur = relationship("Utilisateur", back_populates="bilans")
    axe = relationship("Axe", back_populates="bilans")

    __table_args__ = (
        # RG-12 : un seul bilan par (programme, semaine) — on clôture une
        # semaine une fois, on ne la re-clôture pas indéfiniment. Toujours
        # vrai pour les Bilans hebdomadaires (§15) ; sans effet sur les
        # Réflexions libres, où (id_programme, semaine) sont NULL — une
        # contrainte UNIQUE ne bloque jamais deux NULL entre eux (SQLite et
        # PostgreSQL), donc plusieurs Réflexions libres peuvent coexister.
        UniqueConstraint("id_programme", "semaine", name="uq_bilan_programme_semaine"),
    )

