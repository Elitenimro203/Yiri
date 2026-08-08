from pydantic import BaseModel, EmailStr, Field


class UtilisateurCreate(BaseModel):
    email: EmailStr
    # max_length=72 : bcrypt ignore tout au-delà de 72 BYTES (pas caractères — un emoji peut
    # en prendre 4). Sans cette borne, deux mots de passe différents mais partageant les mêmes
    # 72 premiers bytes seraient acceptés comme identiques par bcrypt — silencieusement, sans
    # erreur. Mieux vaut rejeter à l'entrée (422 explicite) que tronquer sans le dire.
    mot_de_passe: str = Field(min_length=8, max_length=72)
    nom: str = Field(min_length=1, max_length=100)


class UtilisateurOut(BaseModel):
    id_utilisateur: int
    email: EmailStr
    nom: str

    class Config:
        from_attributes = True  # permet de construire ce schéma directement depuis un objet SQLAlchemy


class LoginRequest(BaseModel):
    email: EmailStr
    mot_de_passe: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
