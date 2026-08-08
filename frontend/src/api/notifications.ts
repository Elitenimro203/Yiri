import { apiRequest } from './client';

export interface Rappel {
  id_notification: number;
  libelle: string;
  heure: string; // "HH:MM:SS"
  jours_actifs: string;
  actif: boolean;
  id_axe: number | null;
}

export interface RappelCreate {
  libelle: string;
  heure: string;
  jours_actifs: string;
  id_axe?: number | null;
}

export const listRappels = (): Promise<Rappel[]> => apiRequest('/notifications');

export const creerRappel = (payload: RappelCreate): Promise<Rappel> =>
  apiRequest('/notifications', { method: 'POST', body: payload });

export const modifierRappel = (id: number, payload: Partial<RappelCreate & { actif: boolean }>): Promise<Rappel> =>
  apiRequest(`/notifications/${id}`, { method: 'PATCH', body: payload });

export const supprimerRappel = (id: number): Promise<void> =>
  apiRequest(`/notifications/${id}`, { method: 'DELETE' });
