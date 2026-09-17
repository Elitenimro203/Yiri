from sqlalchemy import Column, Integer, Text, Boolean, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship

from app.core.database import Base


class EntreeSuivi(Base):
    __tablename__ = "entrees_suivi"

    id_entree = Column(Integer, primary_key=True, index=True)
    id_axe = Column(Integer, ForeignKey("axes.id_axe"), nullable=False)
    # Mission 2 : pont nullable vers Engagement. Nullable pour NE PAS obliger
    # rétroactivement les entrées historiques (Wakati) à posséder un
    # engagement — leur absence de valeur ici reste un état parfaitement
    # valide, pas une donnée manquante à corriger.
    id_engagement = Column(Integer, ForeignKey("engagements.id_engagement"), nullable=True)
    # Legacy Wakati — nullable depuis Mission 6 (§12) : une Action moderne
    # (créée via POST /actions) n'a plus de grille hebdomadaire à laquelle se
    # rattacher, elle ne doit donc pas être forcée à inventer une semaine/jour
    # qui n'a pas de sens pour elle. Toujours renseigné pour toute ligne créée
    # via l'ancien endpoint /axes/{id}/suivi/{semaine}/{jour} (inchangé).
    semaine = Column(Integer, nullable=True)
    jour = Column(Integer, nullable=True)  # 0 = Lundi ... 6 = Dimanche
    coche = Column(Boolean, default=False, nullable=False)
    # Legacy : timestamp du dernier "coché", remis à NULL au décochage (c'est
    # un comportement de toggle, pas une date de fait immuable — voir
    # date_action ci-dessous, qui ne se comporte jamais ainsi).
    date_coche = Column(DateTime, nullable=True)
    # Mission 6 (§8/§9) : la date réelle à laquelle une Action a eu lieu,
    # contrôlée côté serveur (jamais fournie telle quelle par le client sans
    # validation — voir routers/actions.py), jamais remise à NULL après coup.
    # C'est la source de vérité pour toute nouvelle Action ; `semaine`/`jour`
    # restent legacy et ne sont plus utilisés comme référence temporelle par
    # aucun nouveau mécanisme Yiri. NULL pour toute ligne créée par l'ancien
    # mécanisme de toggle — on ne fabrique pas une fausse précision là où le
    # seul repère historique disponible est `date_coche` (§9).
    date_action = Column(DateTime, nullable=True)
    # Mission 6 (§8) : "information factuelle minimale" facultative sur
    # l'Action, dans le même esprit qu'Observation.contenu. Ne duplique pas
    # SessionTravail (aucune durée ici, voir §5).
    contenu = Column(Text, nullable=True)

    axe = relationship("Axe", back_populates="entrees")
    engagement = relationship("Engagement", back_populates="entrees")
    # Mission 3 : même principe que Axe.observations — pas de cascade,
    # l'Observation appartient d'abord à l'utilisateur.
    observations = relationship("Observation", back_populates="entree")

    __table_args__ = (
        # RG-05 : un seul enregistrement possible par (axe, semaine, jour).
        # Contrainte posée en base, pas seulement vérifiée en Python — si demain un autre
        # service écrit directement en DB (script de migration, admin...), l'intégrité
        # tient quand même. Ne jamais faire confiance uniquement à la couche applicative
        # pour une règle d'unicité métier.
        # Mission 6 : reste valide avec semaine/jour nullable — NULL est traité
        # comme distinct de toute autre valeur dans une contrainte UNIQUE
        # (SQL standard, déjà vérifié empiriquement sur Bilan en Mission 4) :
        # plusieurs Actions modernes (semaine=NULL, jour=NULL) peuvent
        # coexister sur le même axe sans collision.
        UniqueConstraint("id_axe", "semaine", "jour", name="uq_entree_axe_semaine_jour"),
    )
