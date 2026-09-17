import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { utilisateur, chargement } = useAuth();

  if (chargement) {
    // Évite un flash de la page de login pendant la vérification du token
    // existant au premier chargement de l'app.
    return <div style={{ padding: 40, color: 'var(--text-muted)' }}>Chargement…</div>;
  }

  if (!utilisateur) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
