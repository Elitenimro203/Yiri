import type { Action } from '../api/actions';

// Mission 11 — "cette semaine" = semaine civile réelle (lundi inclus, lundi
// suivant exclu), jamais la semaine de progression Wakati (semaine_courante).
// Fonctions pures, sans état ni appel réseau, pour être testables isolément.

function formatDateLocale(date: Date): string {
  const annee = date.getFullYear();
  const mois = String(date.getMonth() + 1).padStart(2, '0');
  const jour = String(date.getDate()).padStart(2, '0');
  return `${annee}-${mois}-${jour}`;
}

/** Bornes de la semaine civile contenant `aujourdhui`, en dates calendaires
 *  AAAA-MM-JJ : [debut, fin) — lundi inclus, lundi suivant exclu. */
export function bornesSemaineCivile(aujourdhui: Date): { debut: string; fin: string } {
  const lundi = new Date(aujourdhui.getFullYear(), aujourdhui.getMonth(), aujourdhui.getDate());
  lundi.setDate(lundi.getDate() - ((lundi.getDay() + 6) % 7));
  const lundiSuivant = new Date(lundi);
  lundiSuivant.setDate(lundiSuivant.getDate() + 7);
  return { debut: formatDateLocale(lundi), fin: formatDateLocale(lundiSuivant) };
}

/**
 * Actions modernes de la semaine civile, éventuellement filtrées par
 * Construction.
 *
 * - Comparaison sur la date calendaire (10 premiers caractères de
 *   `date_action`), jamais sur un instant `new Date(...)` : l'API renvoie une
 *   date sans fuseau, que le navigateur interpréterait en heure locale et
 *   pourrait décaler d'un jour aux frontières de semaine.
 * - Une entrée sans `date_action` (case Wakati legacy) est exclue : on ne lui
 *   invente pas de date.
 */
export function actionsDeLaSemaine(actions: Action[], aujourdhui: Date, axeId?: number | null): Action[] {
  const { debut, fin } = bornesSemaineCivile(aujourdhui);
  return actions.filter((a) => {
    if (!a.date_action) return false;
    const jour = a.date_action.slice(0, 10);
    const dansLaSemaine = jour >= debut && jour < fin;
    const dansLaConstruction = axeId == null || a.id_axe === axeId;
    return dansLaSemaine && dansLaConstruction;
  });
}
