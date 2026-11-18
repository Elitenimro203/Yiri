// Dates calendaires (AAAA-MM-JJ) en heure locale. On compare toujours des jours
// calendaires, jamais des instants `new Date(iso)` : l'API renvoie des dates
// sans fuseau que le navigateur décalerait d'un jour selon le fuseau.

export function formatJourLocal(date: Date): string {
  const annee = date.getFullYear();
  const mois = String(date.getMonth() + 1).padStart(2, '0');
  const jour = String(date.getDate()).padStart(2, '0');
  return `${annee}-${mois}-${jour}`;
}

/** Aujourd'hui en heure locale (et non en UTC comme `toISOString()`). */
export function aujourdhuiLocal(maintenant: Date = new Date()): string {
  return formatJourLocal(maintenant);
}

/** Jour calendaire d'une date renvoyée par l'API, ou null si absente. */
export function jourCalendaire(iso: string | null | undefined): string | null {
  return iso ? iso.slice(0, 10) : null;
}

function versDate(jour: string): Date {
  const [a, m, j] = jour.split('-').map(Number);
  return new Date(a, m - 1, j);
}

/** Nombre de jours entiers entre deux jours calendaires (b - a). */
export function ecartEnJours(a: string, b: string): number {
  return Math.round((versDate(b).getTime() - versDate(a).getTime()) / 86_400_000);
}

const JOURS_COURTS = ['Dim.', 'Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.'];

/** « Aujourd'hui », « Hier », « Dim. » (cette semaine) ou « 12 nov. ». */
export function libelleJourRelatif(jour: string, aujourdhui: string): string {
  const ecart = ecartEnJours(jour, aujourdhui);
  if (ecart === 0) return "Aujourd'hui";
  if (ecart === 1) return 'Hier';
  const date = versDate(jour);
  if (ecart > 1 && ecart < 7) return JOURS_COURTS[date.getDay()];
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}
