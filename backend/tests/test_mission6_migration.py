"""
Mission 6, §17 — test de migration sur une base SQLite réaliste contenant des
données pré-Mission-6.

Le schéma est reconstruit À LA MAIN ici (pas via les modèles SQLAlchemy
actuels, qui sont déjà à jour) : c'est le seul moyen de reproduire fidèlement
l'état d'une base réellement déployée avant cette mission, avec ses
contraintes NOT NULL historiques sur entrees_suivi.semaine/jour.

Vérifie : aucun historique perdu, aucune relation cassée, aucun ID changé,
aucune fausse date inventée, anciennes données toujours accessibles, et
nouvelles Actions fonctionnelles sur la base migrée.
"""
import sqlite3
from pathlib import Path

import pytest
from sqlalchemy import create_engine, inspect

SCHEMA_PRE_MISSION6 = """
CREATE TABLE utilisateurs (
    id_utilisateur INTEGER PRIMARY KEY,
    email VARCHAR(150) UNIQUE NOT NULL,
    mot_de_passe_hash VARCHAR(255) NOT NULL,
    nom VARCHAR(100) NOT NULL,
    date_creation DATETIME NOT NULL
);
CREATE TABLE programmes (
    id_programme INTEGER PRIMARY KEY,
    id_utilisateur INTEGER NOT NULL REFERENCES utilisateurs(id_utilisateur),
    nom VARCHAR(100) NOT NULL,
    date_debut DATE NOT NULL,
    mode_progression VARCHAR(10) NOT NULL,
    semaine_courante INTEGER NOT NULL,
    statut VARCHAR(10) NOT NULL,
    mode_deverrouillage VARCHAR(12) NOT NULL,
    intention TEXT,
    date_fin DATE
);
CREATE TABLE axes (
    id_axe INTEGER PRIMARY KEY,
    id_programme INTEGER REFERENCES programmes(id_programme),
    id_utilisateur INTEGER REFERENCES utilisateurs(id_utilisateur),
    nom VARCHAR(100) NOT NULL,
    phase_deverrouillage INTEGER,
    ordre_affichage INTEGER NOT NULL,
    pilier VARCHAR(10),
    jours_actifs VARCHAR(20),
    intention TEXT,
    status VARCHAR(20),
    date_creation DATETIME
);
CREATE TABLE engagements (
    id_engagement INTEGER PRIMARY KEY,
    id_axe INTEGER NOT NULL REFERENCES axes(id_axe),
    description TEXT NOT NULL,
    type VARCHAR(9) NOT NULL,
    date_debut DATE NOT NULL,
    date_fin DATE,
    actif BOOLEAN NOT NULL
);
-- entrees_suivi AVANT Mission 6 : semaine/jour NOT NULL, pas de
-- date_action ni contenu. C'est précisément ce que la migration doit
-- assouplir et enrichir.
CREATE TABLE entrees_suivi (
    id_entree INTEGER PRIMARY KEY,
    id_axe INTEGER NOT NULL REFERENCES axes(id_axe),
    id_engagement INTEGER REFERENCES engagements(id_engagement),
    semaine INTEGER NOT NULL,
    jour INTEGER NOT NULL,
    coche BOOLEAN NOT NULL,
    date_coche DATETIME,
    CONSTRAINT uq_entree_axe_semaine_jour UNIQUE (id_axe, semaine, jour)
);
CREATE TABLE observations (
    id_observation INTEGER PRIMARY KEY,
    id_utilisateur INTEGER NOT NULL REFERENCES utilisateurs(id_utilisateur),
    id_axe INTEGER REFERENCES axes(id_axe),
    id_entree INTEGER REFERENCES entrees_suivi(id_entree),
    contenu TEXT NOT NULL,
    date_creation DATETIME NOT NULL
);
CREATE TABLE bilans (
    id_bilan INTEGER PRIMARY KEY,
    id_programme INTEGER REFERENCES programmes(id_programme),
    id_utilisateur INTEGER REFERENCES utilisateurs(id_utilisateur),
    id_axe INTEGER REFERENCES axes(id_axe),
    semaine INTEGER,
    score_snapshot INTEGER,
    quoi_a_marche TEXT,
    quoi_n_a_pas_marche TEXT,
    ajustement_semaine_suivante TEXT,
    remarque TEXT,
    comprehension TEXT,
    decision VARCHAR(10),
    type_decision VARCHAR(30),
    date_creation DATETIME NOT NULL
);
CREATE TABLE sessions_travail (
    id_session INTEGER PRIMARY KEY,
    id_utilisateur INTEGER NOT NULL REFERENCES utilisateurs(id_utilisateur),
    id_axe INTEGER NOT NULL REFERENCES axes(id_axe),
    type VARCHAR(8) NOT NULL,
    date_debut DATETIME NOT NULL,
    date_fin DATETIME,
    duree_secondes INTEGER,
    duree_focus_minutes INTEGER,
    duree_pause_minutes INTEGER
);
CREATE TABLE notifications (
    id_notification INTEGER PRIMARY KEY,
    id_utilisateur INTEGER NOT NULL REFERENCES utilisateurs(id_utilisateur),
    id_axe INTEGER REFERENCES axes(id_axe),
    libelle VARCHAR(100) NOT NULL,
    heure TIME NOT NULL,
    jours_actifs VARCHAR(20) NOT NULL,
    actif BOOLEAN NOT NULL
);
CREATE TABLE push_subscriptions (
    id_subscription INTEGER PRIMARY KEY,
    id_utilisateur INTEGER NOT NULL REFERENCES utilisateurs(id_utilisateur),
    endpoint TEXT NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    date_creation DATETIME NOT NULL
);
"""

