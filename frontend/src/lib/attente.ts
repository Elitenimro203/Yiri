import { useEffect, useState } from 'react';
import { LOIS_DE_YIRI } from './phraseDuJour';

/** Secondes écoulées depuis que `actif` est vrai (0 sinon). */
export function useDureeAttente(actif: boolean): number {
  const [secondes, setSecondes] = useState(0);
  useEffect(() => {
    if (!actif) { setSecondes(0); return; }
    const debut = Date.now();
    const id = window.setInterval(() => setSecondes(Math.floor((Date.now() - debut) / 1000)), 500);
    return () => window.clearInterval(id);
  }, [actif]);
  return secondes;
}

export const SEUIL_MESSAGE_S = 3;   // avant : l'animation seule suffit
export const SEUIL_LOIS_S = 10;     // ensuite : une loi de Yiri pour accompagner l'attente
export const DUREE_LOI_S = 7;

// Ce que dit l'écran d'attente, selon la durée. Honnête (on dit pourquoi
// c'est long) et utile (l'attente devient un moment de lecture).
export function messageAttente(secondes: number): { principal: string; loi: string | null } {
  if (secondes < SEUIL_MESSAGE_S) return { principal: 'Un instant…', loi: null };
  const principal = "Yiri se réveille. La première ouverture peut prendre jusqu'à une minute.";
  if (secondes < SEUIL_LOIS_S) return { principal, loi: null };
  const i = Math.floor((secondes - SEUIL_LOIS_S) / DUREE_LOI_S) % LOIS_DE_YIRI.length;
  return { principal, loi: LOIS_DE_YIRI[i] };
}
