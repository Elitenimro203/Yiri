export const JOURS = [
  { iso: 1, label: 'L', nom: 'lundi' }, { iso: 2, label: 'M', nom: 'mardi' }, { iso: 3, label: 'M', nom: 'mercredi' },
  { iso: 4, label: 'J', nom: 'jeudi' }, { iso: 5, label: 'V', nom: 'vendredi' }, { iso: 6, label: 'S', nom: 'samedi' },
  { iso: 7, label: 'D', nom: 'dimanche' },
];

// « 1,2,3,4,5 » -> « Du lundi au vendredi » ; lisible plutôt que technique.
export function libelleJours(joursActifs: string): string {
  const isos = joursActifs.split(',').map((x) => parseInt(x, 10)).filter((n) => n >= 1 && n <= 7).sort((a, b) => a - b);
  const cle = isos.join(',');
  if (cle === '1,2,3,4,5,6,7') return 'Tous les jours';
  if (cle === '1,2,3,4,5') return 'En semaine';
  if (cle === '6,7') return 'Le week-end';
  return isos.map((n) => JOURS[n - 1].nom).join(', ');
}

