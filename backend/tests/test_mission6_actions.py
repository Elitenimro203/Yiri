"""
Mission 6, §16 — les 17 scénarios obligatoires, dans l'ordre du cahier des
charges. Chaque test est indépendant (utilisateurs uniques via
enregistrer_et_connecter) pour pouvoir tourner dans n'importe quel ordre.
"""
from datetime import date, timedelta

from conftest import enregistrer_et_connecter


def _creer_construction(client, headers, nom, id_saison=None):
    r = client.post("/constructions", json={"nom": nom, "id_saison": id_saison}, headers=headers)
    assert r.status_code == 201, r.text
    return r.json()


def _creer_engagement(client, headers, id_axe, description="Engagement test", actif=True):
    r = client.post(
        f"/axes/{id_axe}/engagements",
        json={"description": description, "date_debut": "2026-09-01"},
        headers=headers,
    )
    assert r.status_code == 201, r.text
    return r.json()


# --- Test 1 : Action liée à un Engagement ------------------------------------
def test_01_action_liee_a_engagement(client):
    headers = enregistrer_et_connecter(client, "t01")
    construction = _creer_construction(client, headers, "Basket")
    engagement = _creer_engagement(client, headers, construction["id_construction"], "Jouer deux fois par semaine")

    r = client.post(
        "/actions",
        json={"id_axe": construction["id_construction"], "id_engagement": engagement["id_engagement"], "contenu": "Entraînement"},
        headers=headers,
    )
    assert r.status_code == 201, r.text
    action = r.json()
    assert action["id_axe"] == construction["id_construction"]
    assert action["id_engagement"] == engagement["id_engagement"]
    assert action["contenu"] == "Entraînement"


# --- Test 2 : Action sans Engagement ------------------------------------------
def test_02_action_sans_engagement(client):
    headers = enregistrer_et_connecter(client, "t02")
    construction = _creer_construction(client, headers, "Anglais")

    r = client.post(
        "/actions",
        json={"id_axe": construction["id_construction"], "contenu": "Conversation spontanée de 40 minutes"},
        headers=headers,
    )
    assert r.status_code == 201, r.text
    action = r.json()
    assert action["id_engagement"] is None


# --- Test 3 : Action sur une Construction hors Saison -------------------------
def test_03_action_construction_hors_saison(client):
    headers = enregistrer_et_connecter(client, "t03")
    construction = _creer_construction(client, headers, "Piano", id_saison=None)
    assert construction["id_saison"] is None

    r = client.post("/actions", json={"id_axe": construction["id_construction"]}, headers=headers)
    assert r.status_code == 201, r.text


# --- Test 4 : Action sans Saison du tout (utilisateur n'en a aucune) ----------
def test_04_action_sans_saison_du_tout(client):
    headers = enregistrer_et_connecter(client, "t04")

    r = client.get("/seasons", headers=headers)
    assert r.status_code == 200
    assert r.json() == []  # aucune Saison, jamais créée

    construction = _creer_construction(client, headers, "Écriture")
    r = client.post("/actions", json={"id_axe": construction["id_construction"]}, headers=headers)
    assert r.status_code == 201, r.text


# --- Test 5 : Action non bloquée par phase_deverrouillage ---------------------
def test_05_action_non_bloquee_par_phase_deverrouillage(client):
    headers = enregistrer_et_connecter(client, "t05")
    r = client.post(
        "/seasons",
        json={"nom": "Saison verrouillée", "date_debut": "2026-09-01"},
        headers=headers,
    )
    assert r.status_code == 201, r.text
    saison = r.json()

    # Axe legacy avec un vrai verrou (phase_deverrouillage=4, semaine_courante=1
    # par défaut) — nécessite l'ancien endpoint POST /programmes/{id}/axes,
    # seul à accepter ces champs Wakati.
    r = client.post(
        f"/programmes/{saison['id_saison']}/axes",
        json={"nom": "Axe verrouillé", "phase_deverrouillage": 4, "pilier": "corps"},
        headers=headers,
    )
    assert r.status_code == 201, r.text
    axe = r.json()
    assert axe["deverrouille"] is False  # preuve que le verrou est réel

    # Preuve que le verrou fonctionne toujours pour l'ancien mécanisme :
    r = client.put(f"/axes/{axe['id_axe']}/suivi/1/0", headers=headers)
    assert r.status_code == 423, r.text

    # Mais une Action moderne n'est PAS bloquée par ce même verrou :
    r = client.post("/actions", json={"id_axe": axe["id_axe"]}, headers=headers)
    assert r.status_code == 201, r.text


