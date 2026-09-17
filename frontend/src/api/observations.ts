import { apiRequest } from './client';

export interface Observation {
  id_observation: number;
  id_utilisateur: number;
  id_axe: number | null;
  id_entree: number | null;
  contenu: string;
  date_creation: string; // ISO datetime, calculée côté serveur
}

export interface ObservationCreate {
  contenu: string;
  id_axe?: number | null;
  id_entree?: number | null;
}

export interface ObservationUpdate {
  contenu?: string;
  id_axe?: number | null;
  id_entree?: number | null;
}

export const listerObservations = (filtres?: { axeId?: number }): Promise<Observation[]> => {
  const params = filtres?.axeId != null ? `?axe_id=${filtres.axeId}` : '';
  return apiRequest(`/observations${params}`);
};

export const creerObservation = (payload: ObservationCreate): Promise<Observation> =>
  apiRequest('/observations', { method: 'POST', body: payload });

export const modifierObservation = (id: number, payload: ObservationUpdate): Promise<Observation> =>
  apiRequest(`/observations/${id}`, { method: 'PATCH', body: payload });

export const supprimerObservation = (id: number): Promise<void> =>
  apiRequest(`/observations/${id}`, { method: 'DELETE' });
