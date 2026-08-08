from datetime import datetime, timezone

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship

from app.core.database import Base


class PushSubscription(Base):
    """
    Un utilisateur peut avoir plusieurs appareils (téléphone perso + celui de
    son frère, PC, etc.) — chacun crée sa propre subscription. `endpoint` est
    l'URL unique fournie par le navigateur (Chrome/Firefox/Safari pointent
    chacun vers leur propre service de push), donc c'est notre clé naturelle
    pour éviter les doublons si le navigateur re-souscrit.
    """
    __tablename__ = "push_subscriptions"

    id_subscription = Column(Integer, primary_key=True, index=True)
    id_utilisateur = Column(Integer, ForeignKey("utilisateurs.id_utilisateur"), nullable=False)
    endpoint = Column(String(500), nullable=False)
    cle_p256dh = Column(String(255), nullable=False)  # clé publique du navigateur, pour chiffrer le payload
    cle_auth = Column(String(255), nullable=False)     # secret d'authentification du navigateur
    date_creation = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    utilisateur = relationship("Utilisateur", back_populates="push_subscriptions")

    __table_args__ = (
        UniqueConstraint("id_utilisateur", "endpoint", name="uq_push_sub_utilisateur_endpoint"),
    )