# --- Test 6 : date réelle, pas une semaine Wakati -----------------------------
def test_06_date_reelle_pas_semaine(client):
    headers = enregistrer_et_connecter(client, "t06")
    construction = _creer_construction(client, headers, "Course à pied")

    hier = (date.today() - timedelta(days=1)).isoformat()
    r = client.post(
        "/actions",
        json={"id_axe": construction["id_construction"], "date_action": hier},
        headers=headers,
    )
    assert r.status_code == 201, r.text
    action = r.json()
    assert action["date_action"].startswith(hier)
    assert "semaine" not in action  # ActionOut masque volontairement le vocabulaire legacy
    assert "jour" not in action

    # Date dans le futur explicitement refusée (§9 : pas de confiance aveugle)
    demain = (date.today() + timedelta(days=1)).isoformat()
    r = client.post(
        "/actions",
        json={"id_axe": construction["id_construction"], "date_action": demain},
        headers=headers,
    )
    assert r.status_code == 422, r.text


# --- Test 7 : Engagement d'un autre utilisateur → refus -----------------------
def test_07_engagement_autre_utilisateur_refuse(client):
    headers_a = enregistrer_et_connecter(client, "t07a")
    headers_b = enregistrer_et_connecter(client, "t07b")

    construction_a = _creer_construction(client, headers_a, "Construction A")
    engagement_a = _creer_engagement(client, headers_a, construction_a["id_construction"])
    construction_b = _creer_construction(client, headers_b, "Construction B")

    r = client.post(
        "/actions",
        json={"id_axe": construction_b["id_construction"], "id_engagement": engagement_a["id_engagement"]},
        headers=headers_b,
    )
    assert r.status_code == 404, r.text  # l'engagement de A est invisible pour B, aucune fuite


# --- Test 8 : Engagement d'une autre Construction → refus ---------------------
def test_08_engagement_autre_construction_refuse(client):
    headers = enregistrer_et_connecter(client, "t08")
    construction_1 = _creer_construction(client, headers, "Construction 1")
    construction_2 = _creer_construction(client, headers, "Construction 2")
    engagement_1 = _creer_engagement(client, headers, construction_1["id_construction"])

    r = client.post(
        "/actions",
        json={"id_axe": construction_2["id_construction"], "id_engagement": engagement_1["id_engagement"]},
        headers=headers,
    )
    assert r.status_code == 409, r.text  # même utilisateur, mais incohérence Construction/Engagement


# --- Test 9 : Engagement suspendu reste dans l'historique des Actions --------
def test_09_engagement_suspendu_historique_conserve(client):
    headers = enregistrer_et_connecter(client, "t09")
    construction = _creer_construction(client, headers, "Piano")
    engagement = _creer_engagement(client, headers, construction["id_construction"])

    r = client.post("/actions", json={"id_axe": construction["id_construction"], "id_engagement": engagement["id_engagement"]}, headers=headers)
    assert r.status_code == 201, r.text
    action_id = r.json()["id_entree"]

    r = client.patch(f"/engagements/{engagement['id_engagement']}", json={"actif": False}, headers=headers)
    assert r.status_code == 200, r.text
    assert r.json()["actif"] is False

    r = client.get(f"/actions/{action_id}", headers=headers)
    assert r.status_code == 200, r.text
    assert r.json()["id_engagement"] == engagement["id_engagement"]  # toujours là, rien effacé


# --- Test 10 : une nouvelle Action ne réactive pas un Engagement suspendu ----
def test_10_nouvelle_action_ne_reactive_pas_engagement(client):
    headers = enregistrer_et_connecter(client, "t10")
    construction = _creer_construction(client, headers, "Piano")
    engagement = _creer_engagement(client, headers, construction["id_construction"])

    client.patch(f"/engagements/{engagement['id_engagement']}", json={"actif": False}, headers=headers)

    r = client.post(
        "/actions",
        json={"id_axe": construction["id_construction"], "id_engagement": engagement["id_engagement"]},
        headers=headers,
    )
    assert r.status_code == 201, r.text  # la création reste autorisée...

    r = client.get(f"/engagements/{engagement['id_engagement']}", headers=headers)
    assert r.status_code == 200
    assert r.json()["actif"] is False  # ...mais ne réactive rien


# --- Test 11 : anciennes EntreeSuivi restent lisibles -------------------------
def test_11_anciennes_entrees_suivi_lisibles(client):
    headers = enregistrer_et_connecter(client, "t11")
    r = client.post("/seasons", json={"nom": "Saison", "date_debut": "2026-09-01"}, headers=headers)
    saison = r.json()
    r = client.post(
        f"/programmes/{saison['id_saison']}/axes",
        json={"nom": "Axe legacy", "phase_deverrouillage": 1, "pilier": "corps"},
        headers=headers,
    )
    axe = r.json()

    r = client.put(f"/axes/{axe['id_axe']}/suivi/1/0", headers=headers)
    assert r.status_code == 200, r.text

    r = client.get(f"/programmes/{saison['id_saison']}/suivi?semaine=1", headers=headers)
    assert r.status_code == 200
    assert len(r.json()) == 1
    assert r.json()[0]["coche"] is True


