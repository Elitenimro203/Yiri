import { apiRequest } from './client';

export type StatutConstruction = 'active' | 'en_pause' | 'terminee' | 'abandonnee';

export interface Construction {
  id_construction: number;
  id_saison: number | null;
  nom: string;
  intention: string | null;
  statut: StatutConstruction | null; // null = Construction historique Wakati, jamais fabriqué
  ordre_affichage: number;
  date_creation: string | null;
}

export interface ConstructionCreate {
  nom: string;
  intention?: string | null;
  id_saison?: number | null;
}

export interface ConstructionUpdate {
  nom?: string;
  intention?: string | null;
  id_saison?: number | null;
}

export const listerConstructions = (filtres?: { saisonId?: number }): Promise<Construction[]> => {
  const params = filtres?.saisonId != null ? `?season_id=${filtres.saisonId}` : '';
  return apiRequest(`/constructions${params}`);
};

export const creerConstruction = (payload: ConstructionCreate): Promise<Construction> =>
  apiRequest('/constructions', { method: 'POST', body: payload });

export const getConstruction = (id: number): Promise<Construction> => apiRequest(`/constructions/${id}`);

export const modifierConstruction = (id: number, payload: ConstructionUpdate): Promise<Construction> =>
  apiRequest(`/constructions/${id}`, { method: 'PATCH', body: payload });

export const mettreEnPauseConstruction = (id: number): Promise<Construction> =>
  apiRequest(`/constructions/${id}/pause`, { method: 'POST' });

export const reprendreConstruction = (id: number): Promise<Construction> =>
  apiRequest(`/constructions/${id}/reprendre`, { method: 'POST' });

export const terminerConstruction = (id: number): Promise<Construction> =>
  apiRequest(`/constructions/${id}/terminer`, { method: 'POST' });

export const abandonnerConstruction = (id: number): Promise<Construction> =>
  apiRequest(`/constructions/${id}/abandonner`, { method: 'POST' });
