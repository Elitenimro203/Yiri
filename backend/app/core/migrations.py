"""
Mécanisme de migration minimal pour les colonnes ajoutées à une table déjà
existante.

Le projet n'utilise pas Alembic : `Base.metadata.create_all()` (voir main.py)
crée les tables absentes au démarrage, mais ne modifie JAMAIS une table déjà
créée. C'est un problème pour Mission 2, qui ajoute une colonne nullable
`id_engagement` à `entrees_suivi` — une table Wakati historique qui existe
déjà chez tout déploiement en cours.

Ce module fait une seule chose, de la façon la plus prudente possible :
ajouter cette colonne si elle n'existe pas encore, sans jamais toucher aux
lignes existantes (NULL par défaut — RG Mission 2 : ne pas obliger
rétroactivement les entrées historiques à posséder un engagement).

Ne PAS enrichir ce module en mécanisme de migration général — s'il faut un
jour gérer plusieurs migrations manuelles, Alembic devient le bon outil,
pas l'extension de ce fichier.
"""
from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine


def ajouter_id_engagement_sur_entrees_suivi(engine: Engine) -> None:
    """
    Idempotent : sans effet si la colonne existe déjà (donc sûr à appeler à
    chaque démarrage, comme create_all()). Doit être appelé APRÈS
    Base.metadata.create_all() pour que la table `engagements` (référencée
    par la contrainte de clé étrangère) existe déjà.
    """
    inspecteur = inspect(engine)
    colonnes_existantes = {c["name"] for c in inspecteur.get_columns("entrees_suivi")}
    if "id_engagement" in colonnes_existantes:
        return

    with engine.begin() as connexion:
        connexion.execute(
            text(
                "ALTER TABLE entrees_suivi "
                "ADD COLUMN id_engagement INTEGER REFERENCES engagements(id_engagement)"
            )
        )


def faire_evoluer_bilans_vers_reflexion(engine: Engine) -> None:
    """
    Mission 4 — fait évoluer `bilans` (table Wakati historique) vers le
    modèle Réflexion : ajoute des colonnes nullables (id_utilisateur, id_axe,
    remarque, comprehension, type_decision) ET assouplit en nullable des
    colonnes qui étaient NOT NULL (id_programme, semaine, score_snapshot,
    decision) — nécessaire pour qu'une Réflexion libre (sans Programme ni
    semaine, voir §5/§11) puisse exister dans la même table. Idempotent :
    sans effet si la migration a déjà été appliquée.

    Rien n'est perdu : chaque ligne existante est recopiée telle quelle, les
    nouvelles colonnes valent NULL pour tout l'historique (voir §5 : ne pas
    rétro-remplir id_utilisateur, il se déduit via Bilan → Programme →
    Utilisateur pour les anciennes lignes, voir _get_bilan_ou_404).

    Deux chemins selon le moteur, car SQLite ne sait pas faire un simple
    "ALTER COLUMN ... DROP NOT NULL" (aucune syntaxe équivalente n'existe) :
    - PostgreSQL : ALTER COLUMN direct, sans reconstruction de table ;
    - SQLite : reconstruction complète de la table (méthode officiellement
      recommandée par la documentation SQLite pour ce cas — pas un
      contournement risqué), en s'appuyant sur `Bilan.__table__` (déjà à jour
      avec le nouveau schéma) comme unique source de vérité pour la nouvelle
      structure, plutôt que de dupliquer le DDL à la main.
    """
    inspecteur = inspect(engine)
    colonnes_existantes = {c["name"] for c in inspecteur.get_columns("bilans")}
    if "id_utilisateur" in colonnes_existantes:
        return

    if engine.dialect.name == "sqlite":
        _evoluer_bilans_sqlite(engine)
    else:
        _evoluer_bilans_postgres(engine)


