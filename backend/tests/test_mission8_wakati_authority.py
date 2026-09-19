"""
Mission 8 — tests A à N (§18), plus une preuve étendue (au-delà du seul
Test E) qu'AUCUN des parcours modernes (Engagement, Observation, Reflection,
Decision — pas seulement Action) n'est bloqué par un verrou Wakati réel.

Contrairement aux missions précédentes, l'audit de cette mission (voir le
rapport final) n'a trouvé aucune autorité Wakati résiduelle à retirer : les
Missions 2 à 7 avaient déjà, chacune pour sa propre pièce du puzzle, retiré
cette autorité. Ce fichier ne duplique donc pas une correction de code — il
fournit la preuve exécutable, dédiée à Mission 8, que le critère de
réussite (§19 : "si on retire mentalement tout le calendrier Wakati, les
parcours modernes continuent-ils de fonctionner ?") est réellement vérifié,
au-delà de ce que les suites de tests des missions précédentes couvraient
déjà séparément.
"""
from conftest import enregistrer_et_connecter


def _creer_saison_avec_axe_verrouille(client, headers):
    """
    Construit le pire cas possible : une Saison en mode progressif avec un
    Axe legacy réellement verrouillé (phase_deverrouillage=4, semaine
    courante=1). Si un parcours moderne fonctionne malgré CE verrou, il
    fonctionne a fortiori dans tous les cas plus favorables (Construction
    sans Saison, mode complet, etc. — déjà couverts par les missions
    précédentes).
    """
    saison = client.post(
        "/seasons", json={"nom": "Saison verrouillée", "date_debut": "2026-09-01"}, headers=headers
    ).json()
    axe = client.post(
        f"/programmes/{saison['id_saison']}/axes",
        json={"nom": "Axe verrouillé", "phase_deverrouillage": 4, "pilier": "corps"},
        headers=headers,
    ).json()
    assert axe["deverrouille"] is False, "le verrou doit être réel pour que ce test ait un sens"
    return saison, axe


# --- Tests A à D : Construction sans Season -----------------------------------
def test_A_construction_sans_season(client):
    headers = enregistrer_et_connecter(client, "m8A")
    r = client.post("/constructions", json={"nom": "Piano"}, headers=headers)
    assert r.status_code == 201, r.text
    assert r.json()["id_saison"] is None


def test_B_engagement_sur_construction_sans_season(client):
    headers = enregistrer_et_connecter(client, "m8B")
    construction = client.post("/constructions", json={"nom": "Piano"}, headers=headers).json()
    r = client.post(
        f"/axes/{construction['id_construction']}/engagements",
        json={"description": "Jouer chaque soir", "date_debut": "2026-09-01"},
        headers=headers,
    )
    assert r.status_code == 201, r.text


def test_C_action_sur_construction_sans_season(client):
    headers = enregistrer_et_connecter(client, "m8C")
    construction = client.post("/constructions", json={"nom": "Piano"}, headers=headers).json()
    r = client.post("/actions", json={"id_axe": construction["id_construction"]}, headers=headers)
    assert r.status_code == 201, r.text


def test_D_action_avec_date_reelle(client):
    headers = enregistrer_et_connecter(client, "m8D")
    construction = client.post("/constructions", json={"nom": "Piano"}, headers=headers).json()
    r = client.post(
        "/actions",
        json={"id_axe": construction["id_construction"], "date_action": "2026-09-10"},
        headers=headers,
    )
    assert r.status_code == 201, r.text
    assert r.json()["date_action"].startswith("2026-09-10")


# --- Test E : Action non bloquée même sur un Axe réellement verrouillé -------
def test_E_action_non_bloquee_par_phase_deverrouillage(client):
    headers = enregistrer_et_connecter(client, "m8E")
    _saison, axe = _creer_saison_avec_axe_verrouille(client, headers)

    # Preuve que le verrou est réel pour l'ancien mécanisme (sinon ce test
    # ne prouverait rien) :
    r = client.put(f"/axes/{axe['id_axe']}/suivi/1/0", headers=headers)
    assert r.status_code == 423, r.text

    # Le parcours moderne n'est PAS concerné par ce même verrou :
    r = client.post("/actions", json={"id_axe": axe["id_axe"]}, headers=headers)
    assert r.status_code == 201, f"une Action moderne ne doit jamais recevoir de 423 du moteur Wakati : {r.text}"


