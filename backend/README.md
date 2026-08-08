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

| Variable                        | Obligatoire          | Description                                                      |
| ------------------------------- | -------------------- | ---------------------------------------------------------------- |
| `SECRET_KEY`                  | Oui                  | Clé de signature des JWT — l'app refuse de démarrer sans elle |
| `DATABASE_URL`                | Non (défaut SQLite) | URL de connexion base de données                                |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Non (défaut 60)     | Durée de validité d'un token                                   |

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

- ⚠️ `allow_origins=["*"]` dans `main.py` doit être remplacé par le vrai domaine du frontend
- ⚠️ `Base.metadata.create_all()` ne migre pas un schéma existant — passer à Alembic dès
  que la base contient des données réelles à préserver
- La base SQLite par défaut ne convient qu'au développement local — PostgreSQL recommandé
  dès qu'il y a plusieurs utilisateurs simultanés
