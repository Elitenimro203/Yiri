/**
 * Client API centralisé — TOUT appel au backend passe par ici.
 *
 * Pourquoi centraliser plutôt que faire fetch() dans chaque composant :
 * le token, la base URL, et la gestion des erreurs 401 (token expiré, comme
 * observé pendant les tests Swagger) ne doivent exister qu'à UN seul endroit.
 * Sinon, le jour où on change la stratégie d'auth, il faut la changer dans
 * chaque composant qui fait un fetch — source classique de bugs incohérents.
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const TOKEN_KEY = 'yiri_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public detail: string
  ) {
    super(detail);
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  /** true pour /auth/login qui attend du form-urlencoded, pas du JSON */
  asForm?: boolean;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, asForm = false } = options;

  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let requestBody: BodyInit | undefined;
  if (body !== undefined) {
    if (asForm) {
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
      requestBody = new URLSearchParams(body as Record<string, string>).toString();
    } else {
      headers['Content-Type'] = 'application/json';
      requestBody = JSON.stringify(body);
    }
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: requestBody,
  });

  // 204 No Content : rien à parser, sinon response.json() lèverait une erreur
  // sur un corps vide.
  if (response.status === 204) {
    return undefined as T;
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    // Cas observé pendant les tests : token expiré → 401 "Identifiants invalides
    // ou expirés". On le propage tel quel, à l'appelant (AuthContext) de décider
    // de déconnecter l'utilisateur plutôt que de le faire ici en silence — sinon
    // une page qui charge plusieurs ressources en parallèle déclencherait
    // plusieurs redirections concurrentes.
    const detail = data?.detail ?? `Erreur ${response.status}`;
    throw new ApiError(response.status, typeof detail === 'string' ? detail : JSON.stringify(detail));
  }

  return data as T;
}
