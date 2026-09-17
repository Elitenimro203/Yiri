import { apiRequest } from './client';

export type TypeSession = 'libre' | 'pomodoro';

export interface SessionTravail {
  id_session: number;
  id_axe: number;
  type: TypeSession;
  date_debut: string;
  date_fin: string | null;
  duree_secondes: number | null;
  duree_focus_minutes: number | null;
  duree_pause_minutes: number | null;
}

export interface TempsParAxe {
  id_axe: number;
  nom_axe: string;
  duree_totale_secondes: number;
  nb_sessions: number;
}

export const getSessionActive = (): Promise<SessionTravail | null> => apiRequest('/sessions/active');

export const demarrerSession = (
  axeId: number,
  type: TypeSession = 'libre',
  dureeFocusMinutes?: number,
  dureePauseMinutes?: number
): Promise<SessionTravail> =>
  apiRequest(`/axes/${axeId}/sessions/demarrer`, {
    method: 'POST',
    body: {
      type,
      duree_focus_minutes: dureeFocusMinutes ?? null,
      duree_pause_minutes: dureePauseMinutes ?? null,
    },
  });

export const terminerSession = (sessionId: number): Promise<SessionTravail> =>
  apiRequest(`/sessions/${sessionId}/terminer`, { method: 'POST' });

export const listerSessionsAxe = (axeId: number): Promise<SessionTravail[]> =>
  apiRequest(`/axes/${axeId}/sessions`);

export const getTempsParAxe = (programmeId: number): Promise<TempsParAxe[]> =>
  apiRequest(`/programmes/${programmeId}/temps-par-axe`);

/** Formatte une durée en secondes vers "1h 24min" / "42min" / "0min" — lisible partout */
export function formatDuree(secondes: number): string {
  const h = Math.floor(secondes / 3600);
  const m = Math.floor((secondes % 3600) / 60);
  if (h > 0) return `${h}h ${m}min`;
  return `${m}min`;
}
