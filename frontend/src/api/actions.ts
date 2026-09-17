import { apiRequest } from './client';

export interface Action {
  id_entree: number;
  id_axe: number;
  id_engagement: number | null;
  date_action: string | null; // ISO datetime — jamais une semaine/jour Wakati
  contenu: string | null;
}

export interface ActionCreate {
  id_axe: number;
  id_engagement?: number | null;
  date_action?: string | null; // date seule (YYYY-MM-DD) ; absente = aujourd'hui, côté serveur
  contenu?: string | null;
}

export const listerActions = (filtres?: { axeId?: number; engagementId?: number }): Promise<Action[]> => {
  const params = new URLSearchParams();
  if (filtres?.axeId != null) params.set('axe_id', String(filtres.axeId));
  if (filtres?.engagementId != null) params.set('engagement_id', String(filtres.engagementId));
  const qs = params.toString();
  return apiRequest(`/actions${qs ? `?${qs}` : ''}`);
};

export const creerAction = (payload: ActionCreate): Promise<Action> =>
  apiRequest('/actions', { method: 'POST', body: payload });
