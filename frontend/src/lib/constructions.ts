import type { Construction } from '../api/constructions';

// Regroupement des Constructions sur la page Constructions. Les statuts
// décrivent une relation avec la Construction, pas une note (vision §23) :
// « terminée » ou « abandonnée » ne sont pas des échecs, juste des choses qui
// ne demandent plus d'attention aujourd'hui.

export interface Groupes {
  /** Constructions actives ou en pause rattachées à la Saison active. */
  saison: Construction[];
  /** Constructions actives ou en pause hors de la Saison active (ou toutes s'il n'y a pas de Saison). */
  horsSaison: Construction[];
  /** Terminées ou abandonnées, quelle que soit la Saison. */
  closes: Construction[];
}

const parOrdre = (a: Construction, b: Construction) => a.ordre_affichage - b.ordre_affichage;

export function estClose(c: Construction): boolean {
  return c.statut === 'terminee' || c.statut === 'abandonnee';
}

export function grouperConstructions(liste: Construction[], idSaisonActive: number | null): Groupes {
  const ouvertes = liste.filter((c) => !estClose(c)).sort(parOrdre);
  return {
    saison: idSaisonActive == null ? [] : ouvertes.filter((c) => c.id_saison === idSaisonActive),
    horsSaison: idSaisonActive == null ? ouvertes : ouvertes.filter((c) => c.id_saison !== idSaisonActive),
    closes: liste.filter(estClose).sort(parOrdre),
  };
}

export const LIBELLES_STATUT: Record<NonNullable<Construction['statut']>, string> = {
  active: 'Active',
  en_pause: 'En pause',
  terminee: 'Terminée',
  abandonnee: 'Abandonnée',
};
