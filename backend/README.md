# L'Homme Complet — Backend

API FastAPI pour le suivi du programme hebdomadaire (sommeil, sport, tech, anglais,
lecture, expression, business dev, portfolio, méditation, sujet libre).

## Prérequis
- Python 3.11+

## Installation

**Windows (PowerShell) :**
```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
# Si erreur "l'exécution de scripts est désactivée" :
#   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
pip install -r requirements.txt
copy .env.example .env
# Puis éditer .env : générer une vraie SECRET_KEY avec
python -c "import secrets; print(secrets.token_hex(32))"
```

**Mac/Linux :**
```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Puis éditer .env : générer une vraie SECRET_KEY avec
# python -c "import secrets; print(secrets.token_hex(32))"
```

## Lancement local

```bash
uvicorn app.main:app --reload
```

- API : http://localhost:8000
- Doc interactive (Swagger) : http://localhost:8000/docs

## Variables d'environnement

| Variable | Obligatoire | Description |
|---|---|---|
| `SECRET_KEY` | Oui | Clé de signature des JWT — l'app refuse de démarrer sans elle |
| `DATABASE_URL` | Non (défaut SQLite) | URL de connexion base de données |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Non (défaut 60) | Durée de validité d'un token |
| `ALLOWED_ORIGINS` | Non (défaut `*`) | CSV des origines autorisées (CORS) |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_CLAIMS_EMAIL` | Non | Notifications push — voir `scripts/generate_vapid_keys.py` |

## Déploiement sur Railway

Deux fichiers dans ce dossier existent spécifiquement pour Railway :
- **`Procfile`** — indique la commande de démarrage (`web: uvicorn app.main:app --host 0.0.0.0 --port $PORT`).
  Sans lui, Railway ne sait pas comment lancer une app Python et le déploiement échoue.
- **`.python-version`** — fixe Python 3.12. Sans lui, Railway peut choisir une version plus
  récente (3.13/3.14) pour laquelle certaines dépendances (`cryptography`/`cffi`, utilisées par
  `pywebpush`) n'ont pas de version précompilée — build qui échoue, exactement comme en local.

**Étapes :**
1. railway.app → New Project → Deploy from GitHub repo → sélectionne ton dépôt
2. Dans les paramètres du service : **Root Directory** = `backend`
3. Onglet **Variables** : ajoute `SECRET_KEY` (une vraie clé générée), et éventuellement
   `ALLOWED_ORIGINS`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_CLAIMS_EMAIL`
4. **Settings → Networking → Generate Domain** pour obtenir une URL publique
5. Si le build échoue, va dans l'onglet **Deployments → [dernier déploiement] → Build Logs** —
   l'erreur exacte y est affichée. Ne pas deviner : lire le log précis avant de changer quoi que ce soit.

⚠️ **Persistance de la base** : sans configuration supplémentaire, le système de fichiers
Railway peut être réinitialisé à chaque nouveau déploiement — ce qui effacerait `homme_complet.db`.
Pour un vrai test avec plusieurs personnes sur la durée, ajoute un **Volume** (Settings → Volumes
→ New Volume, monté par exemple sur `/app/data`) et adapte `DATABASE_URL` pour pointer dessus
(`sqlite:////app/data/homme_complet.db`), plutôt que de perdre les données à chaque redéploiement.

⚠️ Railway n'est plus un service gratuit illimité — un crédit d'essai limité est offert au
démarrage. Pour un usage aussi léger (toi + ton frère), ça devrait suffire longtemps, mais
garde un œil sur l'onglet Usage si tu veux éviter une surprise.

## Structure

```
app/
  core/        # config, sécurité (JWT/hash), DB, dependencies FastAPI, logique métier partagée
  models/      # tables SQLAlchemy (1 fichier = 1 table, issu du MLD)
  schemas/     # validation Pydantic entrée/sortie API
  routers/     # endpoints groupés par ressource
  main.py      # assemblage de l'app
```

## Points de vigilance avant toute mise en ligne publique

- ⚠️ `ALLOWED_ORIGINS` doit lister le vrai domaine du frontend en prod, pas `*`
  (configurable via variable d'environnement, voir tableau ci-dessus)
- ⚠️ `Base.metadata.create_all()` ne migre pas un schéma existant — passer à Alembic dès
  que la base contient des données réelles à préserver
- La base SQLite par défaut ne convient qu'au développement local — PostgreSQL recommandé
  dès qu'il y a plusieurs utilisateurs simultanés
