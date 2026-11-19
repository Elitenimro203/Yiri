import { useEffect, useSyncExternalStore } from 'react';

// Qui attend le serveur en ce moment ? (vérification de session, connexion…)
// Un seul écran de réveil pour toute l'app, monté à la racine : il peut ainsi
// s'effacer en douceur pendant que la page suivante apparaît, même si la page
// qui attendait (connexion) disparaît au même instant.

let enAttente = 0;
const abonnes = new Set<() => void>();
const prevenir = () => abonnes.forEach((f) => f());

function sAbonner(f: () => void) {
  abonnes.add(f);
  return () => { abonnes.delete(f); };
}

export function useAttenteServeurEnCours(): boolean {
  return useSyncExternalStore(sAbonner, () => enAttente > 0, () => false);
}

/** Signale qu'un composant attend le serveur tant que `actif` est vrai. */
export function useSignalerAttente(actif: boolean): void {
  useEffect(() => {
    if (!actif) return;
    enAttente += 1;
    prevenir();
    return () => {
      enAttente -= 1;
      prevenir();
    };
  }, [actif]);
}
