"""
Mission 9 — Today devient le point d'entrée du modèle moderne. Aucun
endpoint n'a été créé ou modifié pour cette mission (l'audit backend du
§12 a confirmé que /constructions, /axes/{id}/engagements, /actions,
/observations, /bilans, /trajectory suffisaient déjà) — ce fichier prouve,
au niveau backend, exactement le parcours que la nouvelle TodayPage exerce.

Note sur le Test E (Engagement suspendu) : l'exclusion visuelle d'un
Engagement suspendu de "Engagements pertinents" est une logique CÔTÉ
FRONTEND (`.filter((e) => e.actif)` dans TodayPage.tsx) — ce fichier ne
peut vérifier ici que la donnée backend (`actif: false`) est correcte pour
que ce filtre fonctionne ; l'absence visuelle a été vérifiée par lecture de
code et capture d'écran (voir le rapport de mission).
"""
from conftest import enregistrer_et_connecter


# --- A, B, C : Construction avec/sans Saison -----------------------------
def test_A_construction_moderne_sans_saison(client):
    headers = enregistrer_et_connecter(client, "m9A")
    r = client.post("/constructions", json={"nom": "Piano"}, headers=headers)
    assert r.status_code == 201, r.text
    assert r.json()["id_saison"] is None
    # Visible dans la liste que Today interroge :
    assert any(c["nom"] == "Piano" for c in client.get("/constructions", headers=headers).json())


def test_B_saison_active_et_ses_constructions(client):
    headers = enregistrer_et_connecter(client, "m9B")
    saison = client.post("/seasons", json={"nom": "Saison", "date_debut": "2026-09-01"}, headers=headers).json()
    client.post("/constructions", json={"nom": "Écriture", "id_saison": saison["id_saison"]}, headers=headers)

    active = client.get("/seasons/active", headers=headers).json()
    assert active["id_saison"] == saison["id_saison"]
    constructions = client.get(f"/constructions?season_id={saison['id_saison']}", headers=headers).json()
    assert any(c["nom"] == "Écriture" for c in constructions)


def test_C_construction_sans_saison_reste_utilisable(client):
    headers = enregistrer_et_connecter(client, "m9C")
    construction = client.post("/constructions", json={"nom": "Piano"}, headers=headers).json()
    assert client.post(
        f"/axes/{construction['id_construction']}/engagements",
        json={"description": "Jouer", "date_debut": "2026-09-01"},
        headers=headers,
    ).status_code == 201


# --- D, E : Engagement actif / suspendu -----------------------------------
def test_D_engagement_actif_apparait(client):
    headers = enregistrer_et_connecter(client, "m9D")
    construction = client.post("/constructions", json={"nom": "Piano"}, headers=headers).json()
    client.post(
        f"/axes/{construction['id_construction']}/engagements",
        json={"description": "Jouer chaque soir", "date_debut": "2026-09-01"},
        headers=headers,
    )
    engagements = client.get(f"/axes/{construction['id_construction']}/engagements", headers=headers).json()
    assert len(engagements) == 1
    assert engagements[0]["actif"] is True


def test_E_engagement_suspendu_non_actif(client):
    headers = enregistrer_et_connecter(client, "m9E")
    construction = client.post("/constructions", json={"nom": "Piano"}, headers=headers).json()
    engagement = client.post(
        f"/axes/{construction['id_construction']}/engagements",
        json={"description": "Jouer chaque soir", "date_debut": "2026-09-01"},
        headers=headers,
    ).json()
    client.patch(f"/engagements/{engagement['id_engagement']}", json={"actif": False}, headers=headers)

    engagements = client.get(f"/axes/{construction['id_construction']}/engagements", headers=headers).json()
    # La donnée est correcte pour que le filtre frontend (.filter(e => e.actif))
    # l'exclue de "Engagements pertinents" — voir la note en tête de fichier.
    assert engagements[0]["actif"] is False


# --- F, G, H, I : Action ----------------------------------------------------
def test_F_G_action_creee_sans_engagement(client):
    headers = enregistrer_et_connecter(client, "m9FG")
    construction = client.post("/constructions", json={"nom": "Piano"}, headers=headers).json()
    r = client.post(
        "/actions",
        json={"id_axe": construction["id_construction"], "contenu": "Improvisation"},
        headers=headers,
    )
    assert r.status_code == 201, r.text
    assert r.json()["id_engagement"] is None


def test_H_action_avec_engagement_choisi(client):
    headers = enregistrer_et_connecter(client, "m9H")
    construction = client.post("/constructions", json={"nom": "Piano"}, headers=headers).json()
    engagement = client.post(
        f"/axes/{construction['id_construction']}/engagements",
        json={"description": "Jouer", "date_debut": "2026-09-01"},
        headers=headers,
    ).json()
    r = client.post(
        "/actions",
        json={"id_axe": construction["id_construction"], "id_engagement": engagement["id_engagement"]},
        headers=headers,
    )
    assert r.status_code == 201, r.text
    assert r.json()["id_engagement"] == engagement["id_engagement"]


