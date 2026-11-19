import { describe, it, expect } from 'vitest';
import { pousserArbre, poser, positionAccroche, noteSilhouette, generateur } from './arbreGeneratif';

const L = 360, SOL = 312, H = 340;

describe('arbre génératif', () => {
  it('est reproductible pour une même graine', () => {
    const a = pousserArbre(4, L / 2, SOL, H, L);
    const b = pousserArbre(4, L / 2, SOL, H, L);
    expect(a.branches.length).toBe(b.branches.length);
    expect(a.feuilles[0].dx).toBe(b.feuilles[0].dx);
  });

  it('tient toujours dans la toile, sur 30 arbres', () => {
    for (let g = 1; g <= 30; g++) {
      const a = pousserArbre(g, L / 2, SOL, H, L);
      const poses = poser(a, L / 2, SOL, () => 0);
      for (const f of a.feuilles) {
        const [x, y] = positionAccroche(poses, a, f);
        expect(x - f.r * a.echelle).toBeGreaterThanOrEqual(0);
        expect(x + f.r * a.echelle).toBeLessThanOrEqual(L);
        expect(y - f.r * a.echelle).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('chaque branche naît à l’épaisseur où sa mère se termine', () => {
    const a = pousserArbre(9, L / 2, SOL, H, L);
    for (const b of a.branches) if (b.parent >= 0) expect(b.epDebut).toBeCloseTo(a.branches[b.parent].epFin);
  });

  it('écarte les silhouettes ratées : la moyenne retenue dépasse la moyenne brute', () => {
    let retenues = 0;
    for (let g = 1; g <= 20; g++) retenues += noteSilhouette(pousserArbre(g, L / 2, SOL, H, L), L / 2, SOL);
    expect(retenues / 20).toBeGreaterThan(0.6);
  });

  it('le générateur reste dans [0, 1)', () => {
    const r = generateur(123);
    for (let i = 0; i < 1000; i++) { const v = r(); expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(1); }
  });
});
