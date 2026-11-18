import { describe, expect, it } from 'vitest';
import type { Action } from '../api/actions';
import type { Observation } from '../api/observations';
import { aujourdhuiLocal, ecartEnJours, libelleJourRelatif } from './dates';
import { construireFil, derniereTrace } from './traces';
import { LOIS_DE_YIRI, choisirPhraseDuJour } from './phraseDuJour';

let n = 0;
const action = (date_action: string | null, id_axe = 1, contenu: string | null = 'fait'): Action => {
  n += 1;
  return { id_entree: n, id_axe, id_engagement: null, date_action, contenu };
};
const obs = (date_creation: string, contenu = 'remarque', id_axe: number | null = null): Observation => {
  n += 1;
  return { id_observation: n, id_utilisateur: 1, id_axe, id_entree: null, contenu, date_creation };
};

describe('dates', () => {
  it("aujourdhuiLocal utilise l'heure locale, pas UTC", () => {
    // 23h30 le 17 en heure locale reste le 17, quel que soit le fuseau.
    expect(aujourdhuiLocal(new Date(2026, 10, 17, 23, 30))).toBe('2026-11-17');
  });
  it('libellés relatifs', () => {
    expect(libelleJourRelatif('2026-11-18', '2026-11-18')).toBe("Aujourd'hui");
    expect(libelleJourRelatif('2026-11-17', '2026-11-18')).toBe('Hier');
    expect(libelleJourRelatif('2026-11-15', '2026-11-18')).toBe('Dim.');
    expect(libelleJourRelatif('2026-11-02', '2026-11-18')).toMatch(/2 nov/);
    expect(ecartEnJours('2026-10-29', '2026-11-18')).toBe(20);
  });
});

describe('fil des traces', () => {
  it('mêle Actions, Observations et Décisions du plus récent au plus ancien', () => {
    const fil = construireFil(
      [action('2026-11-17T00:00:00', 1, 'Conversation avec Awa')],
      [obs('2026-11-15T19:00:00', 'Je parle mieux quand ça m’intéresse')],
      [{ id: 9, dateCreation: '2026-11-12T10:00:00', libelle: 'Réduire', remarque: null, idConstruction: 2 }],
    );
    expect(fil.map((t) => t.type)).toEqual(['action', 'observation', 'decision']);
    expect(fil[2].texte).toBe('Décidé : réduire');
  });
  it("n'invente jamais de date : une case Wakati sans date_action est exclue", () => {
    const fil = construireFil([action(null), action('2026-11-17T00:00:00')], [], []);
    expect(fil).toHaveLength(1);
  });
  it('respecte la limite', () => {
    const actions = Array.from({ length: 10 }, (_, i) => action(`2026-11-${String(i + 1).padStart(2, '0')}T00:00:00`));
    expect(construireFil(actions, [], [], 6)).toHaveLength(6);
  });
  it('dernière trace par Construction', () => {
    const actions = [action('2026-11-10T00:00:00', 1), action('2026-11-16T00:00:00', 1), action('2026-11-17T00:00:00', 2), action(null, 1)];
    expect(derniereTrace(actions, 1)).toBe('2026-11-16');
    expect(derniereTrace(actions, 3)).toBeNull();
  });
});

describe('phrase du jour (remplace MantraCard)', () => {
  // 2026-01-01 + 1 jour : index 1, pas un jour « Observation » (1 % 3 ≠ 0).
  const jourNormal = '2026-01-02';
  // Index 3 : jour où une ancienne Observation peut revenir.
  const jourObservation = '2026-01-04';
  const saison = { nom: 'Poser les bases', intention: 'Poser les bases sans m’épuiser' };

  it('1. la phrase de Saison écrite par la personne', () => {
    expect(choisirPhraseDuJour({ aujourdhui: jourNormal, saison, observations: [] })).toEqual({
      source: 'saison', titre: 'Ta phrase pour cette Saison', texte: 'Poser les bases sans m’épuiser',
    });
  });
  it('2. une loi de Yiri sans Saison, ou avec une Saison sans phrase', () => {
    const sansSaison = choisirPhraseDuJour({ aujourdhui: jourNormal, saison: null, observations: [] });
    const sansPhrase = choisirPhraseDuJour({ aujourdhui: jourNormal, saison: { nom: 'S', intention: '  ' }, observations: [] });
    for (const p of [sansSaison, sansPhrase]) {
      expect(p.source).toBe('loi');
      expect(LOIS_DE_YIRI).toContain(p.texte);
    }
  });
  it("3. une ancienne Observation (≥ 7 jours), un jour sur trois", () => {
    const p = choisirPhraseDuJour({ aujourdhui: jourObservation, saison, observations: [obs('2025-12-20T08:00:00', 'Je code mieux le matin')] });
    expect(p).toEqual({ source: 'observation', titre: 'Il y a 15 jours, tu as remarqué', texte: '« Je code mieux le matin »' });
  });
  it("une Observation trop récente ne revient pas : on retombe sur la Saison", () => {
    const p = choisirPhraseDuJour({ aujourdhui: jourObservation, saison, observations: [obs('2026-01-02T08:00:00')] });
    expect(p.source).toBe('saison');
  });
  it("aucune phrase ne parle de discipline, de score ni de résultats", () => {
    for (const loi of LOIS_DE_YIRI) expect(loi).not.toMatch(/disciplin|score|%|résultats composés|preuve(s)? de toi/i);
  });
});
