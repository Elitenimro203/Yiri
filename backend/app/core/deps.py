from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.utilisateur import Utilisateur

# tokenUrl pointe vers /auth/login — utilisé uniquement par la doc Swagger pour le bouton "Authorize"
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> Utilisateur:
    """
    Dependency à injecter dans CHAQUE route protégée.

    💡 Piège classique : vérifier juste "le token existe et se décode" sans vérifier
    que l'utilisateur qu'il désigne existe encore en base (compte supprimé entre-temps).
    Ici on va chercher l'utilisateur réel — un token valide pour un compte supprimé
    est traité comme invalide, pas comme "connecté".
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Identifiants invalides ou expirés",
        headers={"WWW-Authenticate": "Bearer"},
    )

    user_id = decode_access_token(token)
    if user_id is None:
        raise credentials_exception

    user = db.query(Utilisateur).filter(Utilisateur.id_utilisateur == int(user_id)).first()
    if user is None:
        raise credentials_exception

    return user
