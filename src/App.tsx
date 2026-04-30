import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ROUTES } from './config/constants';
import LandingPage from './features/landing/LandingPage';
import LoginPage from './features/auth/LoginPage';
import SignupPage from './features/auth/SignupPage';
import DashboardPage from './features/dashboard/DashboardPage';
import InterviewPage from './features/interview/InterviewPage';
import ProfilePage from './features/profile/ProfilePage';
import KnowledgeChatPage from './features/knowledge/KnowledgeChatPage';
import ProtectedRoute from './components/shared/ProtectedRoute';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path={ROUTES.LANDING} element={<LandingPage />} />
        <Route path={ROUTES.LOGIN} element={<LoginPage />} />
        <Route path={ROUTES.SIGNUP} element={<SignupPage />} />
        
        <Route path={ROUTES.DASHBOARD} element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        } />
        
        <Route path={ROUTES.INTERVIEW} element={
          <ProtectedRoute allowedRoles={['retiree']}>
            <InterviewPage />
          </ProtectedRoute>
        } />
        
        <Route path={ROUTES.PROFILE} element={
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        } />

        <Route path={ROUTES.KNOWLEDGE_CHAT} element={
          <ProtectedRoute allowedRoles={['successor']}>
            <KnowledgeChatPage />
          </ProtectedRoute>
        } />
        
        <Route path="*" element={<Navigate to={ROUTES.LANDING} replace />} />
      </Routes>
    </Router>
  );
}
