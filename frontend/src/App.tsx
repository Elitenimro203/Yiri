import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import TodayPage from './pages/TodayPage';
import ConstructionsPage from './pages/ConstructionsPage';
import TrajectoryPage from './pages/TrajectoryPage';
import ReflectionsPage from './pages/ReflectionsPage';
import RappelsPage from './pages/RappelsPage';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          {/* Routes cibles Yiri 2 (cahier des charges §30) */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <TodayPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/today"
            element={
              <ProtectedRoute>
                <TodayPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/constructions"
            element={
              <ProtectedRoute>
                <ConstructionsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/trajectory"
            element={
              <ProtectedRoute>
                <TrajectoryPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reflections"
            element={
              <ProtectedRoute>
                <ReflectionsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reminders"
            element={
              <ProtectedRoute>
                <RappelsPage />
              </ProtectedRoute>
            }
          />

          {/*
            Anciennes routes conservées en redirection pendant la migration
            (cahier des charges §30) — pour ne pas casser un lien ou un
            favori existant (ex. écran d'accueil iOS pointant vers /culture).
          */}
          <Route path="/culture" element={<Navigate to="/constructions" replace />} />
          <Route path="/progression" element={<Navigate to="/trajectory" replace />} />
          <Route path="/revue" element={<Navigate to="/reflections" replace />} />
          <Route path="/rappels" element={<Navigate to="/reminders" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
