"""
Premiers jours — décision provisoire : une Action peut exister sans
Construction, puis y être rattachée. Chaque test crée ses propres
utilisateurs (base de test partagée).
"""
import sqlite3
from pathlib import Path

from sqlalchemy import create_engine, inspect

from conftest import enregistrer_et_connecter
from test_mission6_migration import SCHEMA_PRE_MISSION6, DONNEES


def _construction(client, headers, nom="Anglais oral"):
    r = client.post("/constructions", json={"nom": nom}, headers=headers)
    assert r.status_code == 201, r.text
    return r.json()["id_construction"]


def test_action_libre_creee_et_listee(client):
    h = enregistrer_et_connecter(client, "libre1")
    r = client.post("/actions", json={"contenu": "Lu 20 pages"}, headers=h)
    assert r.status_code == 201, r.text
    assert r.json()["id_axe"] is None
    liste = client.get("/actions", headers=h).json()
    assert [a["contenu"] for a in liste] == ["Lu 20 pages"]


def test_action_libre_invisible_pour_un_autre(client):
    h1 = enregistrer_et_connecter(client, "libre2a")
    h2 = enregistrer_et_connecter(client, "libre2b")
    a = client.post("/actions", json={"contenu": "Privé"}, headers=h1).json()
    assert client.get("/actions", headers=h2).json() == []
    assert client.get(f"/actions/{a['id_entree']}", headers=h2).status_code == 404
    assert client.patch(f"/actions/{a['id_entree']}", json={"id_axe": None}, headers=h2).status_code == 404
    # Une Observation ne peut pas non plus s'accrocher à l'Action d'autrui.
    r = client.post("/observations", json={"contenu": "x", "id_entree": a["id_entree"]}, headers=h2)
    assert r.status_code == 404


def test_engagement_sans_construction_refuse(client):
    h = enregistrer_et_connecter(client, "libre3")
    c = _construction(client, h)
    e = client.post(f"/axes/{c}/engagements", json={"description": "x", "date_debut": "2026-09-01"}, headers=h).json()
    r = client.post("/actions", json={"contenu": "x", "id_engagement": e["id_engagement"]}, headers=h)
    assert r.status_code == 422


def test_rattacher_puis_detacher(client):
    h = enregistrer_et_connecter(client, "libre4")
    c = _construction(client, h)
    a = client.post("/actions", json={"contenu": "Podcast"}, headers=h).json()
    r = client.patch(f"/actions/{a['id_entree']}", json={"id_axe": c}, headers=h)
    assert r.status_code == 200 and r.json()["id_axe"] == c
    assert [x["contenu"] for x in client.get(f"/actions?axe_id={c}", headers=h).json()] == ["Podcast"]
    r = client.patch(f"/actions/{a['id_entree']}", json={"id_axe": None}, headers=h)
    assert r.status_code == 200 and r.json()["id_axe"] is None
    # Toujours visible pour son propriétaire après détachement.
    assert len(client.get("/actions", headers=h).json()) == 1


def test_rattacher_a_la_construction_dautrui_refuse(client):
    h1 = enregistrer_et_connecter(client, "libre5a")
    h2 = enregistrer_et_connecter(client, "libre5b")
    c_autre = _construction(client, h2)
    a = client.post("/actions", json={"contenu": "x"}, headers=h1).json()
    assert client.patch(f"/actions/{a['id_entree']}", json={"id_axe": c_autre}, headers=h1).status_code == 404


def test_action_liee_a_un_engagement_ne_change_pas_de_construction(client):
    h = enregistrer_et_connecter(client, "libre6")
    c1, c2 = _construction(client, h, "A"), _construction(client, h, "B")
    e = client.post(f"/axes/{c1}/engagements", json={"description": "x", "date_debut": "2026-09-01"}, headers=h).json()
    a = client.post("/actions", json={"id_axe": c1, "id_engagement": e["id_engagement"]}, headers=h).json()
    assert client.patch(f"/actions/{a['id_entree']}", json={"id_axe": c2}, headers=h).status_code == 409


def test_trajectoire_montre_laction_libre(client):
    h = enregistrer_et_connecter(client, "libre7")
    client.post("/actions", json={"contenu": "Marché 30 min"}, headers=h)
    items = client.get("/trajectory", headers=h).json()["items"]
    actions = [i for i in items if i["type"] == "action"]
    assert len(actions) == 1
    assert actions[0]["construction"] is None and actions[0]["content"] == "Marché 30 min"


def test_observation_sur_action_libre(client):
    h = enregistrer_et_connecter(client, "libre8")
    a = client.post("/actions", json={"contenu": "x"}, headers=h).json()
    r = client.post("/observations", json={"contenu": "Plus facile le matin", "id_entree": a["id_entree"]}, headers=h)
    assert r.status_code == 201, r.text


def test_migration_sur_base_existante(tmp_path: Path):
    from app.core.migrations import faire_evoluer_entrees_suivi_vers_action, ouvrir_action_sans_construction

    chemin = tmp_path / "ancienne.db"
    con = sqlite3.connect(chemin)
    con.executescript(SCHEMA_PRE_MISSION6)
    for (requete,) in DONNEES:
        con.execute(requete)
    con.commit()
    avant = con.execute("SELECT id_entree, id_axe, semaine, jour, coche FROM entrees_suivi ORDER BY id_entree").fetchall()
    con.close()

    engine = create_engine(f"sqlite:///{chemin}")
    faire_evoluer_entrees_suivi_vers_action(engine)
    ouvrir_action_sans_construction(engine)
    ouvrir_action_sans_construction(engine)  # idempotent

    colonnes = {c["name"]: c for c in inspect(engine).get_columns("entrees_suivi")}
    assert colonnes["id_axe"]["nullable"] is True
    assert "id_utilisateur" in colonnes

    con = sqlite3.connect(chemin)
    apres = con.execute("SELECT id_entree, id_axe, semaine, jour, coche FROM entrees_suivi ORDER BY id_entree").fetchall()
    assert apres == avant  # historique intact
    assert con.execute("PRAGMA foreign_key_check").fetchall() == []
    con.execute("INSERT INTO entrees_suivi (id_axe, coche, contenu) VALUES (NULL, 1, 'libre')")
    con.commit()
    con.close()