def _evoluer_bilans_postgres(engine: Engine) -> None:
    with engine.begin() as connexion:
        connexion.execute(text("ALTER TABLE bilans ALTER COLUMN id_programme DROP NOT NULL"))
        connexion.execute(text("ALTER TABLE bilans ALTER COLUMN semaine DROP NOT NULL"))
        connexion.execute(text("ALTER TABLE bilans ALTER COLUMN score_snapshot DROP NOT NULL"))
        connexion.execute(text("ALTER TABLE bilans ALTER COLUMN decision DROP NOT NULL"))
        connexion.execute(text("ALTER TABLE bilans ADD COLUMN id_utilisateur INTEGER REFERENCES utilisateurs(id_utilisateur)"))
        connexion.execute(text("ALTER TABLE bilans ADD COLUMN id_axe INTEGER REFERENCES axes(id_axe)"))
        connexion.execute(text("ALTER TABLE bilans ADD COLUMN remarque TEXT"))
        connexion.execute(text("ALTER TABLE bilans ADD COLUMN comprehension TEXT"))
        # type_decision : String simple, pas un ENUM Postgres natif (voir
        # models/bilan.py) — ADD COLUMN direct, aucun type à créer avant.
        connexion.execute(text("ALTER TABLE bilans ADD COLUMN type_decision VARCHAR(30)"))


def _evoluer_bilans_sqlite(engine: Engine) -> None:
    from app.models.bilan import Bilan  # import tardif, évite un cycle au chargement du module

    colonnes_historiques = [
        "id_bilan", "id_programme", "semaine", "score_snapshot",
        "quoi_a_marche", "quoi_n_a_pas_marche", "ajustement_semaine_suivante",
        "decision", "date_creation",
    ]
    colonnes_sql = ", ".join(colonnes_historiques)

    with engine.connect() as connexion:
        # PRAGMA foreign_keys ne peut pas être changé à l'intérieur d'une
        # transaction SQLite — fait à part, avant le begin().
        connexion.execute(text("PRAGMA foreign_keys=OFF"))
        # Voir _evoluer_entrees_suivi_sqlite : évite que le RENAME réécrive
        # les FK des autres tables vers `bilans_old`. Aucune table ne
        # référence `bilans` aujourd'hui, mais le PRAGMA est appliqué
        # uniformément aux trois reconstructions pour que ce ne soit pas une
        # bombe à retardement le jour où une FK vers bilans apparaît.
        connexion.execute(text("PRAGMA legacy_alter_table=ON"))
        connexion.commit()

    with engine.begin() as connexion:
        connexion.execute(text("ALTER TABLE bilans RENAME TO bilans_old"))
        # L'index nommé (ix_bilans_id_bilan) reste global à la base même après
        # le RENAME (il continue de pointer vers bilans_old) — il faut le
        # supprimer explicitement avant de recréer une table "bilans" avec le
        # même index, sinon collision de nom.
        connexion.execute(text("DROP INDEX IF EXISTS ix_bilans_id_bilan"))
        Bilan.__table__.create(bind=connexion)
        connexion.execute(
            text(f"INSERT INTO bilans ({colonnes_sql}) SELECT {colonnes_sql} FROM bilans_old")
        )
        connexion.execute(text("DROP TABLE bilans_old"))

    with engine.connect() as connexion:
        connexion.execute(text("PRAGMA legacy_alter_table=OFF"))
        connexion.execute(text("PRAGMA foreign_keys=ON"))
        connexion.commit()