# --- Preuve étendue : Engagement/Observation/Reflection/Decision non plus ----
def test_engagement_non_bloque_sur_axe_verrouille(client):
    headers = enregistrer_et_connecter(client, "m8ext1")
    _saison, axe = _creer_saison_avec_axe_verrouille(client, headers)
    r = client.post(
        f"/axes/{axe['id_axe']}/engagements",
        json={"description": "Test", "date_debut": "2026-09-01"},
        headers=headers,
    )
    assert r.status_code == 201, r.text


def test_observation_non_bloquee_sur_axe_verrouille(client):
    headers = enregistrer_et_connecter(client, "m8ext2")
    _saison, axe = _creer_saison_avec_axe_verrouille(client, headers)
    r = client.post(
        "/observations", json={"contenu": "Une observation malgré le verrou", "id_axe": axe["id_axe"]}, headers=headers
    )
    assert r.status_code == 201, r.text


def test_reflection_et_decision_non_bloquees_sur_axe_verrouille(client):
    headers = enregistrer_et_connecter(client, "m8ext3")
    _saison, axe = _creer_saison_avec_axe_verrouille(client, headers)
    r = client.post(
        "/bilans",
        json={"id_axe": axe["id_axe"], "remarque": "Réflexion malgré le verrou", "type_decision": "continuer"},
        headers=headers,
    )
    assert r.status_code == 201, r.text
    corps = r.json()
    assert corps["remarque"] is not None  # Reflection présente
    assert corps["type_decision"] == "continuer"  # Decision présente


# --- Tests F, G, H : Observation / Reflection / Decision sans dépendance semaine
def test_F_observation_sans_dependance_semaine(client):
    headers = enregistrer_et_connecter(client, "m8F")
    r = client.post("/observations", json={"contenu": "Observation libre, aucune semaine"}, headers=headers)
    assert r.status_code == 201, r.text


def test_G_reflection_sans_dependance_semaine(client):
    headers = enregistrer_et_connecter(client, "m8G")
    r = client.post("/bilans", json={"remarque": "Réflexion libre", "type_decision": "continuer"}, headers=headers)
    assert r.status_code == 201, r.text
    assert r.json()["semaine"] is None


def test_H_decision_sans_dependance_semaine(client):
    headers = enregistrer_et_connecter(client, "m8H")
    r = client.post("/bilans", json={"type_decision": "modifier"}, headers=headers)
    assert r.status_code == 201, r.text
    assert r.json()["semaine"] is None
    assert r.json()["type_decision"] == "modifier"


# --- Test I : Trajectory restitue les événements modernes --------------------
def test_I_trajectory_restitue_evenements_modernes(client):
    headers = enregistrer_et_connecter(client, "m8I")
    construction = client.post("/constructions", json={"nom": "Piano"}, headers=headers).json()
    client.post("/actions", json={"id_axe": construction["id_construction"], "contenu": "Test"}, headers=headers)

    r = client.get("/trajectory", headers=headers)
    assert r.status_code == 200, r.text
    types = [e["type"] for e in r.json()["items"]]
    assert "construction_created" not in types or "action" in types  # au moins l'Action doit apparaître
    assert any(e["type"] == "action" for e in r.json()["items"])


# --- Test J : donnée legacy avec semaine/jour reste lisible ------------------
def test_J_donnee_legacy_semaine_jour_reste_lisible(client):
    headers = enregistrer_et_connecter(client, "m8J")
    saison = client.post("/seasons", json={"nom": "Saison", "date_debut": "2026-09-01"}, headers=headers).json()
    axe = client.post(
        f"/programmes/{saison['id_saison']}/axes",
        json={"nom": "Axe legacy", "phase_deverrouillage": 1, "pilier": "corps"},
        headers=headers,
    ).json()
    r = client.put(f"/axes/{axe['id_axe']}/suivi/1/0", headers=headers)
    assert r.status_code == 200, r.text

    r = client.get(f"/programmes/{saison['id_saison']}/suivi?semaine=1", headers=headers)
    assert r.status_code == 200
    assert len(r.json()) == 1
    assert r.json()[0]["semaine"] == 1
    assert r.json()[0]["jour"] == 0


