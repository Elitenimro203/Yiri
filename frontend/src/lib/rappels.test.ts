import { describe, it, expect } from 'vitest';
import { libelleJours } from './rappels';

describe('libelleJours', () => {
  it('nomme les cas courants', () => {
    expect(libelleJours('1,2,3,4,5,6,7')).toBe('Tous les jours');
    expect(libelleJours('5,4,3,2,1')).toBe('En semaine');
    expect(libelleJours('6,7')).toBe('Le week-end');
  });
  it('liste les jours sinon, dans l’ordre', () => {
    expect(libelleJours('3,1')).toBe('lundi, mercredi');
  });
  it('ignore les valeurs invalides', () => {
    expect(libelleJours('0,2,9')).toBe('mardi');
  });
});
