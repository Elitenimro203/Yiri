import { apiRequest } from './client';

export type ModeProgression = 'auto' | 'manuel';
export type StatutProgramme = 'actif' | 'archive';
export type ModeDeverrouillage = 'progressif' | 'complet';
export type Pilier = 'corps' | 'esprit' | 'caractere' | 'impact';

export const PILIERS: Pilier[] = ['corps', 'esprit', 'caractere', 'impact'];

export const PILIER_LABELS: Record<Pilier, string> = {
  corps: 'Corps',
  esprit: 'Esprit',
  caractere: 'Caractère',
  impact: 'Impact',
};

export interface Programme {
  id_programme: number;
  nom: string;
  date_debut: string;
  mode_progression: ModeProgression;
  semaine_courante: number;
  statut: StatutProgramme;
  mode_deverrouillage: ModeDeverrouillage;
}

export interface Axe {
  id_axe: number;
  nom: string;
  phase_deverrouillage: number;
  ordre_affichage: number;
  pilier: Pilier;
  jours_actifs: string | null;
  deverrouille: boolean;
}

/** ISO : 1=lundi..7=dimanche. jours_actifs null = actif tous les jours (RG-11). */
export function axeActifJourIso(axe: Axe, jourIso: number): boolean {
  if (!axe.jours_actifs) return true;
  return axe.jours_actifs.split(',').map((j) => parseInt(j, 10)).includes(jourIso);
}

/** jourIndex : 0=lundi..6=dimanche (convention EntreeSuivi.jour) */
export function axeActifJourIndex(axe: Axe, jourIndex: number): boolean {
  return axeActifJourIso(axe, jourIndex + 1);
}

export function nbJoursActifs(axe: Axe): number {
  return axe.jours_actifs ? axe.jours_actifs.split(',').length : 7;
}

/** Nombre de jours actifs de l'axe parmi les jours 0..jourIndexAujourdhui inclus —
 * sert à calculer un "rythme" (progression relative aux jours déjà vécus)
 * plutôt qu'un % sur toute la semaine, qui reste artificiellement bas en
 * milieu de semaine même si tout a été fait correctement jusqu'ici. */
export function nbJoursActifsEcoules(axe: Axe, jourIndexAujourdhui: number): number {
  let n = 0;
  for (let j = 0; j <= jourIndexAujourdhui; j++) {
    if (axeActifJourIndex(axe, j)) n++;
  }
  return n;
}

/** Nombre de jours actifs de l'axe qui sont déjà passés (jusqu'à aujourd'hui inclus) */
function joursActifsJusqua(axe: Axe, jourIndexAujourdhui: number): number {
  let count = 0;
  for (let j = 0; j <= jourIndexAujourdhui; j++) {
    if (axeActifJourIndex(axe, j)) count++;
  }
  return count;
}

export interface Regularite {
  pourcentage: number;
  cochees: number;
  possibles: number;
}

/**
 * Régularité = ce qui a été fait / ce qui était réellement possible JUSQU'À
 * AUJOURD'HUI — pas sur la semaine entière. Un % de semaine complète est
 * mécaniquement bas en début de semaine (ex. 14% un mercredi même en ayant
 * tout fait), ce qui est démotivant et ne reflète pas la vraie discipline.
 * La régularité, elle, peut atteindre 100% dès le premier jour si tout est fait.
 */
export function calculerRegularite(
  axesDeverrouilles: Axe[],
  entrees: EntreeSuivi[],
  jourIndexAujourdhui: number
): Regularite {
  const possibles = axesDeverrouilles.reduce((total, a) => total + joursActifsJusqua(a, jourIndexAujourdhui), 0);
  const idsAxes = new Set(axesDeverrouilles.map((a) => a.id_axe));
  const cochees = entrees.filter((e) => e.coche && e.jour <= jourIndexAujourdhui && idsAxes.has(e.id_axe)).length;
  return { pourcentage: possibles > 0 ? Math.round((100 * cochees) / possibles) : 0, cochees, possibles };
}

/** Même logique, groupée par pilier — absent si aucun axe déverrouillé actif jusqu'à aujourd'hui. */
export function calculerRegulariteParPilier(
  axesDeverrouilles: Axe[],
  entrees: EntreeSuivi[],
  jourIndexAujourdhui: number
): Partial<Record<Pilier, Regularite>> {
  const resultat: Partial<Record<Pilier, Regularite>> = {};
  PILIERS.forEach((p) => {
    const axesDuPilier = axesDeverrouilles.filter((a) => a.pilier === p);
    if (axesDuPilier.length === 0) return;
    const r = calculerRegularite(axesDuPilier, entrees, jourIndexAujourdhui);
    if (r.possibles > 0) resultat[p] = r;
  });
  return resultat;
}

export interface EntreeSuivi {
  id_axe: number;
  semaine: number;
  jour: number;
  coche: boolean;
  date_coche: string | null;
}

export interface PilierProgres {
  pilier: Pilier;
  pourcentage: number;
  cases_cochees: number;
  cases_possibles: number;
}

export const listProgrammes = (): Promise<Programme[]> => apiRequest('/programmes');

export const getProgramme = (id: number): Promise<Programme> => apiRequest(`/programmes/${id}`);

export const avancerSemaine = (id: number): Promise<Programme> =>
  apiRequest(`/programmes/${id}/semaine-suivante`, { method: 'POST' });

export const patchProgramme = (
  id: number,
  payload: Partial<Pick<Programme, 'mode_deverrouillage' | 'nom' | 'statut'>>
): Promise<Programme> => apiRequest(`/programmes/${id}`, { method: 'PATCH', body: payload });

export const listAxes = (programmeId: number): Promise<Axe[]> =>
  apiRequest(`/programmes/${programmeId}/axes`);

export const getGrilleSuivi = (programmeId: number, semaine: number): Promise<EntreeSuivi[]> =>
  apiRequest(`/programmes/${programmeId}/suivi?semaine=${semaine}`);

export const getPiliers = (programmeId: number, semaine: number): Promise<PilierProgres[]> =>
  apiRequest(`/programmes/${programmeId}/piliers?semaine=${semaine}`);

export const toggleCase = (axeId: number, semaine: number, jour: number): Promise<EntreeSuivi> =>
  apiRequest(`/axes/${axeId}/suivi/${semaine}/${jour}`, { method: 'PUT' });

export type DecisionBilan = 'consolider' | 'avancer';

export interface Bilan {
  id_bilan: number;
  semaine: number;
  score_snapshot: number;
  quoi_a_marche: string | null;
  quoi_n_a_pas_marche: string | null;
  ajustement_semaine_suivante: string | null;
  decision: DecisionBilan;
  date_creation: string;
}

export interface BilanCreate {
  semaine: number;
  quoi_a_marche?: string | null;
  quoi_n_a_pas_marche?: string | null;
  ajustement_semaine_suivante?: string | null;
  decision: DecisionBilan;
}

export const listBilans = (programmeId: number): Promise<Bilan[]> =>
  apiRequest(`/programmes/${programmeId}/bilans`);

export const getBilan = (programmeId: number, semaine: number): Promise<Bilan> =>
  apiRequest(`/programmes/${programmeId}/bilans/${semaine}`);

export const creerBilan = (programmeId: number, payload: BilanCreate): Promise<Bilan> =>
  apiRequest(`/programmes/${programmeId}/bilans`, { method: 'POST', body: payload });

// NB: le 423 (axe verrouillé) remonte comme ApiError depuis apiRequest — à gérer
// explicitement à l'endroit où toggleCase est appelé (pas ici), pour que le
// composant puisse afficher un message clair plutôt qu'un plantage silencieux.

