"""
Mission 7, §18 — les 28 scénarios obligatoires, regroupés par catégorie
(Ownership / Sources / Dates / Legacy / Projection) comme dans le cahier des
charges.
"""
from datetime import date, timedelta

from conftest import enregistrer_et_connecter


def _creer_saison(client, headers, nom="Saison", date_debut="2026-09-01", **kwargs):
    payload = {"nom": nom, "date_debut": date_debut, **kwargs}
    r = client.post("/seasons", json=payload, headers=headers)
    assert r.status_code == 201, r.text
    return r.json()


def _creer_construction(client, headers, nom, id_saison=None):
    r = client.post("/constructions", json={"nom": nom, "id_saison": id_saison}, headers=headers)
    assert r.status_code == 201, r.text
    return r.json()


def _creer_action(client, headers, id_axe, **kwargs):
    r = client.post("/actions", json={"id_axe": id_axe, **kwargs}, headers=headers)
    assert r.status_code == 201, r.text
    return r.json()


def _trajectoire(client, headers, **params):
    r = client.get("/trajectory", params=params, headers=headers)
    assert r.status_code == 200, r.text
    return r.json()


def _types(page):
    return [e["type"] for e in page["items"]]


# =========================================================================
# OWNERSHIP (1-4)
# =========================================================================

def test_01_utilisateur_voit_ses_evenements(client):
    headers = enregistrer_et_connecter(client, "t01")
    _creer_saison(client, headers)
    page = _trajectoire(client, headers)
    assert page["total"] >= 1
    assert "season_started" in _types(page)


def test_02_utilisateur_ne_voit_pas_ceux_dun_autre(client):
    headers_a = enregistrer_et_connecter(client, "t02a")
    headers_b = enregistrer_et_connecter(client, "t02b")
    _creer_saison(client, headers_a, nom="Saison privée A")

    page_b = _trajectoire(client, headers_b)
    titres_b = [e["title"] for e in page_b["items"]]
    assert "Saison commencée : Saison privée A" not in titres_b


def test_03_filtre_saison_respecte_ownership(client):
    headers_a = enregistrer_et_connecter(client, "t03a")
    headers_b = enregistrer_et_connecter(client, "t03b")
    saison_a = _creer_saison(client, headers_a)

    # B filtre sur la Saison de A : liste vide, jamais une fuite ni un 404
    # qui confirmerait l'existence de l'ID chez A (§10).
    page = _trajectoire(client, headers_b, season_id=saison_a["id_saison"])
    assert page["items"] == []
    assert page["total"] == 0


def test_04_filtre_construction_respecte_ownership(client):
    headers_a = enregistrer_et_connecter(client, "t04a")
    headers_b = enregistrer_et_connecter(client, "t04b")
    construction_a = _creer_construction(client, headers_a, "Construction A")

    page = _trajectoire(client, headers_b, construction_id=construction_a["id_construction"])
    assert page["items"] == []


# =========================================================================
# SOURCES (5-16)
# =========================================================================

def test_05_saison_creee_donne_season_started(client):
    headers = enregistrer_et_connecter(client, "t05")
    saison = _creer_saison(client, headers, nom="Reconstruction")
    page = _trajectoire(client, headers)
    evt = next(e for e in page["items"] if e["type"] == "season_started")
    assert evt["title"] == "Saison commencée : Reconstruction"
    assert evt["season"]["id_saison"] == saison["id_saison"]


def test_06_construction_creee_donne_construction_created(client):
    headers = enregistrer_et_connecter(client, "t06")
    construction = _creer_construction(client, headers, "Écriture")
    page = _trajectoire(client, headers)
    evt = next(e for e in page["items"] if e["type"] == "construction_created")
    assert evt["title"] == "Construction créée : Écriture"
    assert evt["construction"]["id_construction"] == construction["id_construction"]


def test_07_action_moderne_donne_action(client):
    headers = enregistrer_et_connecter(client, "t07")
    construction = _creer_construction(client, headers, "Course")
    _creer_action(client, headers, construction["id_construction"], date_action="2026-09-10", contenu="5 km")
    page = _trajectoire(client, headers)
    evt = next(e for e in page["items"] if e["type"] == "action")
    assert evt["content"] == "5 km"
    assert evt["date"].startswith("2026-09-10")


