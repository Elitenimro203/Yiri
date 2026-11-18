"""
Mission 11 — Réconcilier les faits réels dans Reflections.

Le décompte des Actions de la semaine civile (tests A, B, C, F) est une
logique côté frontend, testée dans frontend/src/lib/semaineCivile.test.ts.
Ce fichier prouve la partie backend sur laquelle elle repose :

- B (données) : une case Wakati cochée est renvoyée par /actions avec
  date_action = None, ce qui permet au frontend de l'exclure sans lui
  inventer de date ;
- D : une Réflexion créée alors qu'une Saison est active n'est rattachée à
  aucune semaine si le client ne le demande pas ;
- E : un rattachement explicitement choisi est conservé ;
- H : une Réflexion sans Saison est valide et reste libre.
"""
from conftest import enregistrer_et_connecter


def _saison_avec_construction(client, headers):
    saison = client.post(
        "/seasons", json={"nom": "Saison", "date_debut": "2026-09-01"}, headers=headers
    ).json()
    axe = client.post(
        f"/programmes/{saison['id_saison']}/axes",
        json={"nom": "Lecture", "phase_deverrouillage": 1, "pilier": "esprit"},
        headers=headers,
    ).json()
    return saison, axe


def test_B_case_wakati_sans_date_action(client):
    headers = enregistrer_et_connecter(client, "m11B")
    saison, axe = _saison_avec_construction(client, headers)
    r = client.put(f"/axes/{axe['id_axe']}/suivi/1/1", headers=headers)
    assert r.status_code in (200, 201), r.text
    r = client.post("/actions", json={"id_axe": axe["id_axe"], "contenu": "lu 20 pages"}, headers=headers)
    assert r.status_code == 201, r.text

    actions = client.get("/actions", headers=headers).json()
    modernes = [a for a in actions if a["date_action"] is not None]
    legacy = [a for a in actions if a["date_action"] is None]
    assert len(modernes) == 1
    assert len(legacy) == 1, "la case Wakati reste lisible, mais sans date inventée"


def test_D_aucun_rattachement_automatique_avec_saison_active(client):
    headers = enregistrer_et_connecter(client, "m11D")
    saison, axe = _saison_avec_construction(client, headers)
    r = client.post(
        "/bilans",
        json={"id_axe": axe["id_axe"], "remarque": "r", "type_decision": "continuer"},
        headers=headers,
    )
    assert r.status_code == 201, r.text
    assert r.json()["id_programme"] is None
    assert r.json()["semaine"] is None


def test_E_rattachement_explicite_conserve(client):
    headers = enregistrer_et_connecter(client, "m11E")
    saison, axe = _saison_avec_construction(client, headers)
    r = client.post(
        "/bilans",
        json={
            "id_programme": saison["id_saison"],
            "semaine": 1,
            "remarque": "r",
            "type_decision": "approfondir",
        },
        headers=headers,
    )
    assert r.status_code == 201, r.text
    assert r.json()["id_programme"] == saison["id_saison"]
    assert r.json()["semaine"] == 1


def test_H_reflexion_sans_saison(client):
    headers = enregistrer_et_connecter(client, "m11H")
    r = client.post("/bilans", json={"type_decision": "ne_rien_changer"}, headers=headers)
    assert r.status_code == 201, r.text
    assert r.json()["id_programme"] is None


def test_11b_aucun_score_pour_une_reflexion_moderne_rattachee(client):
    """Mission 11b : même rattachée explicitement à une semaine, une Réflexion
    créée par le flux moderne ne reçoit jamais de score en % (vision §20 :
    pas de notation de soi). Les scores legacy déjà stockés restent en base."""
    headers = enregistrer_et_connecter(client, "m11b")
    saison, axe = _saison_avec_construction(client, headers)
    client.put(f"/axes/{axe['id_axe']}/suivi/1/1", headers=headers)  # une case cochée : l'ancien calcul donnerait un score
    r = client.post(
        "/bilans",
        json={"id_programme": saison["id_saison"], "semaine": 1, "remarque": "r", "type_decision": "continuer"},
        headers=headers,
    )
    assert r.status_code == 201, r.text
    assert r.json()["semaine"] == 1, "le rattachement choisi est conservé"
    assert r.json()["score_snapshot"] is None
