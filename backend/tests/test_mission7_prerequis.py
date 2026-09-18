"""
Mission 7, §1 — test du correctif de `_get_entree_ou_404`
(routers/observations.py). Avant correction, cette fonction ne vérifiait la
propriété d'une Action que via `Axe.programme.has(...)`, ce qui excluait à
tort le chemin Construction sans Saison → Action → Observation, alors que
les Missions 5 et 6 autorisent explicitement cette chaîne.

Les 6 points du scénario demandé sont couverts par les deux tests
ci-dessous ; le chemin "Construction rattachée à une Saison" (déjà couvert
par Mission 3) est revérifié en 3e test pour confirmer l'absence de
régression.
"""
from conftest import enregistrer_et_connecter


def test_construction_sans_saison_action_observation(client):
    """Points 1 à 4 du scénario : le chemin complet doit fonctionner."""
    headers = enregistrer_et_connecter(client, "m7p1")

    r = client.post("/constructions", json={"nom": "Piano", "id_saison": None}, headers=headers)
    assert r.status_code == 201, r.text
    construction = r.json()
    assert construction["id_saison"] is None

    r = client.post("/actions", json={"id_axe": construction["id_construction"]}, headers=headers)
    assert r.status_code == 201, r.text
    action = r.json()

    r = client.post(
        "/observations",
        json={"contenu": "Je joue plus volontiers le soir", "id_entree": action["id_entree"]},
        headers=headers,
    )
    assert r.status_code == 201, r.text  # avant correctif : 404 à tort ici
    observation = r.json()
    assert observation["id_entree"] == action["id_entree"]


def test_autre_utilisateur_ne_peut_pas_acceder_ni_associer(client):
    """Points 5 et 6 du scénario : IDOR toujours respecté après correction."""
    headers_a = enregistrer_et_connecter(client, "m7p2a")
    headers_b = enregistrer_et_connecter(client, "m7p2b")

    construction_a = client.post(
        "/constructions", json={"nom": "Piano A", "id_saison": None}, headers=headers_a
    ).json()
    action_a = client.post(
        "/actions", json={"id_axe": construction_a["id_construction"]}, headers=headers_a
    ).json()

    # Point 5 : B ne peut pas lire l'Action de A.
    r = client.get(f"/actions/{action_a['id_entree']}", headers=headers_b)
    assert r.status_code == 404, r.text

    # Point 6 : B ne peut pas créer une Observation associée à cette Action.
    r = client.post(
        "/observations",
        json={"contenu": "tentative", "id_entree": action_a["id_entree"]},
        headers=headers_b,
    )
    assert r.status_code == 404, r.text

    # Aucune fuite : la liste des observations de B reste vide.
    assert client.get("/observations", headers=headers_b).json() == []


def test_construction_avec_saison_continue_de_fonctionner(client):
    """Non-régression : le chemin historique (Construction rattachée à une
    Saison) doit continuer de fonctionner exactement comme avant."""
    headers = enregistrer_et_connecter(client, "m7p3")

    saison = client.post("/seasons", json={"nom": "Saison", "date_debut": "2026-09-01"}, headers=headers).json()
    r = client.post(
        f"/programmes/{saison['id_saison']}/axes",
        json={"nom": "Axe legacy", "phase_deverrouillage": 1, "pilier": "corps"},
        headers=headers,
    )
    axe = r.json()

    r = client.put(f"/axes/{axe['id_axe']}/suivi/1/0", headers=headers)
    assert r.status_code == 200, r.text

    # Retrouver l'id_entree de cette EntreeSuivi legacy via /actions (les
    # cases cochées y apparaissent aussi, voir routers/actions.py).
    actions = client.get(f"/actions?axe_id={axe['id_axe']}", headers=headers).json()
    assert len(actions) == 1
    id_entree = actions[0]["id_entree"]

    r = client.post(
        "/observations",
        json={"contenu": "Observation sur Construction avec Saison", "id_entree": id_entree, "id_axe": axe["id_axe"]},
        headers=headers,
    )
    assert r.status_code == 201, r.text
