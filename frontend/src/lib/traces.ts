import type { Action } from '../api/actions';
import type { Observation } from '../api/observations';
import { jourCalendaire } from './dates';

// Le fil « Ce qui s'est réellement passé » : Actions, Observations et
// Décisions, mêlées dans un seul ordre chronologique. Projection factuelle :
// aucune importance, aucun score, aucune causalité entre les éléments.

export type TypeTrace = 'action' | 'observation' | 'decision';

export interface Trace {
  cle: string;
  type: TypeTrace;
  jour: string; // AAAA-MM-JJ
  texte: string;
  idConstruction: number | null;
}

export interface DecisionPourFil {
  id: number;
  dateCreation: string;
  libelle: string; // « Continuer », « Réduire »…
  remarque: string | null;
  idConstruction: number | null;
}

/**
 * Construit le fil, du plus récent au plus ancien.
 * Une entrée sans date réelle (case Wakati legacy sans `date_action`) est
 * exclue : on ne lui invente pas de date.
 */
export function construireFil(
  actions: Action[],
  observations: Observation[],
  decisions: DecisionPourFil[],
  limite = 6,
): Trace[] {
  const traces: Trace[] = [];
  for (const a of actions) {
    const jour = jourCalendaire(a.date_action);
    if (!jour) continue;
    traces.push({ cle: `a-${a.id_entree}`, type: 'action', jour, texte: a.contenu || 'Action enregistrée', idConstruction: a.id_axe });
  }
  for (const o of observations) {
    const jour = jourCalendaire(o.date_creation);
    if (!jour) continue;
    traces.push({ cle: `o-${o.id_observation}`, type: 'observation', jour, texte: o.contenu, idConstruction: o.id_axe });
  }
  for (const d of decisions) {
    const jour = jourCalendaire(d.dateCreation);
    if (!jour) continue;
    const texte = d.remarque ? `Décidé : ${d.libelle.toLowerCase()} — ${d.remarque}` : `Décidé : ${d.libelle.toLowerCase()}`;
    traces.push({ cle: `d-${d.id}`, type: 'decision', jour, texte, idConstruction: d.idConstruction });
  }
  // Tri stable par jour décroissant ; à jour égal, l'ordre d'arrivée est conservé.
  return traces
    .map((t, i) => ({ t, i }))
    .sort((x, y) => (x.t.jour === y.t.jour ? x.i - y.i : x.t.jour < y.t.jour ? 1 : -1))
    .map(({ t }) => t)
    .slice(0, limite);
}

/** Jour de la dernière Action datée d'une Construction, ou null. */
export function derniereTrace(actions: Action[], idConstruction: number): string | null {
  let max: string | null = null;
  for (const a of actions) {
    if (a.id_axe !== idConstruction) continue;
    const jour = jourCalendaire(a.date_action);
    if (jour && (max === null || jour > max)) max = jour;
  }
  return max;
}
