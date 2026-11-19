import { useCallback, useEffect, useState } from 'react';

// Apparence choisie par la personne : un thème (fond × accent) et une
// intensité. Préférence légère et propre à ce navigateur : localStorage,
// toujours protégé par try/catch (indisponible en navigation privée, etc.).

export const THEMES = [
  { id: 'blanc', nom: 'Blanc', bg: '#FFFFFF', accent: '#2346B8' },
  { id: 'noir', nom: 'Noir', bg: '#0B0B0C', accent: '#3958BF' },
  { id: 'lagune', nom: 'Lagune', bg: '#E5EEEB', accent: '#1F6F68' },
  { id: 'hibiscus', nom: 'Hibiscus', bg: '#FBEDEE', accent: '#B0284A' },
  { id: 'atlantique', nom: 'Atlantique', bg: '#F5F2EA', accent: '#14467A' },
  { id: 'mangue', nom: 'Mangue', bg: '#FFF4E2', accent: '#C96F0E' },
  { id: 'menthe', nom: 'Menthe', bg: '#E9F4EC', accent: '#1F7A4D' },
  { id: 'lilas', nom: 'Lilas', bg: '#F1EDF7', accent: '#6B4FB3' },
] as const;

export type ThemeId = (typeof THEMES)[number]['id'];
export type Intensite = 'calme' | 'affirmee';

export interface Apparence {
  theme: ThemeId;
  intensite: Intensite;
}

const CLE = 'yiri.apparence';
const DEFAUT: Apparence = { theme: 'blanc', intensite: 'calme' };

function estTheme(v: unknown): v is ThemeId {
  return THEMES.some((t) => t.id === v);
}

export function lireApparence(): Apparence {
  try {
    const brut = JSON.parse(localStorage.getItem(CLE) ?? 'null');
    return {
      theme: estTheme(brut?.theme) ? brut.theme : DEFAUT.theme,
      intensite: brut?.intensite === 'affirmee' ? 'affirmee' : 'calme',
    };
  } catch {
    return DEFAUT;
  }
}

// Encre (couleur du texte) de chaque thème : le document entier en hérite,
// y compris ce qui s'affiche avant qu'une page Yiri soit montée.
const ENCRE: Record<ThemeId, string> = {
  blanc: '#111214', noir: '#F2F2F3', lagune: '#10302D', hibiscus: '#2A1418',
  atlantique: '#0E1F33', mangue: '#2B1B0E', menthe: '#12291C', lilas: '#211A33',
};

/** Fond du document et barre d'état du téléphone, alignés sur le thème. */
export function appliquerFondDocument(theme: ThemeId): void {
  const fond = THEMES.find((t) => t.id === theme)?.bg ?? '#FFFFFF';
  const racine = document.documentElement;
  racine.style.background = fond;
  racine.style.color = ENCRE[theme];
  racine.style.colorScheme = theme === 'noir' ? 'dark' : 'light';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', fond);
}

export function useApparence(): [Apparence, (changement: Partial<Apparence>) => void] {
  const [apparence, setApparence] = useState<Apparence>(lireApparence);

  useEffect(() => {
    try {
      localStorage.setItem(CLE, JSON.stringify(apparence));
    } catch {
      /* préférence non conservée : sans conséquence */
    }
    appliquerFondDocument(apparence.theme);
  }, [apparence]);

  const changer = useCallback((changement: Partial<Apparence>) => {
    setApparence((prev) => ({ ...prev, ...changement }));
  }, []);

  return [apparence, changer];
}
