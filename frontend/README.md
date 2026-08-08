# L'Homme Complet — Frontend

React + TypeScript + Vite. Consomme l'API du backend (`/backend`).

## Installation

```bash
cd frontend
npm install
```

Le fichier `.env` pointe déjà vers `http://localhost:8000` (ton backend en local) —
rien à changer si tu lances les deux en même temps sur ta machine.

## Lancement

```bash
npm run dev
```

Ouvre l'URL affichée (en général `http://localhost:5173`). Si le port est déjà pris,
Vite en choisit un autre automatiquement et l'affiche dans le terminal.

**Important** : lance le backend (`uvicorn app.main:app --reload`) AVANT ou EN MÊME TEMPS
que le frontend — sinon le login échouera avec une erreur réseau.

## Ce qui est fonctionnel dès maintenant

- Page de connexion (`/login`) — appelle réellement `/auth/login`
- Route protégée : redirige vers `/login` si pas de token valide (vérifié via `/auth/me`
  à chaque chargement, pas juste la présence du token)
- Dashboard (`/`) : liste tes programmes réels depuis l'API

## Ce qui reste à construire (session Socratique — pas du scaffold)

La vraie grille de suivi (axes × jours, cases à cocher, verrouillage visuel RG-04,
horizon de progression comme sur `tracker-homme-complet.html`) — c'est la logique
métier du projet, à construire ensemble plutôt que livrée toute faite.

## Structure

```
src/
  api/          # un fichier par ressource backend (auth.ts, programmes.ts) + client.ts centralisé
  context/      # AuthContext : état de connexion global
  components/   # composants partagés (ProtectedRoute)
  pages/        # une page = une route
```

## Points de vigilance avant prod

- ⚠️ Le token est stocké en `localStorage` — vulnérable au XSS. Acceptable pour un
  prototype personnel, à revoir (cookie httpOnly) si l'app sert un jour d'autres utilisateurs.
- ⚠️ `VITE_API_BASE_URL` doit pointer vers la vraie URL du backend déployé, pas
  `localhost`, avant toute mise en ligne.
