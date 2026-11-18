import { describe, expect, it } from 'vitest';
import type { Construction } from '../api/constructions';
import { grouperConstructions } from './constructions';

let n = 0;
const c = (statut: Construction['statut'], id_saison: number | null, ordre = 0): Construction => {
  n += 1;
  return { id_construction: n, id_saison, nom: `C${n}`, intention: null, statut, ordre_affichage: ordre, date_creation: null };
};

describe('grouperConstructions', () => {
  it('sépare Saison active, hors Saison et closes', () => {
    const a = c('active', 1), b = c('en_pause', 1), h = c('active', null), autre = c('active', 2), t = c('terminee', 1), x = c('abandonnee', null);
    const g = grouperConstructions([a, b, h, autre, t, x], 1);
    expect(g.saison).toEqual([a, b]);
    expect(g.horsSaison).toEqual([h, autre]);
    expect(g.closes).toEqual([t, x]);
  });

  it('sans Saison active, toutes les Constructions ouvertes sont hors Saison (le flux fonctionne sans Saison)', () => {
    const a = c('active', 1), h = c('active', null);
    const g = grouperConstructions([a, h], null);
    expect(g.saison).toEqual([]);
    expect(g.horsSaison).toEqual([a, h]);
  });

  it('une Construction historique Wakati (statut null) reste ouverte, jamais rangée parmi les closes', () => {
    const w = c(null, null);
    expect(grouperConstructions([w], null).horsSaison).toEqual([w]);
  });

  it("respecte l'ordre d'affichage choisi", () => {
    const deux = c('active', null, 2), un = c('active', null, 1);
    expect(grouperConstructions([deux, un], null).horsSaison).toEqual([un, deux]);
  });
});
