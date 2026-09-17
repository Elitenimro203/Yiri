import { apiRequest } from './client';
import { StatutProgramme } from './programmes';

export interface Saison {
  id_saison: number;
  nom: string;
  intention: string | null;
  date_debut: string;
  date_fin: string | null;
  statut: StatutProgramme;
}

export interface SaisonCreate {
  nom: string;
  intention?: string | null;
  date_debut: string;
  date_fin?: string | null;
}

export interface SaisonUpdate {
  nom?: string;
  intention?: string | null;
  date_fin?: string | null;
}

export const listerSaisons = (): Promise<Saison[]> => apiRequest('/seasons');

export const getSaisonActive = (): Promise<Saison | null> =>
  apiRequest<Saison>('/seasons/active').catch(() => null);

export const creerSaison = (payload: SaisonCreate): Promise<Saison> =>
  apiRequest('/seasons', { method: 'POST', body: payload });

export const getSaison = (id: number): Promise<Saison> => apiRequest(`/seasons/${id}`);

export const modifierSaison = (id: number, payload: SaisonUpdate): Promise<Saison> =>
  apiRequest(`/seasons/${id}`, { method: 'PATCH', body: payload });

export const terminerSaison = (id: number): Promise<Saison> =>
  apiRequest(`/seasons/${id}/terminer`, { method: 'POST' });

export const archiverSaison = (id: number): Promise<Saison> =>
  apiRequest(`/seasons/${id}/archiver`, { method: 'POST' });
