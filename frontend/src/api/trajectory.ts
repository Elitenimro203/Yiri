import { apiRequest } from './client';

export type TypeEvenement =
  | 'season_started'
  | 'season_ended'
  | 'construction_created'
  | 'action'
  | 'observation'
  | 'reflection'
  | 'decision';

export interface SeasonContext {
  id_saison: number;
  nom: string;
}

export interface ConstructionContext {
  id_construction: number;
  nom: string;
}

export interface TrajectoryEvent {
  type: TypeEvenement;
  date: string;
  source_type: string;
  source_id: number;
  title: string;
  content: string | null;
  season: SeasonContext | null;
  construction: ConstructionContext | null;
}

export interface TrajectoryPage {
  items: TrajectoryEvent[];
  total: number;
  limit: number;
  offset: number;
}

export interface TrajectoryFiltres {
  seasonId?: number;
  constructionId?: number;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

export const getTrajectory = (filtres?: TrajectoryFiltres): Promise<TrajectoryPage> => {
  const params = new URLSearchParams();
  if (filtres?.seasonId != null) params.set('season_id', String(filtres.seasonId));
  if (filtres?.constructionId != null) params.set('construction_id', String(filtres.constructionId));
  if (filtres?.from) params.set('from', filtres.from);
  if (filtres?.to) params.set('to', filtres.to);
  params.set('limit', String(filtres?.limit ?? 200));
  params.set('offset', String(filtres?.offset ?? 0));
  return apiRequest(`/trajectory?${params.toString()}`);
};