def test_I_action_utilise_date_reelle(client):
    headers = enregistrer_et_connecter(client, "m9I")
    construction = client.post("/constructions", json={"nom": "Piano"}, headers=headers).json()
    r = client.post(
        "/actions",
        json={"id_axe": construction["id_construction"], "date_action": "2026-09-10"},
        headers=headers,
    )
    corps = r.json()
    assert corps["date_action"].startswith("2026-09-10")
    assert "semaine" not in corps and "jour" not in corps  # ActionOut ne les expose jamais


# --- J, K : Observation ------------------------------------------------------
def test_J_K_observation_independante(client):
    headers = enregistrer_et_connecter(client, "m9JK")
    r = client.post("/observations", json={"contenu": "Une observation libre"}, headers=headers)
    assert r.status_code == 201, r.text
    assert r.json()["id_axe"] is None
    assert r.json()["id_entree"] is None


# --- L : anti-IDOR -----------------------------------------------------------
def test_L_anti_idor(client):
    headers_a = enregistrer_et_connecter(client, "m9La")
    headers_b = enregistrer_et_connecter(client, "m9Lb")
    construction_a = client.post("/constructions", json={"nom": "Piano A"}, headers=headers_a).json()
    engagement_a = client.post(
        f"/axes/{construction_a['id_construction']}/engagements",
        json={"description": "Test", "date_debut": "2026-09-01"},
        headers=headers_a,
    ).json()

    assert client.get(f"/constructions/{construction_a['id_construction']}", headers=headers_b).status_code == 404
    assert client.get(f"/engagements/{engagement_a['id_engagement']}", headers=headers_b).status_code == 404
    assert client.post(
        "/actions", json={"id_axe": construction_a["id_construction"]}, headers=headers_b
    ).status_code == 404
    assert client.get(f"/axes/{construction_a['id_construction']}/engagements", headers=headers_b).status_code == 404


# --- M : legacy toujours lisible ---------------------------------------------
def test_M_legacy_reste_lisible(client):
    headers = enregistrer_et_connecter(client, "m9M")
    saison = client.post("/seasons", json={"nom": "Saison", "date_debut": "2026-09-01"}, headers=headers).json()
    axe = client.post(
        f"/programmes/{saison['id_saison']}/axes",
        json={"nom": "Axe legacy", "phase_deverrouillage": 1, "pilier": "corps"},
        headers=headers,
    ).json()
    client.put(f"/axes/{axe['id_axe']}/suivi/1/0", headers=headers)
    r = client.get(f"/programmes/{saison['id_saison']}/suivi?semaine=1", headers=headers)
    assert r.status_code == 200
    assert len(r.json()) == 1


# --- N : Action créée depuis "Today" apparaît dans Trajectory ---------------
def test_N_action_apparait_dans_trajectory(client):
    headers = enregistrer_et_connecter(client, "m9N")
    construction = client.post("/constructions", json={"nom": "Piano"}, headers=headers).json()
    client.post(
        "/actions",
        json={"id_axe": construction["id_construction"], "contenu": "Enregistrée depuis Today"},
        headers=headers,
    )
    r = client.get("/trajectory", headers=headers)
    contenus = [e["content"] for e in r.json()["items"] if e["type"] == "action"]
    assert "Enregistrée depuis Today" in contenus


# --- O : aucune génération automatique d'occurrence --------------------------
def test_O_aucune_generation_automatique(client):
    headers = enregistrer_et_connecter(client, "m9O")
    construction = client.post("/constructions", json={"nom": "Piano"}, headers=headers).json()
    assert client.get(f"/actions?axe_id={construction['id_construction']}", headers=headers).json() == []

    client.post(
        f"/axes/{construction['id_construction']}/engagements",
        json={"description": "Jouer deux fois par semaine", "type": "recurrent", "date_debut": "2026-09-01"},
        headers=headers,
    )
    # La seule création de l'Engagement ne doit produire AUCUNE Action.
    assert client.get(f"/actions?axe_id={construction['id_construction']}", headers=headers).json() == []


# --- P : aucun verrou Wakati sur une création moderne depuis Today ----------
def test_P_aucun_verrou_wakati(client):
    headers = enregistrer_et_connecter(client, "m9P")
    saison = client.post(
        "/seasons", json={"nom": "Saison verrouillée", "date_debut": "2026-09-01"}, headers=headers
    ).json()
    axe = client.post(
        f"/programmes/{saison['id_saison']}/axes",
        json={"nom": "Axe verrouillé", "phase_deverrouillage": 4, "pilier": "corps"},
        headers=headers,
    ).json()
    assert axe["deverrouille"] is False

    # Toutes les créations "à la Today" fonctionnent malgré le verrou réel :
    assert client.post(
        f"/axes/{axe['id_axe']}/engagements", json={"description": "Test", "date_debut": "2026-09-01"}, headers=headers
    ).status_code == 201
    assert client.post("/actions", json={"id_axe": axe["id_axe"]}, headers=headers).status_code == 201
    assert client.post(
        "/observations", json={"contenu": "Test", "id_axe": axe["id_axe"]}, headers=headers
    ).status_code == 201
