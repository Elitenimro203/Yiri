import type { Action } from '../api/actions';
import type { Observation } from '../api/observations';
import type { Construction } from '../api/constructions';

// Les premiers jours : Yiri guide sans imposer. Trois états, déduits des
// seules données réelles (aucun compteur stocké, aucune « étape » à valider).

export type EtapeDebut =
  | 'vide'          // rien noté, rien choisi : une seule question
  | 'premieresTraces' // des traces, pas encore de Construction : proposer, sans presser
  | 'installe';     // au moins une Construction : la page habituelle

export function etapeDebut(constructions: Construction[], actions: Action[], observations: Observation[]): EtapeDebut {
  if (constructions.length > 0) return 'installe';
  if (actions.length === 0 && observations.length === 0) return 'vide';
  return 'premieresTraces';
}

/** Actions libres (sans Construction), les plus récentes d'abord. */
export function actionsLibres(actions: Action[]): Action[] {
  return actions.filter((a) => a.id_axe === null);
}

// L'accueil ne s'affiche qu'une fois par appareil, et seulement sur un compte
// vide : quelqu'un qui utilise déjà Yiri ne le voit jamais.
const CLE_ACCUEIL = 'yiri.accueilVu';

export function accueilDejaVu(): boolean {
  try { return localStorage.getItem(CLE_ACCUEIL) === '1'; } catch { return true; }
}

export function marquerAccueilVu(): void {
  try { localStorage.setItem(CLE_ACCUEIL, '1'); } catch { /* stockage indisponible : on ne bloque pas */ }
}