def faire_evoluer_programme_vers_saison(engine: Engine) -> None:
    """
    Mission 5 §3/§8 (Q1) — Programme devient le support physique de Saison
    sans renommage. Deux opérations, toutes deux idempotentes :

    1. ADD COLUMN intention / date_fin (nullable, jamais fabriquées pour
       l'historique — §23).
    2. Étendre StatutProgramme avec la valeur `termine`. Sans effet sur
       SQLite (vérifié empiriquement : ce projet ne matérialise aucune
       contrainte CHECK sur ses colonnes Enum, seulement un VARCHAR(n) —
       voir models/programme.py). PostgreSQL a un vrai type ENUM natif qui
       doit être étendu explicitement avec ALTER TYPE ... ADD VALUE,
       supporté nativement en IF NOT EXISTS depuis PG 12.
    """
    inspecteur = inspect(engine)
    colonnes_existantes = {c["name"] for c in inspecteur.get_columns("programmes")}

    if "intention" not in colonnes_existantes:
        with engine.begin() as connexion:
            connexion.execute(text("ALTER TABLE programmes ADD COLUMN intention TEXT"))
    if "date_fin" not in colonnes_existantes:
        with engine.begin() as connexion:
            connexion.execute(text("ALTER TABLE programmes ADD COLUMN date_fin DATE"))

    if engine.dialect.name == "postgresql":
        # Hors transaction explicite : ALTER TYPE ... ADD VALUE ne peut pas
        # être exécuté à l'intérieur d'un bloc transactionnel qui l'utilise
        # ensuite dans le même commit sur d'anciennes versions de PG — on le
        # passe donc en autocommit, séparément, comme la doc PG le recommande.
        with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as connexion:
            connexion.execute(text("ALTER TYPE statutprogramme ADD VALUE IF NOT EXISTS 'termine'"))


def faire_evoluer_axe_vers_construction(engine: Engine) -> None:
    """
    Mission 5 §4/§8 (Q2) — Axe devient le support physique de Construction.
    Assouplit trois colonnes historiquement NOT NULL (id_programme, pilier,
    phase_deverrouillage — une Construction ne doit pas être forcée dans une
    Saison, ni catégorisée par pilier, ni verrouillée par phase) et ajoute
    id_utilisateur / intention / status / date_creation, toutes nullable.

    Idempotent : sans effet si la migration a déjà été appliquée. Même
    stratégie que Mission 4 (faire_evoluer_bilans_vers_reflexion) : ALTER
    COLUMN direct sur PostgreSQL, reconstruction de table sur SQLite.
    """
    inspecteur = inspect(engine)
    colonnes_existantes = {c["name"] for c in inspecteur.get_columns("axes")}
    if "id_utilisateur" in colonnes_existantes:
        return

    if engine.dialect.name == "sqlite":
        _evoluer_axes_sqlite(engine)
    else:
        _evoluer_axes_postgres(engine)


def _evoluer_axes_postgres(engine: Engine) -> None:
    with engine.begin() as connexion:
        connexion.execute(text("ALTER TABLE axes ALTER COLUMN id_programme DROP NOT NULL"))
        connexion.execute(text("ALTER TABLE axes ALTER COLUMN pilier DROP NOT NULL"))
        connexion.execute(text("ALTER TABLE axes ALTER COLUMN phase_deverrouillage DROP NOT NULL"))
        connexion.execute(text("ALTER TABLE axes ADD COLUMN id_utilisateur INTEGER REFERENCES utilisateurs(id_utilisateur)"))
        connexion.execute(text("ALTER TABLE axes ADD COLUMN intention TEXT"))
        connexion.execute(text("ALTER TABLE axes ADD COLUMN status VARCHAR(20)"))
        connexion.execute(text("ALTER TABLE axes ADD COLUMN date_creation TIMESTAMP"))


def faire_evoluer_entrees_suivi_vers_action(engine: Engine) -> None:
    """
    Mission 6 (§8/§12) — EntreeSuivi apprend à représenter une Action réelle,
    sans que rien de legacy ne bouge. Deux opérations, comme d'habitude :
    ajouter les colonnes nouvelles (date_action, contenu — toutes nullable,
    jamais fabriquées pour l'historique) et assouplir semaine/jour, qui
    n'ont plus de sens pour une Action moderne créée hors de toute grille
    hebdomadaire. Idempotent.
    """
    inspecteur = inspect(engine)
    colonnes_existantes = {c["name"] for c in inspecteur.get_columns("entrees_suivi")}
    if "date_action" in colonnes_existantes:
        return

    if engine.dialect.name == "sqlite":
        _evoluer_entrees_suivi_sqlite(engine)
    else:
        _evoluer_entrees_suivi_postgres(engine)


