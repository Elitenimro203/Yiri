# Décisions produit

Chaque décision est datée et porte un statut. Une décision **provisoire** se
réévalue à l'usage (vision fondatrice §31 : une décision provisoire vaut
mieux qu'une paralysie, mais elle doit rester identifiable comme provisoire).

## 2026-11-18 — Une Action peut exister sans Construction

**Statut : PROVISOIRE** — décidée par Peniel.

**Pourquoi.** Un premier testeur ne savait pas quoi faire au départ. Exiger
une Construction avant de pouvoir noter quoi que ce soit pose la question la
plus difficile (« qu'est-ce que je veux faire évoluer ? ») au pire moment. La
vision met la réalité avant le plan (§2, §28) : on agit souvent avant de
savoir que cela deviendra une Construction. La vision (§10) autorisait déjà
une Action sans Engagement, sans Saison et sans planification ; elle ne
tranchait pas pour la Construction.

**Ce que ça change.**
- `entrees_suivi.id_axe` devient nullable ; `entrees_suivi.id_utilisateur`
  (propriétaire direct) est ajouté.
- `POST /actions` accepte une Action sans `id_axe` (mais pas d'Engagement sans
  Construction).
- `PATCH /actions/{id}` rattache une Action à une Construction après coup, ou
  l'en détache.

**Le risque surveillé.** Que Yiri devienne un journal où l'on note sans jamais
choisir. L'Action libre est une porte d'entrée, pas une fin : Yiri propose
doucement d'en faire une Construction, sans jamais l'imposer.

**Quand la réévaluer.** Après les premiers tests : si les utilisateurs
accumulent des Actions libres sans jamais choisir de Construction, revoir la
façon de proposer le choix (pas forcément revenir sur la règle).
