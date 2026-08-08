import { apiRequest } from './client';

export interface Utilisateur {
  id_utilisateur: number;
  email: string;
  nom: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export function login(email: string, motDePasse: string): Promise<TokenResponse> {
  // /auth/login attend le standard OAuth2PasswordRequestForm : champ "username"
  // (pas "email") — c'est une contrainte du backend, pas un choix du frontend.
  return apiRequest<TokenResponse>('/auth/login', {
    method: 'POST',
    asForm: true,
    body: { username: email, password: motDePasse },
  });
}

export function register(email: string, motDePasse: string, nom: string): Promise<Utilisateur> {
  return apiRequest<Utilisateur>('/auth/register', {
    method: 'POST',
    body: { email, mot_de_passe: motDePasse, nom },
  });
}

export function getMe(): Promise<Utilisateur> {
  return apiRequest<Utilisateur>('/auth/me');
}
