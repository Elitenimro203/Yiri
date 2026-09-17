from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

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