DONNEES = [
    ("INSERT INTO utilisateurs VALUES (1, 'ancien@yiri.test', 'hash', 'Ancien', '2026-01-01T00:00:00')",),
    ("INSERT INTO programmes VALUES (1, 1, 'Vieux programme', '2026-01-01', 'manuel', 2, 'actif', 'progressif', NULL, NULL)",),
    ("INSERT INTO axes VALUES (1, 1, NULL, 'Sommeil', 1, 1, 'corps', NULL, NULL, NULL, NULL)",),
    ("INSERT INTO axes VALUES (2, 1, NULL, 'Lecture', 2, 2, 'esprit', '1,3,5', NULL, NULL, NULL)",),
    ("INSERT INTO engagements VALUES (1, 1, 'Dormir avant 23h', 'recurrent', '2026-01-01', NULL, 1)",),
    # Entrée cochée AVEC date_coche (date réelle disponible)
    ("INSERT INTO entrees_suivi VALUES (1, 1, 1, 1, 0, 1, '2026-01-05T08:00:00')",),
    # Entrée cochée SANS date_coche (aucune date réelle connue — la migration
    # ne doit surtout pas en inventer une)
    ("INSERT INTO entrees_suivi VALUES (2, 2, NULL, 1, 2, 1, NULL)",),
    # Entrée décochée
    ("INSERT INTO entrees_suivi VALUES (3, 1, NULL, 2, 1, 0, NULL)",),
    ("INSERT INTO observations VALUES (1, 1, 1, 1, 'Mieux dormi cette semaine', '2026-01-06T09:00:00')",),
    ("INSERT INTO bilans VALUES (1, 1, NULL, NULL, 1, 42, 'ok', NULL, NULL, NULL, NULL, 'avancer', NULL, '2026-01-08T00:00:00')",),
    ("INSERT INTO sessions_travail VALUES (1, 1, 1, 'libre', '2026-01-05T07:00:00', '2026-01-05T07:30:00', 1800, NULL, NULL)",),
    ("INSERT INTO notifications VALUES (1, 1, 1, 'Rappel sommeil', '22:30:00', '1,2,3,4,5', 1)",),
    ("INSERT INTO push_subscriptions VALUES (1, 1, 'https://push.example/1', 'p256', 'auth', '2026-01-01T00:00:00')",),
]


@pytest.fixture
def base_pre_mission6(tmp_path: Path) -> Path:
    chemin = tmp_path / "pre_mission6.db"
    con = sqlite3.connect(chemin)
    con.executescript(SCHEMA_PRE_MISSION6)
    for (requete,) in DONNEES:
        con.execute(requete)
    con.commit()
    con.close()
    return chemin


