import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import * as authApi from '../api/auth';
import { getToken, setToken, clearToken, ApiError } from '../api/client';

interface AuthContextValue {
  utilisateur: authApi.Utilisateur | null;
  /** true tant qu'on vérifie un token existant au chargement — évite un flash de la page de login */
  chargement: boolean;
  connecter: (email: string, motDePasse: string) => Promise<void>;
  deconnecter: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [utilisateur, setUtilisateur] = useState<authApi.Utilisateur | null>(null);
  const [chargement, setChargement] = useState(true);

  const deconnecter = useCallback(() => {
    clearToken();
    setUtilisateur(null);
  }, []);

  // Au montage : si un token existe déjà (session précédente), on vérifie qu'il
  // est toujours valide via /auth/me plutôt que de faire confiance à sa seule
  // présence — un token peut avoir expiré (observé concrètement pendant les
  // tests backend : 60 minutes de validité par défaut).
  useEffect(() => {
    const token = getToken();
    if (!token) {
      setChargement(false);
      return;
    }
    authApi
      .getMe()
      .then(setUtilisateur)
      .catch(() => clearToken())
      .finally(() => setChargement(false));
  }, []);

  const connecter = useCallback(async (email: string, motDePasse: string) => {
    const { access_token } = await authApi.login(email, motDePasse);
    setToken(access_token);
    const me = await authApi.getMe();
    setUtilisateur(me);
  }, []);

  return (
    <AuthContext.Provider value={{ utilisateur, chargement, connecter, deconnecter }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé à l\'intérieur de <AuthProvider>');
  return ctx;
}

export { ApiError };
