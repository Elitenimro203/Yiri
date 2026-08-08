"""
⚠️ SÉCURITÉ : ce fichier concentre tout ce qui touche aux mots de passe et aux tokens.
Ne jamais dupliquer cette logique ailleurs — un seul point de vérité pour l'auth.
"""
from datetime import datetime, timedelta, timezone

from jose import jwt, JWTError
from passlib.context import CryptContext

from app.core.config import get_settings

settings = get_settings()

# bcrypt : à coût adaptatif (on peut augmenter le "cost factor" avec le temps/le matériel).
# ❌ Piège classique : utiliser md5/sha256 pour un mot de passe — ce sont des hash RAPIDES,
# faits pour vérifier l'intégrité de fichiers, pas pour résister au brute-force. Un attaquant
# avec un GPU teste des milliards de sha256/seconde. bcrypt est délibérément lent.
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(subject: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": subject, "exp": expire}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_access_token(token: str) -> str | None:
    """Retourne l'id utilisateur (sub) si le token est valide, None sinon.

    💡 Piège classique : vérifier seulement que le token existe/est décodable, sans
    vérifier son expiration. jwt.decode() lève JWTError automatiquement si `exp` est
    dépassé — mais SEULEMENT si on ne l'attrape pas silencieusement. Ici on catch
    explicitement JWTError et on renvoie None, donc l'appelant traite un token expiré
    exactement comme un token invalide (401), jamais comme "connecté".
    """
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload.get("sub")
    except JWTError:
        return None
