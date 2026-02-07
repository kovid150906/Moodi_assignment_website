import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Users from './pages/Users';
import Admins from './pages/Admins';
import Competitions from './pages/Competitions';
import CompetitionDashboard from './pages/CompetitionDashboard';
import RoundManagement from './pages/RoundManagement';
import Templates from './pages/Templates';
import TemplateDetail from './pages/TemplateDetail';
import Certificates from './pages/Certificates';
import ChangePassword from './pages/ChangePassword';
import './index.css';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<Login />} />

          {/* Protected */}
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <Layout><Dashboard /></Layout>
            </ProtectedRoute>
          } />
          <Route path="/users" element={
            <ProtectedRoute>
              <Layout><Users /></Layout>
            </ProtectedRoute>
          } />
          <Route path="/competitions" element={
            <ProtectedRoute>
              <Layout><Competitions /></Layout>
            </ProtectedRoute>
          } />
          <Route path="/competitions/:competitionId/dashboard" element={
            <ProtectedRoute>
              <Layout><CompetitionDashboard /></Layout>
            </ProtectedRoute>
          } />
          <Route path="/competitions/:competitionId/rounds" element={
            <ProtectedRoute>
              <Layout><RoundManagement /></Layout>
            </ProtectedRoute>
          } />
          <Route path="/certificates" element={
            <ProtectedRoute>
              <Layout><Certificates /></Layout>
            </ProtectedRoute>
          } />

          {/* Admin Only */}
          <Route path="/admins" element={
            <ProtectedRoute adminOnly>
              <Layout><Admins /></Layout>
            </ProtectedRoute>
          } />
          {/* Templates - available to all admins (coordinators can manage templates) */}
          <Route path="/templates" element={
            <ProtectedRoute>
              <Layout><Templates /></Layout>
            </ProtectedRoute>
          } />
          <Route path="/templates/:id" element={
            <ProtectedRoute>
              <Layout><TemplateDetail /></Layout>
            </ProtectedRoute>
          } />
          <Route path="/change-password" element={
            <ProtectedRoute>
              <Layout><ChangePassword /></Layout>
            </ProtectedRoute>
          } />

          {/* Redirect */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