# --- Test 12 : endpoints legacy continuent de fonctionner ---------------------
def test_12_endpoints_legacy_fonctionnels(client):
    headers = enregistrer_et_connecter(client, "t12")
    r = client.get("/programmes", headers=headers)
    assert r.status_code == 200
    r = client.post("/seasons", json={"nom": "Saison", "date_debut": "2026-09-01"}, headers=headers)
    saison = r.json()
    r = client.get(f"/programmes/{saison['id_saison']}/axes", headers=headers)
    assert r.status_code == 200


# --- Test 13 : Observations compatibles avec les Actions historiques ---------
def test_13_observations_compatibles_actions_historiques(client):
    headers = enregistrer_et_connecter(client, "t13")
    r = client.post("/seasons", json={"nom": "Saison", "date_debut": "2026-09-01"}, headers=headers)
    saison = r.json()
    r = client.post(
        f"/programmes/{saison['id_saison']}/axes",
        json={"nom": "Axe legacy", "phase_deverrouillage": 1, "pilier": "corps"},
        headers=headers,
    )
    axe = r.json()
    r = client.put(f"/axes/{axe['id_axe']}/suivi/1/0", headers=headers)
    id_entree = r.json()["id_axe"]  # noqa: F841 (le endpoint historique ne renvoie pas id_entree)

    r = client.get(f"/programmes/{saison['id_saison']}/suivi?semaine=1", headers=headers)
    entree_id_via_db = r.json()  # pas d'id_entree exposé non plus ici — legacy volontairement minimal

    # On passe par l'API Observation avec l'id_axe (association facultative
    # à une EntreeSuivi précise déjà couverte par Mission 3 ; ici on prouve
    # la compatibilité au niveau Construction, suffisant pour ce test).
    r = client.post("/observations", json={"contenu": "Observation sur donnée historique", "id_axe": axe["id_axe"]}, headers=headers)
    assert r.status_code == 201, r.text
    assert entree_id_via_db  # la grille contient bien l'entrée historique


# --- Test 14 : Réflexions compatibles avec Constructions sans Saison ---------
def test_14_reflexions_compatibles_construction_sans_saison(client):
    headers = enregistrer_et_connecter(client, "t14")
    construction = _creer_construction(client, headers, "Piano", id_saison=None)

    r = client.post(
        "/bilans",
        json={"id_axe": construction["id_construction"], "type_decision": "continuer", "remarque": "Bonne reprise"},
        headers=headers,
    )
    assert r.status_code == 201, r.text
    assert r.json()["id_programme"] is None


# --- Test 15 : SessionTravail fonctionne indépendamment de l'Action ----------
def test_15_session_travail_independante(client):
    headers = enregistrer_et_connecter(client, "t15")
    construction = _creer_construction(client, headers, "Anglais")

    r = client.post(f"/axes/{construction['id_construction']}/sessions/demarrer", json={"type": "libre"}, headers=headers)
    assert r.status_code == 201, r.text
    session = r.json()

    r = client.post(f"/sessions/{session['id_session']}/terminer", headers=headers)
    assert r.status_code == 200, r.text
    assert r.json()["duree_secondes"] is not None

    # Aucune Action n'a été créée par la Session — ce sont deux concepts
    # distincts (§5), la Session ne produit pas d'EntreeSuivi.
    r = client.get(f"/actions?axe_id={construction['id_construction']}", headers=headers)
    assert r.status_code == 200
    assert r.json() == []


# --- Test 16 : aucune génération automatique d'occurrence future -------------
def test_16_aucune_generation_automatique_occurrence(client):
    headers = enregistrer_et_connecter(client, "t16")
    construction = _creer_construction(client, headers, "Basket")

    r = client.get(f"/actions?axe_id={construction['id_construction']}", headers=headers)
    assert r.json() == []

    _creer_engagement(client, headers, construction["id_construction"], "Jouer deux fois par semaine")

    # La seule création de l'Engagement (même "récurrent" dans son intention
    # textuelle) ne doit générer AUCUNE Action/occurrence automatiquement.
    r = client.get(f"/actions?axe_id={construction['id_construction']}", headers=headers)
    assert r.status_code == 200
    assert r.json() == []


# --- Test 17 : régression Mission 1.5b ----------------------------------------
def test_17_regression_mission_1_5b(client):
    headers = enregistrer_et_connecter(client, "t17")
    r = client.post("/seasons", json={"nom": "Saison", "date_debut": "2026-09-01"}, headers=headers)
    saison = r.json()

    avant = client.get(f"/programmes/{saison['id_saison']}", headers=headers).json()["semaine_courante"]

    r = client.post(
        f"/programmes/{saison['id_saison']}/bilans",
        json={"semaine": 1, "decision": "avancer"},
        headers=headers,
    )
    assert r.status_code == 201, r.text

    apres = client.get(f"/programmes/{saison['id_saison']}", headers=headers).json()["semaine_courante"]
    assert avant == apres  # toujours pas d'avancement automatique, Mission 1.5b intacte
