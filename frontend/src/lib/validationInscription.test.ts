import { describe, expect, it } from 'vitest';
import { validerInscription } from './validationInscription';

const ok = { nom: 'Peniel', email: 'peniel@exemple.ci', motDePasse: 'motdepasse', confirmation: 'motdepasse' };

describe("validation de l'inscription", () => {
  it('accepte une saisie correcte', () => {
    expect(validerInscription(ok)).toBeNull();
  });
  it('exige un nom', () => {
    expect(validerInscription({ ...ok, nom: '   ' })).toMatch(/nom/);
  });
  it('refuse un email invalide', () => {
    expect(validerInscription({ ...ok, email: 'peniel@' })).toMatch(/email/);
  });
  it('exige au moins 8 caractères', () => {
    expect(validerInscription({ ...ok, motDePasse: 'court', confirmation: 'court' })).toMatch(/au moins 8/);
  });
  it('refuse plus de 72 octets (limite bcrypt), même avec peu de caractères', () => {
    const emojis = '🌱'.repeat(19); // 19 caractères, 76 octets
    expect(validerInscription({ ...ok, motDePasse: emojis, confirmation: emojis })).toMatch(/trop long/);
  });
  it('vérifie la confirmation', () => {
    expect(validerInscription({ ...ok, confirmation: 'autrechose' })).toMatch(/correspondent/);
  });
});
