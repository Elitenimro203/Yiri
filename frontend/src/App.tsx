import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import CulturePage from './pages/CulturePage';
import ProgressionPage from './pages/ProgressionPage';
import RevuePage from './pages/RevuePage';
import RappelsPage from './pages/RappelsPage';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/culture"
            element={
              <ProtectedRoute>
                <CulturePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/progression"
            element={
              <ProtectedRoute>
                <ProgressionPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/revue"
            element={
              <ProtectedRoute>
                <RevuePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/rappels"
            element={
              <ProtectedRoute>
                <RappelsPage />
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
