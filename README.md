# Yiri — App de suivi

Projet portfolio : suivi du programme hebdomadaire holistique (sommeil, sport, tech,
anglais, lecture, expression, business dev GreenGrow, portfolio, méditation, sujet libre),
avec déverrouillage progressif par semaine (RG-04) et notifications configurables.

## État actuel

- ✅ **Backend** (`/backend`) : API FastAPI complète, testée bout-en-bout (auth JWT,
  CRUD programmes/axes/suivi/notifications, verrouillage RG-04 vérifié côté serveur,
  isolation anti-IDOR vérifiée). Voir `backend/README.md` pour le lancement.
- ✅ **Frontend** (`/frontend`) : scaffold React + TypeScript + Vite, testé (build TS sans
  erreur, serveur dev vérifié). Auth complète (login, route protégée, token vérifié via
  `/auth/me`), dashboard listant les programmes réels. Voir `frontend/README.md`.
- ⏳ **Grille de suivi** : le squelette du dashboard est fonctionnel, mais la vraie interface
  (axes × jours, verrouillage visuel, horizon de progression) reste à construire ensemble,
  en session Socratique — c'est la logique métier, pas du scaffold.
- ⏳ **App mobile native** (notifications) : à cadrer une fois le web stable.

## Prochaines étapes suggérées

1. Lance le backend ET le frontend en parallèle (deux terminaux), teste le login réel.
2. Session Socratique : construire la grille de suivi dans `DashboardPage.tsx`, en
   reprenant la logique du tracker HTML déjà livré (déverrouillage, horizon de progression)
   mais branchée sur l'API réelle.
3. Cadrer l'app mobile (React Native ou natif) une fois le web stable.
