// CustomViewsPage — Trial Views
// Composes the 4 custom views (2 VIZ + 2 NON-VIZ) for clinical trial patient matching.
import React, { useState } from 'react';
import EnrollmentFunnel from '../components/EnrollmentFunnel';
import CriteriaHeatmap from '../components/CriteriaHeatmap';
import PatientMatchPDF from '../components/PatientMatchPDF';
import EligibilityCriteriaEditor from '../components/EligibilityCriteriaEditor';

const TABS = [
  { id: 'funnel', label: 'Enrollment Funnel (VIZ)' },
  { id: 'heatmap', label: 'Criteria Heatmap (VIZ)' },
  { id: 'pdf', label: 'Patient Match PDF' },
  { id: 'criteria', label: 'Eligibility Criteria Editor' },
];

export default function CustomViewsPage() {
  const [tab, setTab] = useState('funnel');

  return (
    <div
      data-testid="custom-views-page"
      style={{ padding: 24, color: '#e5e7eb', minHeight: '100vh', background: '#0f172a' }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
        }}
      >
        <div>
          <h2 style={{ margin: 0 }}>Trial Views</h2>
          <p style={{ color: '#9ca3af', fontSize: 13, marginTop: 4 }}>
            Custom views for clinical trial patient matching — enrollment funnel, criteria heatmap, patient match PDF, eligibility criteria editor.
          </p>
        </div>
        <div style={{ color: '#9ca3af', fontSize: 12 }}>/api/custom-views — 4 endpoints</div>
      </div>

      <div
        style={{
          display: 'flex',
          gap: 4,
          marginBottom: 16,
          borderBottom: '1px solid #1f2937',
        }}
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            data-testid={`tab-${t.id}`}
            style={{
              background: tab === t.id ? '#1f2937' : 'transparent',
              color: tab === t.id ? '#fff' : '#9ca3af',
              border: 'none',
              borderBottom: tab === t.id ? '2px solid #10b981' : '2px solid transparent',
              padding: '10px 16px',
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div data-testid="custom-views-panel">
        {tab === 'funnel' && <EnrollmentFunnel />}
        {tab === 'heatmap' && <CriteriaHeatmap />}
        {tab === 'pdf' && <PatientMatchPDF />}
        {tab === 'criteria' && <EligibilityCriteriaEditor />}
      </div>
    </div>
  );
}