def test_08_action_legacy_avec_date_coche_donne_action_historique(client):
    headers = enregistrer_et_connecter(client, "t08")
    saison = _creer_saison(client, headers)
    axe = client.post(
        f"/programmes/{saison['id_saison']}/axes",
        json={"nom": "Axe legacy", "phase_deverrouillage": 1, "pilier": "corps"},
        headers=headers,
    ).json()
    r = client.put(f"/axes/{axe['id_axe']}/suivi/1/0", headers=headers)
    assert r.status_code == 200

    page = _trajectoire(client, headers)
    evt = next(e for e in page["items"] if e["type"] == "action" and e["source_type"] == "entree_suivi")
    assert evt["date"] is not None  # vient de date_coche, jamais de semaine/jour


def test_09_observation_donne_observation(client):
    headers = enregistrer_et_connecter(client, "t09")
    construction = _creer_construction(client, headers, "Piano")
    client.post(
        "/observations", json={"contenu": "Je progresse le soir", "id_axe": construction["id_construction"]},
        headers=headers,
    )
    page = _trajectoire(client, headers)
    evt = next(e for e in page["items"] if e["type"] == "observation")
    assert evt["content"] == "Je progresse le soir"
    assert evt["construction"]["id_construction"] == construction["id_construction"]


def test_10_reflection_moderne(client):
    headers = enregistrer_et_connecter(client, "t10")
    # Une reflection SANS decision n'est possible que via l'ancien endpoint
    # imbriqué : ReflexionCreate (POST /bilans libre) exige type_decision
    # par construction (Mission 4, schemas/bilan.py) — choix architectural
    # délibéré, pas une limitation de cette mission.
    saison = _creer_saison(client, headers)
    r = client.post(
        f"/programmes/{saison['id_saison']}/bilans",
        json={"semaine": 1, "decision": "consolider", "remarque": "Je remarque X"},
        headers=headers,
    )
    assert r.status_code == 201, r.text
    page = _trajectoire(client, headers)
    reflections = [e for e in page["items"] if e["type"] == "reflection"]
    assert len(reflections) == 1
    assert reflections[0]["content"] == "Je remarque X"


def test_11_decision_moderne(client):
    headers = enregistrer_et_connecter(client, "t11")
    client.post("/bilans", json={"type_decision": "modifier"}, headers=headers)
    page = _trajectoire(client, headers)
    decisions = [e for e in page["items"] if e["type"] == "decision"]
    assert len(decisions) == 1
    assert decisions[0]["content"] == "modifier"


def test_12_reflection_sans_decision(client):
    headers = enregistrer_et_connecter(client, "t12")
    saison = _creer_saison(client, headers)
    r = client.post(
        f"/programmes/{saison['id_saison']}/bilans",
        json={"semaine": 1, "decision": "consolider", "comprehension": "Je comprends Y"},
        headers=headers,
    )
    assert r.status_code == 201, r.text
    page = _trajectoire(client, headers)
    assert len(page["items"]) == 2  # season_started + reflection (pas de decision : type_decision absent)
    assert {e["type"] for e in page["items"]} == {"season_started", "reflection"}


def test_13_decision_sans_reflection(client):
    headers = enregistrer_et_connecter(client, "t13")
    client.post("/bilans", json={"type_decision": "continuer"}, headers=headers)
    page = _trajectoire(client, headers)
    assert len(page["items"]) == 1
    assert page["items"][0]["type"] == "decision"


def test_14_reflection_decision_libres_sans_saison(client):
    headers = enregistrer_et_connecter(client, "t14")
    r = client.post(
        "/bilans", json={"remarque": "R libre", "type_decision": "suspendre"}, headers=headers
    )
    assert r.status_code == 201, r.text
    page = _trajectoire(client, headers)
    reflection = next(e for e in page["items"] if e["type"] == "reflection")
    decision = next(e for e in page["items"] if e["type"] == "decision")
    assert reflection["season"] is None
    assert decision["season"] is None


def test_15_construction_sans_saison_action_evenement(client):
    headers = enregistrer_et_connecter(client, "t15")
    construction = _creer_construction(client, headers, "Piano libre", id_saison=None)
    _creer_action(client, headers, construction["id_construction"])
    page = _trajectoire(client, headers)
    evt = next(e for e in page["items"] if e["type"] == "action")
    assert evt["season"] is None
    assert evt["construction"]["nom"] == "Piano libre"


