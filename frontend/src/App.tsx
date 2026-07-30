import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import ProtectedLayout from './components/ProtectedLayout';
import { AuthProvider } from './context/AuthContext';
import CapabilitySearchPage from './pages/CapabilitySearchPage';
import CertificationsPage from './pages/CertificationsPage';
import DashboardPage from './pages/DashboardPage';
import GapAnalysisPage from './pages/GapAnalysisPage';
import LoginPage from './pages/LoginPage';
import OrgChartPage from './pages/OrgChartPage';
import OrgStructureBuilderPage from './pages/OrgStructureBuilderPage';
import PositionRequirementsPage from './pages/PositionRequirementsPage';
import ProfilePage from './pages/ProfilePage';
import SkillsAdminPage from './pages/SkillsAdminPage';
import TeamMatrixPage from './pages/TeamMatrixPage';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedLayout />}>
            <Route path="/" element={<Navigate to="/org-chart" replace />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/team" element={<TeamMatrixPage />} />
            <Route path="/requirements" element={<PositionRequirementsPage />} />
            <Route path="/admin/org-structure" element={<OrgStructureBuilderPage />} />
            <Route path="/org-chart" element={<OrgChartPage />} />
            <Route path="/reports/gaps" element={<GapAnalysisPage />} />
            <Route path="/search" element={<CapabilitySearchPage />} />
            <Route path="/admin/skills" element={<SkillsAdminPage />} />
            <Route path="/certifications" element={<CertificationsPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
