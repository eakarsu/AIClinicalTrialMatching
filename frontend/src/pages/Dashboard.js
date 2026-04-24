import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [patients, trials, matches, sites, enrollments, events, protocols, biomarkers, interactions, regulatory, notifications, reports, eligibility, outcomes] = await Promise.all([
          api.get('/patients'), api.get('/trials'), api.get('/matches'), api.get('/sites'),
          api.get('/enrollments'), api.get('/adverse-events'), api.get('/protocols'),
          api.get('/biomarkers'), api.get('/drug-interactions'), api.get('/regulatory'),
          api.get('/notifications'), api.get('/reports'), api.get('/eligibility'), api.get('/outcomes'),
        ]);
        setStats({
          patients: patients.data.length, trials: trials.data.length, matches: matches.data.length,
          sites: sites.data.length, enrollments: enrollments.data.length, events: events.data.length,
          protocols: protocols.data.length, biomarkers: biomarkers.data.length,
          interactions: interactions.data.length, regulatory: regulatory.data.length,
          notifications: notifications.data.length, reports: reports.data.length,
          eligibility: eligibility.data.length, outcomes: outcomes.data.length,
        });
      } catch (err) { console.error(err); }
      setLoading(false);
    }
    load();
  }, []);

  const cards = [
    { key: 'patients', icon: '\u{1F9D1}\u200D\u2695\uFE0F', title: 'Patient Management', desc: 'Manage patient profiles, medical history, and biomarker data', path: '/patients', color: '#6c5ce7' },
    { key: 'trials', icon: '\u{1F9EA}', title: 'Clinical Trials', desc: 'Browse and manage active clinical trial database', path: '/trials', color: '#00b894' },
    { key: 'matches', icon: '\u{1F3AF}', title: 'AI Trial Matching', desc: 'AI-powered patient-trial matching with confidence scores', path: '/matches', color: '#e17055' },
    { key: 'eligibility', icon: '\u2705', title: 'Eligibility Criteria', desc: 'Define and manage inclusion/exclusion criteria', path: '/eligibility', color: '#00cec9' },
    { key: 'sites', icon: '\u{1F3E5}', title: 'Site Management', desc: 'Clinical trial sites, investigators, and capacity tracking', path: '/sites', color: '#fdcb6e' },
    { key: 'enrollments', icon: '\u{1F4CB}', title: 'Enrollment Tracking', desc: 'Track patient enrollment, screening, and consent', path: '/enrollments', color: '#0984e3' },
    { key: 'events', icon: '\u26A0\uFE0F', title: 'Adverse Events', desc: 'Monitor and report adverse events with severity tracking', path: '/adverse-events', color: '#d63031' },
    { key: 'protocols', icon: '\u{1F4D1}', title: 'Protocol Management', desc: 'Study protocols, amendments, and version control', path: '/protocols', color: '#a29bfe' },
    { key: 'biomarkers', icon: '\u{1F9EC}', title: 'Biomarker Analysis', desc: 'AI-powered biomarker analysis and significance assessment', path: '/biomarkers', color: '#55efc4' },
    { key: 'interactions', icon: '\u{1F48A}', title: 'Drug Interactions', desc: 'AI drug interaction checking and safety analysis', path: '/drug-interactions', color: '#fab1a0' },
    { key: 'outcomes', icon: '\u{1F4CA}', title: 'Outcome Predictions', desc: 'AI outcome prediction with confidence intervals', path: '/outcomes', color: '#74b9ff' },
    { key: 'regulatory', icon: '\u{1F4DC}', title: 'Regulatory Compliance', desc: 'Track regulatory documents, submissions, and approvals', path: '/regulatory', color: '#ffeaa7' },
    { key: 'notifications', icon: '\u{1F514}', title: 'Notifications', desc: 'Alerts, safety signals, and enrollment milestones', path: '/notifications', color: '#ff7675' },
    { key: 'reports', icon: '\u{1F4C4}', title: 'Report Generation', desc: 'AI-powered comprehensive reporting and analytics', path: '/reports', color: '#dfe6e9' },
  ];

  if (loading) return <div className="loading"><div className="loading-spinner"></div>Loading dashboard...</div>;

  return (
    <div>
      <div className="page-header">
        <h1>Dashboard</h1>
      </div>
      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-label">Active Patients</div>
          <div className="stat-value">{stats.patients || 0}</div>
          <div className="stat-change">Across all trials</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Active Trials</div>
          <div className="stat-value">{stats.trials || 0}</div>
          <div className="stat-change">Currently recruiting</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">AI Matches</div>
          <div className="stat-value">{stats.matches || 0}</div>
          <div className="stat-change">Patient-trial pairs</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Enrollments</div>
          <div className="stat-value">{stats.enrollments || 0}</div>
          <div className="stat-change">Total tracked</div>
        </div>
      </div>
      <div className="dashboard-grid">
        {cards.map(card => (
          <div key={card.key} className="dashboard-card" onClick={() => navigate(card.path)}>
            <div className="card-icon">{card.icon}</div>
            <span className="card-count">{stats[card.key] || 0}</span>
            <h3>{card.title}</h3>
            <p>{card.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