def test_16_construction_sans_saison_action_observation_evenements(client):
    headers = enregistrer_et_connecter(client, "t16")
    construction = _creer_construction(client, headers, "Piano libre 2", id_saison=None)
    action = _creer_action(client, headers, construction["id_construction"])
    client.post(
        "/observations", json={"contenu": "note", "id_entree": action["id_entree"]}, headers=headers
    )
    page = _trajectoire(client, headers)
    obs = next(e for e in page["items"] if e["type"] == "observation")
    assert obs["season"] is None
    assert obs["construction"]["id_construction"] == construction["id_construction"]


# =========================================================================
# DATES (17-20)
# =========================================================================

def test_17_aucune_date_inventee(client):
    headers = enregistrer_et_connecter(client, "t17")
    saison = _creer_saison(client, headers)  # pas de date_fin fournie
    page = _trajectoire(client, headers)
    assert "season_ended" not in _types(page)
    evt = next(e for e in page["items"] if e["type"] == "season_started")
    assert evt["date"].startswith(saison["date_debut"])


def test_18_date_fin_uniquement_si_explicite(client):
    headers = enregistrer_et_connecter(client, "t18")
    saison = _creer_saison(client, headers)
    client.patch(f"/seasons/{saison['id_saison']}", json={"date_fin": "2026-09-20"}, headers=headers)
    page = _trajectoire(client, headers)
    evt = next(e for e in page["items"] if e["type"] == "season_ended")
    assert evt["date"].startswith("2026-09-20")


def test_19_statut_courant_construction_ne_produit_pas_evenement_date(client):
    headers = enregistrer_et_connecter(client, "t19")
    construction = _creer_construction(client, headers, "Sport")
    client.post(f"/constructions/{construction['id_construction']}/pause", headers=headers)
    page = _trajectoire(client, headers)
    # Un seul événement pour cette Construction : sa création. Le passage en
    # pause n'a produit aucun événement daté fabriqué.
    evts_construction = [
        e for e in page["items"]
        if e["construction"] and e["construction"]["id_construction"] == construction["id_construction"]
    ]
    assert len(evts_construction) == 1
    assert evts_construction[0]["type"] == "construction_created"


def test_20_aucun_evenement_de_statut_sans_date_historique(client):
    headers = enregistrer_et_connecter(client, "t20")
    construction = _creer_construction(client, headers, "Anglais")
    for action_statut in ["pause", "reprendre", "terminer", "abandonner"]:
        client.post(f"/constructions/{construction['id_construction']}/{action_statut}", headers=headers)
    page = _trajectoire(client, headers)
    types_presents = {e["type"] for e in page["items"]}
    assert not any(t.startswith("construction_") and t != "construction_created" for t in types_presents)


# =========================================================================
# LEGACY (21-23)
# =========================================================================

def test_21_anciennes_actions_restent_lisibles(client):
    headers = enregistrer_et_connecter(client, "t21")
    saison = _creer_saison(client, headers)
    axe = client.post(
        f"/programmes/{saison['id_saison']}/axes",
        json={"nom": "Axe legacy 21", "phase_deverrouillage": 1, "pilier": "corps"},
        headers=headers,
    ).json()
    client.put(f"/axes/{axe['id_axe']}/suivi/1/0", headers=headers)

    r = client.get(f"/programmes/{saison['id_saison']}/suivi?semaine=1", headers=headers)
    assert r.status_code == 200
    assert len(r.json()) == 1  # l'ancien endpoint fonctionne toujours (Mission 6 inchangée)


def test_22_anciens_bilans_non_transformes_en_reflection(client):
    headers = enregistrer_et_connecter(client, "t22")
    saison = _creer_saison(client, headers)
    r = client.post(
        f"/programmes/{saison['id_saison']}/bilans",
        json={"semaine": 1, "decision": "avancer"},  # bilan purement legacy
        headers=headers,
    )
    assert r.status_code == 201, r.text
    page = _trajectoire(client, headers)
    assert "reflection" not in _types(page)
    assert "decision" not in _types(page)