# --- Test K : anti-IDOR ---------------------------------------------------
def test_K_anti_idor_cross_user(client):
    headers_a = enregistrer_et_connecter(client, "m8Ka")
    headers_b = enregistrer_et_connecter(client, "m8Kb")

    construction_a = client.post("/constructions", json={"nom": "Piano A"}, headers=headers_a).json()
    engagement_a = client.post(
        f"/axes/{construction_a['id_construction']}/engagements",
        json={"description": "Test", "date_debut": "2026-09-01"},
        headers=headers_a,
    ).json()
    action_a = client.post("/actions", json={"id_axe": construction_a["id_construction"]}, headers=headers_a).json()

    assert client.get(f"/constructions/{construction_a['id_construction']}", headers=headers_b).status_code == 404
    assert client.get(f"/engagements/{engagement_a['id_engagement']}", headers=headers_b).status_code == 404
    assert client.get(f"/actions/{action_a['id_entree']}", headers=headers_b).status_code == 404
    assert client.get("/trajectory", headers=headers_b).json()["items"] == []


# --- Test L : Construction sans Season fonctionne toujours (bout en bout) ---
def test_L_construction_sans_season_fonctionne_toujours(client):
    headers = enregistrer_et_connecter(client, "m8L")
    construction = client.post("/constructions", json={"nom": "Écriture"}, headers=headers).json()
    engagement = client.post(
        f"/axes/{construction['id_construction']}/engagements",
        json={"description": "Écrire", "date_debut": "2026-09-01"},
        headers=headers,
    ).json()
    action = client.post(
        "/actions",
        json={"id_axe": construction["id_construction"], "id_engagement": engagement["id_engagement"]},
        headers=headers,
    ).json()
    client.post(
        "/observations",
        json={"contenu": "Observation", "id_entree": action["id_entree"]},
        headers=headers,
    )
    client.post(
        "/bilans", json={"id_axe": construction["id_construction"], "type_decision": "continuer"}, headers=headers
    )
    r = client.get("/trajectory", headers=headers)
    types = {e["type"] for e in r.json()["items"]}
    assert {"action", "observation", "decision"}.issubset(types)


# --- Test M : anciennes routes compatibles non cassées -----------------------
def test_M_anciennes_routes_non_cassees(client):
    headers = enregistrer_et_connecter(client, "m8M")
    assert client.get("/programmes", headers=headers).status_code == 200
    saison = client.post("/seasons", json={"nom": "Saison", "date_debut": "2026-09-01"}, headers=headers).json()
    assert client.get(f"/programmes/{saison['id_saison']}/axes", headers=headers).status_code == 200
    r = client.post(
        f"/programmes/{saison['id_saison']}/bilans", json={"semaine": 1, "decision": "avancer"}, headers=headers
    )
    assert r.status_code == 201, r.text
    # Mission 1.5b toujours intacte :
    assert client.get(f"/programmes/{saison['id_saison']}", headers=headers).json()["semaine_courante"] == 1


# --- Test N : aucun flux moderne ne nécessite semaine_courante ---------------
def test_N_aucun_flux_moderne_ne_necessite_semaine_courante(client):
    """
    Un utilisateur qui n'a JAMAIS créé de Saison (donc aucun
    semaine_courante n'existe nulle part pour lui) doit pouvoir dérouler
    l'intégralité de la chaîne moderne.
    """
    headers = enregistrer_et_connecter(client, "m8N")
    assert client.get("/seasons", headers=headers).json() == []

    construction = client.post("/constructions", json={"nom": "Piano"}, headers=headers).json()
    engagement = client.post(
        f"/axes/{construction['id_construction']}/engagements",
        json={"description": "Jouer", "date_debut": "2026-09-01"},
        headers=headers,
    ).json()
    action = client.post(
        "/actions",
        json={"id_axe": construction["id_construction"], "id_engagement": engagement["id_engagement"]},
        headers=headers,
    ).json()
    assert client.post(
        "/observations", json={"contenu": "Observation", "id_entree": action["id_entree"]}, headers=headers
    ).status_code == 201
    assert client.post(
        "/bilans", json={"id_axe": construction["id_construction"], "type_decision": "continuer"}, headers=headers
    ).status_code == 201
    assert client.get("/trajectory", headers=headers).status_code == 200
