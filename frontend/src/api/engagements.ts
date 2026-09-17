import { apiRequest } from './client';

export type TypeEngagement = 'recurrent' | 'ponctuel';

export interface Engagement {
  id_engagement: number;
  id_axe: number;
  description: string;
  type: TypeEngagement;
  date_debut: string; // ISO yyyy-mm-dd
  date_fin: string | null;
  actif: boolean;
}

export interface EngagementCreate {
  description: string;
  type?: TypeEngagement;
  date_debut: string;
  date_fin?: string | null;
  actif?: boolean;
}

export interface EngagementUpdate {
  description?: string;
  type?: TypeEngagement;
  date_debut?: string;
  date_fin?: string | null;
  actif?: boolean;
}

export const listerEngagements = (axeId: number): Promise<Engagement[]> =>
  apiRequest(`/axes/${axeId}/engagements`);

export const creerEngagement = (axeId: number, payload: EngagementCreate): Promise<Engagement> =>
  apiRequest(`/axes/${axeId}/engagements`, { method: 'POST', body: payload });

export const getEngagement = (id: number): Promise<Engagement> => apiRequest(`/engagements/${id}`);

export const modifierEngagement = (id: number, payload: EngagementUpdate): Promise<Engagement> =>
  apiRequest(`/engagements/${id}`, { method: 'PATCH', body: payload });
