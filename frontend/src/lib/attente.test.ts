import { describe, it, expect } from 'vitest';
import { messageAttente, SEUIL_LOIS_S, DUREE_LOI_S } from './attente';
import { LOIS_DE_YIRI } from './phraseDuJour';

describe('messageAttente', () => {
  it('reste sobre au début', () => expect(messageAttente(1)).toEqual({ principal: 'Un instant…', loi: null }));
  it('explique pourquoi c’est long', () => expect(messageAttente(5).principal).toMatch(/se réveille/));
  it('fait défiler les lois de Yiri ensuite, en boucle', () => {
    expect(messageAttente(SEUIL_LOIS_S).loi).toBe(LOIS_DE_YIRI[0]);
    expect(messageAttente(SEUIL_LOIS_S + DUREE_LOI_S).loi).toBe(LOIS_DE_YIRI[1]);
    expect(messageAttente(SEUIL_LOIS_S + DUREE_LOI_S * LOIS_DE_YIRI.length).loi).toBe(LOIS_DE_YIRI[0]);
  });
});
