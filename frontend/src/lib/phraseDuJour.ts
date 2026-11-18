import { ecartEnJours, jourCalendaire } from './dates';

// Remplace l'ancienne MantraCard (« Ne cherche pas à paraître discipliné… »),
// qui contredisait la vision (ton de coach, action comme preuve de valeur).
// Décision de Peniel (17 nov. 2026) : trois sources, dans cet ordre —
//  1. la phrase de Saison écrite par la personne (champ `intention`) ;
//  2. une loi de Yiri quand il n'y a pas de Saison ou pas de phrase ;
//  3. de temps en temps, une ancienne Observation de la personne.
// Rien n'est inventé : soit ce sont ses mots, soit les lois du produit.

export const LOIS_DE_YIRI = [
  "La vie n'est pas un projet.",
  "L'action n'est pas une preuve de valeur.",
  'Les résultats ne sont pas toujours contrôlables.',
  'La réalité peut changer le plan.',
  'Ne rien faire peut être une décision valable.',
] as const;

/** Une ancienne Observation ne revient qu'après ce délai… */
export const AGE_MIN_OBSERVATION_JOURS = 7;
/** …et seulement un jour sur trois, pour rester une surprise. */
export const RYTHME_OBSERVATION_JOURS = 3;

export type SourcePhrase = 'saison' | 'loi' | 'observation';

export interface PhraseDuJour {
  source: SourcePhrase;
  titre: string;
  texte: string;
}

interface Entree {
  aujourdhui: string; // AAAA-MM-JJ
  saison: { nom: string; intention: string | null } | null;
  observations: { contenu: string; date_creation: string }[];
}

function indexDuJour(jour: string): number {
  return Math.max(0, ecartEnJours('2026-01-01', jour));
}

export function choisirPhraseDuJour({ aujourdhui, saison, observations }: Entree): PhraseDuJour {
  const n = indexDuJour(aujourdhui);

  if (n % RYTHME_OBSERVATION_JOURS === 0) {
    const anciennes = observations
      .map((o) => ({ o, jour: jourCalendaire(o.date_creation) }))
      .filter((x): x is { o: Entree['observations'][number]; jour: string } => x.jour !== null)
      .filter((x) => ecartEnJours(x.jour, aujourdhui) >= AGE_MIN_OBSERVATION_JOURS);
    if (anciennes.length > 0) {
      const { o, jour } = anciennes[n % anciennes.length];
      return {
        source: 'observation',
        titre: `Il y a ${ecartEnJours(jour, aujourdhui)} jours, tu as remarqué`,
        texte: `« ${o.contenu} »`,
      };
    }
  }

  const intention = saison?.intention?.trim();
  if (saison && intention) {
    return { source: 'saison', titre: 'Ta phrase pour cette Saison', texte: intention };
  }

  return { source: 'loi', titre: 'Une loi de Yiri', texte: LOIS_DE_YIRI[n % LOIS_DE_YIRI.length] };
}
