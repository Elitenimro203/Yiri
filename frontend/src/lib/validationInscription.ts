// Validation de l'inscription côté navigateur, alignée sur le backend
// (schemas/auth.py : nom 1–100 caractères, mot de passe 8–72 OCTETS — bcrypt
// ignore tout au-delà de 72 octets). On vérifie avant l'envoi pour donner un
// message clair plutôt qu'une erreur 422 brute.

export const MDP_MIN_CARACTERES = 8;
export const MDP_MAX_OCTETS = 72;

export interface SaisieInscription {
  nom: string;
  email: string;
  motDePasse: string;
  confirmation: string;
}

export function octets(texte: string): number {
  return new TextEncoder().encode(texte).length;
}

/** Message d'erreur à afficher, ou null si tout est bon. */
export function validerInscription({ nom, email, motDePasse, confirmation }: SaisieInscription): string | null {
  if (!nom.trim()) return 'Indique ton prénom ou ton nom.';
  if (nom.trim().length > 100) return 'Ton nom doit faire au plus 100 caractères.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return "Cette adresse email n'a pas l'air valide.";
  if ([...motDePasse].length < MDP_MIN_CARACTERES) return `Ton mot de passe doit faire au moins ${MDP_MIN_CARACTERES} caractères.`;
  if (octets(motDePasse) > MDP_MAX_OCTETS) return 'Ton mot de passe est trop long (72 octets au maximum).';
  if (motDePasse !== confirmation) return 'Les deux mots de passe ne correspondent pas.';
  return null;
}
