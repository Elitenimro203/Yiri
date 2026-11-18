from secrets import token_urlsafe

from fastapi import APIRouter, Depends, HTTPException, status
from google.auth import exceptions as google_exceptions
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token
from pydantic import BaseModel, Field
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.security import hash_password, verify_password, create_access_token
from app.models.utilisateur import Utilisateur
from app.schemas.auth import UtilisateurCreate, UtilisateurOut, Token

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UtilisateurOut, status_code=status.HTTP_201_CREATED)
def register(payload: UtilisateurCreate, db: Session = Depends(get_db)):
    nouvel_utilisateur = Utilisateur(
        email=payload.email,
        mot_de_passe_hash=hash_password(payload.mot_de_passe),
        nom=payload.nom,
    )
    db.add(nouvel_utilisateur)
    try:
        db.commit()
    except IntegrityError:
        # RG-01 : email unique. On intercepte la contrainte DB plutôt que de faire
        # un SELECT préalable — évite une race condition entre le check et l'insert
        # (deux requêtes simultanées avec le même email pourraient toutes les deux
        # passer le SELECT avant que l'une des deux n'insère).
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Cet email est déjà utilisé")
    db.refresh(nouvel_utilisateur)
    return nouvel_utilisateur


@router.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    # OAuth2PasswordRequestForm attend des champs "username"/"password" (standard OAuth2) —
    # on y met l'email dans "username". C'est ce que Swagger UI utilise nativement pour
    # le bouton "Authorize", donc on garde ce standard plutôt qu'un schéma custom.
    utilisateur = db.query(Utilisateur).filter(Utilisateur.email == form_data.username).first()

    # Message d'erreur IDENTIQUE que l'email n'existe pas ou que le mot de passe soit faux.
    # ⚠️ SÉCURITÉ : si on distingue "email inconnu" de "mauvais mot de passe", on permet
    # à un attaquant de vérifier quels emails ont un compte (énumération d'utilisateurs).
    erreur_generique = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Email ou mot de passe incorrect",
    )
    if not utilisateur or not verify_password(form_data.password, utilisateur.mot_de_passe_hash):
        raise erreur_generique

    access_token = create_access_token(subject=str(utilisateur.id_utilisateur))
    return Token(access_token=access_token)


@router.get("/me", response_model=UtilisateurOut)
def read_me(current_user: Utilisateur = Depends(get_current_user)):
    return current_user


# ---------------------------------------------------------------------------
# Connexion Google (Google Identity Services)
# ---------------------------------------------------------------------------
# Le navigateur obtient de Google un jeton d'identité signé (« credential »)
# et nous l'envoie. ⚠️ SÉCURITÉ : on ne fait JAMAIS confiance à son contenu
# sans le vérifier côté serveur — signature Google, expiration, et surtout
# l'audience (`aud`) : le jeton doit avoir été émis pour l'ID client de Yiri,
# sinon n'importe quel site Google pourrait se faire passer pour un utilisateur.

class GoogleConnexion(BaseModel):
    credential: str = Field(min_length=1)


def verifier_jeton_google(credential: str, client_id: str) -> dict:
    """Vérifie le jeton auprès des clés publiques de Google. Lève ValueError
    s'il est invalide, expiré ou émis pour un autre client. Isolé pour les tests."""
    return google_id_token.verify_oauth2_token(credential, google_requests.Request(), client_id)


@router.post("/google", response_model=Token)
def connexion_google(payload: GoogleConnexion, db: Session = Depends(get_db)):
    client_id = get_settings().GOOGLE_CLIENT_ID
    if not client_id:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="La connexion Google n'est pas configurée.")

    refus = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Connexion Google refusée.")
    try:
        infos = verifier_jeton_google(payload.credential, client_id)
    except google_exceptions.TransportError:
        # Les clés publiques de Google n'ont pas pu être téléchargées : ce
        # n'est pas la faute de la personne, on le dit (et on évite une 500).
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Google est momentanément injoignable. Réessaie dans un instant.")
    except ValueError:
        raise refus
    if not infos.get("email_verified") or not infos.get("email") or not infos.get("sub"):
        raise refus

    sub, email = infos["sub"], infos["email"]
    utilisateur = db.query(Utilisateur).filter(Utilisateur.google_sub == sub).first()
    if utilisateur is None:
        # Décision : un compte existant avec le même email est RELIÉ à Google.
        # Sûr parce que Google garantit ici que l'email est vérifié.
        utilisateur = db.query(Utilisateur).filter(Utilisateur.email == email).first()
        if utilisateur is not None:
            utilisateur.google_sub = sub
        else:
            nom = (infos.get("given_name") or infos.get("name") or email.split("@")[0])[:100]
            # Un compte Google n'a pas de mot de passe : on stocke le hash d'un
            # secret aléatoire jamais communiqué, donc impossible à deviner.
            utilisateur = Utilisateur(email=email, nom=nom, google_sub=sub, mot_de_passe_hash=hash_password(token_urlsafe(32)))
            db.add(utilisateur)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            utilisateur = db.query(Utilisateur).filter(
                (Utilisateur.google_sub == sub) | (Utilisateur.email == email)
            ).first()
            if utilisateur is None:
                raise refus
        db.refresh(utilisateur)

    return Token(access_token=create_access_token(subject=str(utilisateur.id_utilisateur)))
