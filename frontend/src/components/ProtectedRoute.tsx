import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSignalerAttente } from '../lib/attenteServeur';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { utilisateur, chargement } = useAuth();
  // Vérification du jeton existant : peut durer jusqu'à une minute si le
  // serveur se réveille. L'écran de réveil (ReveilGlobal, à la racine)
  // couvre l'attente et s'efface sur la page quand elle arrive.
  useSignalerAttente(chargement);

  if (chargement) return null;

  if (!utilisateur) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