def _evoluer_entrees_suivi_postgres(engine: Engine) -> None:
    with engine.begin() as connexion:
        connexion.execute(text("ALTER TABLE entrees_suivi ALTER COLUMN semaine DROP NOT NULL"))
        connexion.execute(text("ALTER TABLE entrees_suivi ALTER COLUMN jour DROP NOT NULL"))
        connexion.execute(text("ALTER TABLE entrees_suivi ADD COLUMN date_action TIMESTAMP"))
        connexion.execute(text("ALTER TABLE entrees_suivi ADD COLUMN contenu TEXT"))


def _evoluer_entrees_suivi_sqlite(engine: Engine) -> None:
    from app.models.entree_suivi import EntreeSuivi  # import tardif, évite un cycle au chargement du module

    colonnes_historiques = [
        "id_entree", "id_axe", "id_engagement", "semaine", "jour", "coche", "date_coche",
    ]
    colonnes_sql = ", ".join(colonnes_historiques)

    with engine.connect() as connexion:
        connexion.execute(text("PRAGMA foreign_keys=OFF"))
        # legacy_alter_table=ON est INDISPENSABLE ici : depuis SQLite 3.25,
        # un ALTER TABLE ... RENAME réécrit automatiquement les clés
        # étrangères des AUTRES tables qui référencent celle renommée. Sans
        # ce PRAGMA, `observations.id_entree` se met à pointer vers
        # `entrees_suivi_old`, qui est ensuite supprimée → référence cassée,
        # détectée par PRAGMA foreign_key_check (bug réel, reproduit par
        # tests/test_mission6_migration.py avant correction).
        connexion.execute(text("PRAGMA legacy_alter_table=ON"))
        connexion.commit()

    with engine.begin() as connexion:
        connexion.execute(text("ALTER TABLE entrees_suivi RENAME TO entrees_suivi_old"))
        connexion.execute(text("DROP INDEX IF EXISTS ix_entrees_suivi_id_entree"))
        EntreeSuivi.__table__.create(bind=connexion)
        connexion.execute(
            text(f"INSERT INTO entrees_suivi ({colonnes_sql}) SELECT {colonnes_sql} FROM entrees_suivi_old")
        )
        connexion.execute(text("DROP TABLE entrees_suivi_old"))

    with engine.connect() as connexion:
        connexion.execute(text("PRAGMA legacy_alter_table=OFF"))
        connexion.execute(text("PRAGMA foreign_keys=ON"))
        connexion.commit()


def _evoluer_axes_sqlite(engine: Engine) -> None:
    from app.models.axe import Axe  # import tardif, évite un cycle au chargement du module

    colonnes_historiques = [
        "id_axe", "id_programme", "nom", "phase_deverrouillage",
        "ordre_affichage", "pilier", "jours_actifs",
    ]
    colonnes_sql = ", ".join(colonnes_historiques)

    with engine.connect() as connexion:
        connexion.execute(text("PRAGMA foreign_keys=OFF"))
        # Voir _evoluer_entrees_suivi_sqlite pour le détail : sans
        # legacy_alter_table=ON, le RENAME réécrit les FK des tables qui
        # référencent `axes` (entrees_suivi, engagements, observations,
        # bilans, notifications, sessions_travail — six tables ici) vers
        # `axes_old`, ensuite supprimée. Correctif appliqué rétroactivement
        # en Mission 6, après que le test de migration de cette mission a
        # révélé le problème sur entrees_suivi.
        connexion.execute(text("PRAGMA legacy_alter_table=ON"))
        connexion.commit()

    with engine.begin() as connexion:
        connexion.execute(text("ALTER TABLE axes RENAME TO axes_old"))
        connexion.execute(text("DROP INDEX IF EXISTS ix_axes_id_axe"))
        Axe.__table__.create(bind=connexion)
        connexion.execute(
            text(f"INSERT INTO axes ({colonnes_sql}) SELECT {colonnes_sql} FROM axes_old")
        )
        connexion.execute(text("DROP TABLE axes_old"))

    with engine.connect() as connexion:
        connexion.execute(text("PRAGMA legacy_alter_table=OFF"))
        connexion.execute(text("PRAGMA foreign_keys=ON"))
        connexion.commit()