def test_migration_preserve_integralement_lhistorique(base_pre_mission6: Path):
    from app.core.migrations import faire_evoluer_entrees_suivi_vers_action

    engine = create_engine(f"sqlite:///{base_pre_mission6}")

    # --- état AVANT migration -------------------------------------------------
    inspecteur = inspect(engine)
    colonnes_avant = {c["name"]: c for c in inspecteur.get_columns("entrees_suivi")}
    assert "date_action" not in colonnes_avant
    assert colonnes_avant["semaine"]["nullable"] is False  # NOT NULL historique
    assert colonnes_avant["jour"]["nullable"] is False

    con = sqlite3.connect(base_pre_mission6)
    lignes_avant = con.execute(
        "SELECT id_entree, id_axe, id_engagement, semaine, jour, coche, date_coche "
        "FROM entrees_suivi ORDER BY id_entree"
    ).fetchall()
    autres_tables = [
        "utilisateurs", "programmes", "axes", "engagements",
        "observations", "bilans", "sessions_travail", "notifications", "push_subscriptions",
    ]
    # Snapshot ligne par ligne (pas seulement un COUNT) des tables que cette
    # migration ne doit PAS toucher — une migration qui modifierait
    # silencieusement une autre table serait détectée ici.
    snapshot_avant = {
        table: con.execute(f"SELECT * FROM {table}").fetchall() for table in autres_tables
    }
    comptes_avant = {
        table: con.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
        for table in autres_tables + ["entrees_suivi"]
    }
    con.close()

    # --- migration ------------------------------------------------------------
    faire_evoluer_entrees_suivi_vers_action(engine)

    # --- état APRÈS migration -------------------------------------------------
    inspecteur = inspect(engine)
    colonnes_apres = {c["name"]: c for c in inspecteur.get_columns("entrees_suivi")}
    assert "date_action" in colonnes_apres
    assert "contenu" in colonnes_apres
    assert colonnes_apres["semaine"]["nullable"] is True  # assoupli
    assert colonnes_apres["jour"]["nullable"] is True

    con = sqlite3.connect(base_pre_mission6)

    # Aucun historique perdu, aucun ID changé : lignes identiques à l'octet près
    lignes_apres = con.execute(
        "SELECT id_entree, id_axe, id_engagement, semaine, jour, coche, date_coche "
        "FROM entrees_suivi ORDER BY id_entree"
    ).fetchall()
    assert lignes_apres == lignes_avant

    # Aucune fausse date inventée : date_action reste NULL pour TOUT l'historique,
    # y compris pour l'entrée qui possédait pourtant une date_coche exploitable
    # (§9 : ne pas fabriquer de fausse précision, ne pas rétro-remplir).
    dates_action = con.execute("SELECT date_action FROM entrees_suivi").fetchall()
    assert all(d[0] is None for d in dates_action)
    contenus = con.execute("SELECT contenu FROM entrees_suivi").fetchall()
    assert all(c[0] is None for c in contenus)

    # Aucune relation cassée : les autres tables sont intactes, et les FK
    # pointant vers entrees_suivi (observations.id_entree) restent valides.
    comptes_apres = {
        table: con.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
        for table in comptes_avant
    }
    assert comptes_apres == comptes_avant

    # Les autres tables sont strictement identiques, ligne par ligne.
    snapshot_apres = {
        table: con.execute(f"SELECT * FROM {table}").fetchall() for table in snapshot_avant
    }
    for table in snapshot_avant:
        assert snapshot_apres[table] == snapshot_avant[table], (
            f"table {table} modifiée par une migration qui ne devait pas la toucher"
        )

    obs = con.execute("SELECT id_entree FROM observations WHERE id_observation = 1").fetchone()
    assert obs[0] == 1
    entree_liee = con.execute("SELECT id_axe FROM entrees_suivi WHERE id_entree = 1").fetchone()
    assert entree_liee is not None  # la relation Observation → EntreeSuivi tient toujours

    violations = con.execute("PRAGMA foreign_key_check").fetchall()
    assert violations == []

    # Les nouvelles Actions fonctionnent sur la base migrée : semaine/jour NULL
    # est désormais accepté, et plusieurs Actions modernes peuvent coexister
    # sur le même axe sans collision avec la contrainte UNIQUE historique.
    con.execute(
        "INSERT INTO entrees_suivi (id_axe, id_engagement, semaine, jour, coche, date_action, contenu) "
        "VALUES (1, 1, NULL, NULL, 1, '2026-09-14T10:00:00', 'Action moderne 1')"
    )
    con.execute(
        "INSERT INTO entrees_suivi (id_axe, id_engagement, semaine, jour, coche, date_action, contenu) "
        "VALUES (1, NULL, NULL, NULL, 1, '2026-09-15T10:00:00', 'Action moderne 2')"
    )
    con.commit()
    assert con.execute("SELECT COUNT(*) FROM entrees_suivi WHERE date_action IS NOT NULL").fetchone()[0] == 2
    con.close()


def test_migration_est_idempotente(base_pre_mission6: Path):
    from app.core.migrations import faire_evoluer_entrees_suivi_vers_action

    engine = create_engine(f"sqlite:///{base_pre_mission6}")
    faire_evoluer_entrees_suivi_vers_action(engine)

    con = sqlite3.connect(base_pre_mission6)
    lignes_apres_1 = con.execute("SELECT * FROM entrees_suivi ORDER BY id_entree").fetchall()
    con.close()

    # Deuxième appel (comme à chaque redémarrage de l'app) : sans effet.
    faire_evoluer_entrees_suivi_vers_action(engine)

    con = sqlite3.connect(base_pre_mission6)
    lignes_apres_2 = con.execute("SELECT * FROM entrees_suivi ORDER BY id_entree").fetchall()
    con.close()
    assert lignes_apres_1 == lignes_apres_2