def test_23_champs_legacy_pas_reference_temporelle(client):
    headers = enregistrer_et_connecter(client, "t23")
    saison = _creer_saison(client, headers)
    axe = client.post(
        f"/programmes/{saison['id_saison']}/axes",
        json={"nom": "Axe legacy 23", "phase_deverrouillage": 1, "pilier": "corps"},
        headers=headers,
    ).json()
    client.put(f"/axes/{axe['id_axe']}/suivi/1/0", headers=headers)
    page = _trajectoire(client, headers)
    evt = next(e for e in page["items"] if e["type"] == "action")
    assert "semaine" not in evt
    assert "jour" not in evt


# =========================================================================
# PROJECTION (24-28)
# =========================================================================

def test_24_evenements_tries_correctement(client):
    headers = enregistrer_et_connecter(client, "t24")
    construction = _creer_construction(client, headers, "Tri")
    _creer_action(client, headers, construction["id_construction"], date_action="2026-09-05")
    _creer_action(client, headers, construction["id_construction"], date_action="2026-09-15")
    _creer_action(client, headers, construction["id_construction"], date_action="2026-09-10")
    page = _trajectoire(client, headers)
    dates = [e["date"][:10] for e in page["items"] if e["type"] == "action"]
    assert dates == sorted(dates, reverse=True)  # DESC


def test_25_pagination_correcte(client):
    headers = enregistrer_et_connecter(client, "t25")
    construction = _creer_construction(client, headers, "Pagination")
    for i in range(5):
        jour = (date(2026, 9, 1) + timedelta(days=i)).isoformat()
        _creer_action(client, headers, construction["id_construction"], date_action=jour)

    page1 = _trajectoire(client, headers, limit=2, offset=0)
    page2 = _trajectoire(client, headers, limit=2, offset=2)
    assert len(page1["items"]) == 2
    assert len(page2["items"]) == 2
    assert page1["total"] == page2["total"] == 6  # 5 actions + 1 construction_created
    # Identité réelle d'un événement = (type, source_type, source_id) — un
    # Axe et une EntreeSuivi ont des séquences d'auto-incrément indépendantes
    # et peuvent légitimement partager le même id brut ; comparer seulement
    # source_id donnerait de faux positifs de doublon entre pages.
    cles_page1 = {(e["type"], e["source_type"], e["source_id"]) for e in page1["items"]}
    cles_page2 = {(e["type"], e["source_type"], e["source_id"]) for e in page2["items"]}
    assert cles_page1.isdisjoint(cles_page2)  # pas de doublon entre pages


def test_26_filtres_corrects(client):
    headers = enregistrer_et_connecter(client, "t26")
    c1 = _creer_construction(client, headers, "Filtre A")
    c2 = _creer_construction(client, headers, "Filtre B")
    _creer_action(client, headers, c1["id_construction"])
    _creer_action(client, headers, c2["id_construction"])

    page = _trajectoire(client, headers, construction_id=c1["id_construction"])
    for e in page["items"]:
        assert e["construction"]["id_construction"] == c1["id_construction"]


def test_27_aucune_duplication_inattendue(client):
    headers = enregistrer_et_connecter(client, "t27")
    construction = _creer_construction(client, headers, "Dup")
    _creer_action(client, headers, construction["id_construction"])
    page = _trajectoire(client, headers, limit=200)
    cles = [(e["type"], e["source_type"], e["source_id"]) for e in page["items"]]
    assert len(cles) == len(set(cles))


def test_28_action_groupable_reste_individuellement_accessible(client):
    """
    Le regroupement visuel (§9) est un choix de présentation frontend — la
    projection API renvoie toujours les Actions comme événements individuels,
    jamais pré-agrégés, condition nécessaire pour qu'un frontend puisse les
    afficher groupées puis dépliées sans perte d'information.
    """
    headers = enregistrer_et_connecter(client, "t28")
    construction = _creer_construction(client, headers, "Groupable")
    a1 = _creer_action(client, headers, construction["id_construction"], date_action="2026-09-12", contenu="Une")
    a2 = _creer_action(client, headers, construction["id_construction"], date_action="2026-09-12", contenu="Deux")
    page = _trajectoire(client, headers)
    actions = [e for e in page["items"] if e["type"] == "action"]
    assert len(actions) == 2  # jamais fusionnées côté données
    ids = {e["source_id"] for e in actions}
    assert ids == {a1["id_entree"], a2["id_entree"]}
