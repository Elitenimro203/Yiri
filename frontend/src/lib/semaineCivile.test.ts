import { describe, expect, it } from 'vitest';
import type { Action } from '../api/actions';
import { actionsDeLaSemaine, bornesSemaineCivile } from './semaineCivile';

let id = 0;
function action(date_action: string | null, id_axe = 1): Action {
  id += 1;
  return { id_entree: id, id_axe, id_engagement: null, date_action, contenu: null };
}

// Mercredi 18 novembre 2026, 15h (heure locale).
const MERCREDI = new Date(2026, 10, 18, 15, 0);

describe('bornesSemaineCivile', () => {
  it('va du lundi inclus au lundi suivant exclu', () => {
    expect(bornesSemaineCivile(MERCREDI)).toEqual({ debut: '2026-11-16', fin: '2026-11-23' });
  });
  it('un lundi est le début de sa propre semaine', () => {
    expect(bornesSemaineCivile(new Date(2026, 10, 16, 0, 5)).debut).toBe('2026-11-16');
  });
  it('un dimanche appartient à la semaine commencée le lundi précédent', () => {
    expect(bornesSemaineCivile(new Date(2026, 10, 22, 23, 59)).debut).toBe('2026-11-16');
  });
});

describe('actionsDeLaSemaine — Mission 11', () => {
  it('A : deux Actions modernes dans la semaine → 2', () => {
    const actions = [action('2026-11-16T00:00:00'), action('2026-11-18T09:30:00')];
    expect(actionsDeLaSemaine(actions, MERCREDI)).toHaveLength(2);
  });

  it('B : deux Actions modernes + deux cases Wakati (sans date_action) → 2, pas 4', () => {
    const actions = [
      action('2026-11-17T00:00:00'),
      action('2026-11-18T00:00:00'),
      action(null),
      action(null),
    ];
    expect(actionsDeLaSemaine(actions, MERCREDI)).toHaveLength(2);
  });

  it('C : une Construction sélectionnée ne montre que ses Actions', () => {
    const actions = [action('2026-11-17T00:00:00', 1), action('2026-11-17T00:00:00', 2), action('2026-11-18T00:00:00', 2)];
    expect(actionsDeLaSemaine(actions, MERCREDI, 2).map((a) => a.id_axe)).toEqual([2, 2]);
    expect(actionsDeLaSemaine(actions, MERCREDI, null)).toHaveLength(3);
  });

  it('F : frontières — lundi 00:00 compté, dimanche précédent et lundi suivant exclus', () => {
    const actions = [
      action('2026-11-16T00:00:00'), // lundi, compté
      action('2026-11-15T23:59:00'), // dimanche de la semaine passée
      action('2026-11-23T00:00:00'), // lundi suivant
    ];
    expect(actionsDeLaSemaine(actions, MERCREDI).map((a) => a.date_action)).toEqual(['2026-11-16T00:00:00']);
  });
});
