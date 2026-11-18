"""
Connexion Google : la vérification réelle du jeton (signature, expiration,
audience) est faite par google-auth ; ici on la remplace pour tester ce que
fait Yiri du résultat.
"""
import uuid

import pytest

from app.core.config import get_settings
from app.routers import auth as auth_router


@pytest.fixture
def google(monkeypatch):
    monkeypatch.setattr(get_settings(), "GOOGLE_CLIENT_ID", "client-yiri-test")
    # La base de test est partagée entre les tests : identifiants uniques.
    u = uuid.uuid4().hex[:10]
    infos = {"sub": f"google-{u}", "email": f"awa-{u}@exemple.ci", "email_verified": True, "given_name": "Awa"}

    def faux_verificateur(credential, client_id):
        assert client_id == "client-yiri-test", "le jeton doit être vérifié pour l'ID client de Yiri"
        if credential == "jeton-invalide":
            raise ValueError("signature invalide")
        return dict(infos)

    monkeypatch.setattr(auth_router, "verifier_jeton_google", faux_verificateur)
    return infos


def test_premiere_connexion_cree_le_compte(client, google):
    r = client.post("/auth/google", json={"credential": "jeton"})
    assert r.status_code == 200, r.text
    moi = client.get("/auth/me", headers={"Authorization": f"Bearer {r.json()['access_token']}"}).json()
    assert moi["email"] == google["email"] and moi["nom"] == "Awa"


def test_deuxieme_connexion_retrouve_le_meme_compte(client, google):
    h1 = {"Authorization": f"Bearer {client.post('/auth/google', json={'credential': 'j'}).json()['access_token']}"}
    h2 = {"Authorization": f"Bearer {client.post('/auth/google', json={'credential': 'j'}).json()['access_token']}"}
    assert client.get("/auth/me", headers=h1).json()["id_utilisateur"] == client.get("/auth/me", headers=h2).json()["id_utilisateur"]


def test_compte_existant_avec_le_meme_email_est_relie(client, google):
    r0 = client.post("/auth/register", json={"email": google["email"], "mot_de_passe": "motdepasse1", "nom": "Awa K."})
    assert r0.status_code == 201, r0.text
    r = client.post("/auth/google", json={"credential": "jeton"})
    moi = client.get("/auth/me", headers={"Authorization": f"Bearer {r.json()['access_token']}"}).json()
    assert moi["nom"] == "Awa K.", "c'est le compte existant, pas un doublon"
    # le mot de passe d'origine fonctionne toujours
    assert client.post("/auth/login", data={"username": google["email"], "password": "motdepasse1"}).status_code == 200


def test_jeton_invalide_refuse(client, google):
    assert client.post("/auth/google", json={"credential": "jeton-invalide"}).status_code == 401


def test_email_non_verifie_refuse(client, google):
    google["email_verified"] = False
    assert client.post("/auth/google", json={"credential": "jeton"}).status_code == 401


def test_sans_id_client_la_connexion_google_est_desactivee(client, monkeypatch):
    monkeypatch.setattr(get_settings(), "GOOGLE_CLIENT_ID", "")
    assert client.post("/auth/google", json={"credential": "jeton"}).status_code == 503


def test_google_injoignable_donne_un_message_clair(client, monkeypatch):
    from google.auth import exceptions as google_exceptions
    monkeypatch.setattr(get_settings(), "GOOGLE_CLIENT_ID", "client-yiri-test")

    def panne(credential, client_id):
        raise google_exceptions.TransportError("réseau")

    monkeypatch.setattr(auth_router, "verifier_jeton_google", panne)
    r = client.post("/auth/google", json={"credential": "jeton"})
    assert r.status_code == 503
    assert "injoignable" in r.json()["detail"]
