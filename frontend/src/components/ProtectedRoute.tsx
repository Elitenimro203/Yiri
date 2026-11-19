import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import EcranReveil from './yiri/EcranReveil';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { utilisateur, chargement } = useAuth();

  if (chargement) {
    // Vérification du jeton existant : peut durer jusqu'à une minute si le
    // serveur se réveille. Écran aux couleurs du thème, jamais un écran vide.
    return <EcranReveil />;
  }

  if (!utilisateur) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
