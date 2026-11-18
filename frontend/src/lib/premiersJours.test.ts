import { describe, it, expect } from 'vitest';
import { etapeDebut, actionsLibres } from './premiersJours';
import type { Action } from '../api/actions';
import type { Observation } from '../api/observations';
import type { Construction } from '../api/constructions';

const action = (id: number, id_axe: number | null): Action => ({ id_entree: id, id_axe, id_engagement: null, date_action: '2026-11-18T10:00:00', contenu: 'x' });
const obs: Observation = { id_observation: 1, id_utilisateur: 1, id_axe: null, id_entree: null, contenu: 'x', date_creation: '2026-11-18T10:00:00' };
const construction: Construction = { id_construction: 1, id_saison: null, nom: 'A', intention: null, statut: 'active', ordre_affichage: 0, date_creation: null };

describe('etapeDebut', () => {
  it('vide sans rien', () => expect(etapeDebut([], [], [])).toBe('vide'));
  it('premières traces avec une action libre', () => expect(etapeDebut([], [action(1, null)], [])).toBe('premieresTraces'));
  it('premières traces avec une seule observation', () => expect(etapeDebut([], [], [obs])).toBe('premieresTraces'));
  it('installé dès une Construction, même sans trace', () => expect(etapeDebut([construction], [], [])).toBe('installe'));
});

describe('actionsLibres', () => {
  it('garde seulement les Actions sans Construction', () => {
    expect(actionsLibres([action(1, null), action(2, 3), action(3, null)]).map((a) => a.id_entree)).toEqual([1, 3]);
  });
});
