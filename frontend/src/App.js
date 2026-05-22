import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useLocation, useNavigate } from 'react-router-dom';
import './styles/global.css';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import PatientsPage from './pages/PatientsPage';
import TrialsPage from './pages/TrialsPage';
import MatchesPage from './pages/MatchesPage';
import SitesPage from './pages/SitesPage';
import EnrollmentsPage from './pages/EnrollmentsPage';
import AdverseEventsPage from './pages/AdverseEventsPage';
import ProtocolsPage from './pages/ProtocolsPage';
import BiomarkersPage from './pages/BiomarkersPage';
import DrugInteractionsPage from './pages/DrugInteractionsPage';
import RegulatoryPage from './pages/RegulatoryPage';
import NotificationsPage from './pages/NotificationsPage';
import ReportsPage from './pages/ReportsPage';
import EligibilityPage from './pages/EligibilityPage';
import OutcomesPage from './pages/OutcomesPage';
import AIToolsPage from './pages/AIToolsPage';
import WebhooksPage from './pages/WebhooksPage';
import CustomViewsPage from './pages/CustomViewsPage';
import RetentionRiskPage from './pages/RetentionRiskPage';

import CodexCustomVizFeature from './pages/CodexCustomVizFeature';
import CodexOperationsFeature from './pages/CodexOperationsFeature';

import TimelineView from './pages/TimelineView';

function Sidebar({ user, onLogout }) {
  const location = useLocation();
  const navItems = [
    { path: '/', icon: '\u{1F3E0}', label: 'Dashboard' },
    { path: '/patients', icon: '\u{1F9D1}\u200D\u2695\uFE0F', label: 'Patients' },
    { path: '/trials', icon: '\u{1F9EA}', label: 'Clinical Trials' },
    { path: '/matches', icon: '\u{1F3AF}', label: 'AI Matching' },
    { path: '/ai-tools', icon: '\u2728', label: 'AI Tools' },
    { path: '/eligibility', icon: '\u2705', label: 'Eligibility' },
    { path: '/sites', icon: '\u{1F3E5}', label: 'Sites' },
    { path: '/enrollments', icon: '\u{1F4CB}', label: 'Enrollments' },
    { path: '/retention-risk', icon: '\u{1F9ED}', label: 'Retention Risk' },
    { path: '/adverse-events', icon: '\u26A0\uFE0F', label: 'Adverse Events' },
    { path: '/protocols', icon: '\u{1F4D1}', label: 'Protocols' },
    { path: '/biomarkers', icon: '\u{1F9EC}', label: 'Biomarkers' },
    { path: '/drug-interactions', icon: '\u{1F48A}', label: 'Drug Interactions' },
    { path: '/outcomes', icon: '\u{1F4CA}', label: 'Outcomes' },
    { path: '/regulatory', icon: '\u{1F4DC}', label: 'Regulatory' },
    { path: '/notifications', icon: '\u{1F514}', label: 'Notifications' },
    { path: '/reports', icon: '\u{1F4C4}', label: 'Reports' },
    { path: '/webhooks', icon: '\u{1FA9D}', label: 'Webhooks' },
    { path: '/custom-views', icon: '\u{1F4CA}', label: 'Trial Views' },
  ];

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h2>ClinicalTrialAI</h2>
        <p>Intelligent Matching Platform</p>
      </div>
      <nav className="sidebar-nav">
        {navItems.map(item => (
          <Link
            key={item.path}
            to={item.path}
            className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
          >
            <span className="nav-icon">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="sidebar-footer">
        <div className="user-info">
          <div className="user-avatar">{user?.name?.charAt(0) || 'U'}</div>
          <div>
            <div className="user-name">{user?.name}</div>
            <div className="user-role">{user?.role}</div>
          </div>
        </div>
        <button className="logout-btn" onClick={onLogout}>Logout</button>
      </div>
    </div>
  );
}

function ProtectedLayout({ children, user, onLogout }) {
  return (
    <div className="app-layout">
      <Sidebar user={user} onLogout={onLogout} />
      <div className="main-content">{children}</div>
    </div>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (stored) setUser(JSON.parse(stored));
  }, []);

  const handleLogin = (userData, tokenData) => {
    setUser(userData);
    setToken(tokenData);
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('token', tokenData);
  };

  const handleLogout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
  };

  if (!token || !user) {
    return (
      <Router>
        <Routes>
        <Route path="/insights/timeline" element={<TimelineView />} />
        <Route path="/codex/custom-viz" element={<CodexCustomVizFeature />} />
        <Route path="/codex/operations" element={<CodexOperationsFeature />} />

          <Route path="*" element={<LoginPage onLogin={handleLogin} />} />
        </Routes>
      </Router>
    );
  }

  return (
    <Router>
      <ProtectedLayout user={user} onLogout={handleLogout}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/patients" element={<PatientsPage />} />
          <Route path="/trials" element={<TrialsPage />} />
          <Route path="/matches" element={<MatchesPage />} />
          <Route path="/ai-tools" element={<AIToolsPage />} />
          <Route path="/eligibility" element={<EligibilityPage />} />
          <Route path="/sites" element={<SitesPage />} />
          <Route path="/enrollments" element={<EnrollmentsPage />} />
          <Route path="/retention-risk" element={<RetentionRiskPage />} />
          <Route path="/adverse-events" element={<AdverseEventsPage />} />
          <Route path="/protocols" element={<ProtocolsPage />} />
          <Route path="/biomarkers" element={<BiomarkersPage />} />
          <Route path="/drug-interactions" element={<DrugInteractionsPage />} />
          <Route path="/outcomes" element={<OutcomesPage />} />
          <Route path="/regulatory" element={<RegulatoryPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/webhooks" element={<WebhooksPage />} />
          <Route path="/custom-views" element={<CustomViewsPage />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </ProtectedLayout>
    </Router>
  );
}

export default App;
