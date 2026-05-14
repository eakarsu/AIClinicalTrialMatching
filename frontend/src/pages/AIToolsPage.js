import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import api from '../services/api';
import aiService from '../services/aiService';

const TOOLS = [
  {
    key: 'match-patient',
    icon: '\u{1F3AF}',
    name: 'Patient-Trial Matching',
    description: 'AI ranks every recruiting trial against a patient profile.',
    fields: [{ name: 'patientId', label: 'Patient', type: 'select-patient' }],
    run: (form) => aiService.matchPatient(form.patientId),
    resultKey: 'analysis',
  },
  {
    key: 'screen-patient',
    icon: '\u2705',
    name: 'Eligibility Screening',
    description: 'Inclusion / exclusion criteria assessment for one trial.',
    fields: [
      { name: 'patientId', label: 'Patient', type: 'select-patient' },
      { name: 'trialId', label: 'Trial', type: 'select-trial' },
    ],
    run: (form) => aiService.screenPatient(form.patientId, form.trialId),
    resultKey: 'screening',
  },
  {
    key: 'analyze-biomarkers',
    icon: '\u{1F9EC}',
    name: 'Biomarker Analysis',
    description: 'AI prognostic significance + treatment implications.',
    fields: [{ name: 'patientId', label: 'Patient', type: 'select-patient' }],
    run: (form) => aiService.analyzeBiomarkers(form.patientId),
    resultKey: 'analysis',
  },
  {
    key: 'check-interactions',
    icon: '\u{1F48A}',
    name: 'Drug Interaction Checker',
    description: 'Severity, contraindications, recommendations.',
    fields: [
      { name: 'medications', label: 'Medications (comma or newline separated)', type: 'textarea' },
    ],
    run: (form) => aiService.checkInteractions(form.medications),
    resultKey: 'analysis',
  },
  {
    key: 'predict-outcome',
    icon: '\u{1F4CA}',
    name: 'Outcome Prediction',
    description: 'Confidence intervals + historical outcome correlation.',
    fields: [
      { name: 'patientId', label: 'Patient', type: 'select-patient' },
      { name: 'trialId', label: 'Trial', type: 'select-trial' },
    ],
    run: (form) => aiService.predictOutcome(form.patientId, form.trialId),
    resultKey: 'prediction',
  },
  {
    key: 'analyze-protocol',
    icon: '\u{1F4D1}',
    name: 'Protocol Analysis',
    description: 'Design quality + regulatory compliance check.',
    fields: [{ name: 'protocolId', label: 'Protocol', type: 'select-protocol' }],
    run: (form) => aiService.analyzeProtocol(form.protocolId),
    resultKey: 'analysis',
  },
  {
    key: 'analyze-adverse-events',
    icon: '\u26A0\uFE0F',
    name: 'Adverse Event Analysis',
    description: 'Safety signals + pharmacovigilance assessment.',
    fields: [{ name: 'trialId', label: 'Trial', type: 'select-trial' }],
    run: (form) => aiService.analyzeAdverseEvents(form.trialId),
    resultKey: 'analysis',
  },
  {
    key: 'check-compliance',
    icon: '\u{1F4DC}',
    name: 'Regulatory Compliance Check',
    description: 'Document gap analysis + expiry tracking.',
    fields: [{ name: 'trialId', label: 'Trial', type: 'select-trial' }],
    run: (form) => aiService.checkCompliance(form.trialId),
    resultKey: 'analysis',
  },
  {
    key: 'generate-report',
    icon: '\u{1F4C4}',
    name: 'Report Generation',
    description: 'Dynamic enrollment / safety / efficacy reports.',
    fields: [
      {
        name: 'reportType',
        label: 'Report Type',
        type: 'select',
        options: ['enrollment', 'safety', 'efficacy', 'regulatory', 'executive_summary'],
      },
      { name: 'trialId', label: 'Trial (optional)', type: 'select-trial', optional: true },
    ],
    run: (form) => aiService.generateReport(form.reportType, form.trialId || null),
    resultKey: 'report',
  },
  {
    key: 'optimize-enrollment',
    icon: '\u{1F680}',
    name: 'Enrollment Optimization',
    description: 'Site performance + recruitment acceleration.',
    fields: [{ name: 'trialId', label: 'Trial', type: 'select-trial' }],
    run: (form) => aiService.optimizeEnrollment(form.trialId),
    resultKey: 'analysis',
  },
  {
    key: 'cohort-analysis',
    icon: '\u{1F4C8}',
    name: 'Cohort Analysis',
    description: 'Enrollment patterns, dropout risk, completion prediction.',
    fields: [{ name: 'trial_id', label: 'Trial', type: 'select-trial' }],
    run: (form) => aiService.cohortAnalysis(form.trial_id),
    resultKey: 'analysis',
  },
  {
    key: 'protocol-optimizer',
    icon: '\u{1F527}',
    name: 'Protocol Optimizer',
    description: 'Amendment suggestions for enrollment challenges.',
    fields: [
      { name: 'protocol_text', label: 'Protocol Summary', type: 'textarea' },
      { name: 'enrollment_challenges', label: 'Enrollment Challenges', type: 'textarea' },
    ],
    run: (form) => aiService.protocolOptimizer(form.protocol_text, form.enrollment_challenges),
    resultKey: 'analysis',
  },
  {
    key: 'consent-simplifier',
    icon: '\u{1F4D6}',
    name: 'Consent Simplifier',
    description: 'Plain-language summary + readability metrics + Q&A.',
    fields: [
      { name: 'informed_consent_text', label: 'Informed Consent Text', type: 'textarea' },
    ],
    run: (form) => aiService.consentSimplifier(form.informed_consent_text),
    resultKey: 'simplifiedConsent',
  },
  {
    key: 'pre-screen-batch',
    icon: '\u{1F50D}',
    name: 'Pre-Screening Batch',
    description: 'Bulk pre-screen active patients vs a trial.',
    fields: [
      { name: 'trial_id', label: 'Trial', type: 'select-trial' },
      { name: 'limit', label: 'Patient cap (default 25)', type: 'number', optional: true },
    ],
    run: (form) => aiService.preScreenBatch(form.trial_id, null, form.limit ? Number(form.limit) : null),
    resultKey: null,
  },
  {
    key: 'biomarker-trend',
    icon: '\u{1F4C9}',
    name: 'Biomarker Trend Predictor',
    description: 'Project future biomarker values + threshold alerts.',
    fields: [
      { name: 'patient_id', label: 'Patient', type: 'select-patient' },
      { name: 'biomarker_name', label: 'Biomarker name', type: 'text' },
      { name: 'threshold', label: 'Threshold (optional)', type: 'number', optional: true },
    ],
    run: (form) =>
      aiService.biomarkerTrend(
        form.patient_id,
        form.biomarker_name,
        form.threshold ? Number(form.threshold) : null
      ),
    resultKey: null,
  },
  {
    key: 'site-feasibility-rank',
    icon: '\u{1F3C6}',
    name: 'Site Feasibility Ranker',
    description: 'Rank investigator sites by capacity, history, fit.',
    fields: [
      { name: 'trial_id', label: 'Trial', type: 'select-trial' },
      { name: 'max_sites', label: 'Max sites (default 20)', type: 'number', optional: true },
    ],
    run: (form) =>
      aiService.siteFeasibilityRank(form.trial_id, form.max_sites ? Number(form.max_sites) : null),
    resultKey: null,
  },
  {
    key: 'protocol-version-diff',
    icon: '\u{1F501}',
    name: 'Protocol Version Diff',
    description: 'Diff two protocol versions; flag patient impact.',
    fields: [
      { name: 'protocol_a_id', label: 'Protocol A', type: 'select-protocol' },
      { name: 'protocol_b_id', label: 'Protocol B', type: 'select-protocol' },
    ],
    run: (form) => aiService.protocolVersionDiff(form.protocol_a_id, form.protocol_b_id),
    resultKey: null,
  },
  {
    key: 'multi-trial-cohort',
    icon: '\u{1F465}',
    name: 'Multi-Trial Cohort Builder',
    description: 'Patients eligible for many concurrent trials.',
    fields: [
      { name: 'min_concurrent', label: 'Min concurrent trials', type: 'number', optional: true },
      { name: 'limit', label: 'Patient cap', type: 'number', optional: true },
    ],
    run: (form) =>
      aiService.multiTrialCohort(
        form.min_concurrent ? Number(form.min_concurrent) : 3,
        form.limit ? Number(form.limit) : 25
      ),
    resultKey: null,
  },
  {
    key: 'outcome-ensemble',
    icon: '\u{1F3B2}',
    name: 'Outcome Ensemble',
    description: 'Run outcome prediction multiple times; flag variance.',
    fields: [
      { name: 'patient_id', label: 'Patient', type: 'select-patient' },
      { name: 'trial_id', label: 'Trial', type: 'select-trial' },
      { name: 'runs', label: 'Runs (2-5, default 3)', type: 'number', optional: true },
    ],
    run: (form) =>
      aiService.outcomeEnsemble(
        form.patient_id,
        form.trial_id,
        form.runs ? Number(form.runs) : 3
      ),
    resultKey: null,
  },
  {
    key: 'regulatory-readiness',
    icon: '\u{1F4DD}',
    name: 'Regulatory Readiness Dashboard',
    description: 'Per-trial doc gaps, expiry alerts, readiness score.',
    fields: [
      { name: 'trial_id', label: 'Trial (optional, all if blank)', type: 'select-trial', optional: true },
    ],
    run: (form) => aiService.regulatoryReadiness(form.trial_id ? { trial_id: form.trial_id } : {}),
    resultKey: null,
  },
  {
    key: 'predict-dropout',
    icon: '\u{1F6AA}',
    name: 'Dropout Risk Predictor',
    description: 'Predict early-dropout risk for one enrollment.',
    fields: [
      { name: 'enrollment_id', label: 'Enrollment ID', type: 'number' },
    ],
    run: (form) => aiService.predictDropout(form.enrollment_id),
    resultKey: null,
  },
  {
    key: 'site-optimizer',
    icon: '\u{1F5FA}️',
    name: 'Site Network Optimizer',
    description: 'Recommend an optimal site network for a protocol.',
    fields: [
      { name: 'trial_id', label: 'Trial', type: 'select-trial' },
      { name: 'target_sites', label: 'Target sites (default 5)', type: 'number', optional: true },
    ],
    run: (form) =>
      aiService.siteOptimizer(
        form.trial_id,
        form.target_sites ? Number(form.target_sites) : 5
      ),
    resultKey: null,
  },
];

export default function AIToolsPage() {
  const [active, setActive] = useState(TOOLS[0]);
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [refs, setRefs] = useState({ patients: [], trials: [], protocols: [] });

  useEffect(() => {
    const unwrap = (resp) => {
      const d = resp?.data;
      if (Array.isArray(d)) return d;
      if (d && Array.isArray(d.data)) return d.data;
      return [];
    };
    Promise.all([
      api.get('/patients?limit=100').catch(() => ({ data: [] })),
      api.get('/trials?limit=100').catch(() => ({ data: [] })),
      api.get('/protocols?limit=100').catch(() => ({ data: [] })),
    ]).then(([p, t, pr]) =>
      setRefs({ patients: unwrap(p), trials: unwrap(t), protocols: unwrap(pr) })
    );
  }, []);

  useEffect(() => {
    setForm({});
    setResult(null);
    setError(null);
  }, [active.key]);

  const run = async () => {
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const res = await active.run(form);
      setResult(res.data);
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    }
    setLoading(false);
  };

  const renderField = (f) => {
    const v = form[f.name] || '';
    const set = (val) => setForm({ ...form, [f.name]: val });
    if (f.type === 'select-patient') {
      return (
        <select value={v} onChange={(e) => set(e.target.value)}>
          <option value="">Select Patient</option>
          {refs.patients.map((p) => (
            <option key={p.id} value={p.id}>
              {p.firstName} {p.lastName} ({p.diagnosis})
            </option>
          ))}
        </select>
      );
    }
    if (f.type === 'select-trial') {
      return (
        <select value={v} onChange={(e) => set(e.target.value)}>
          <option value="">Select Trial</option>
          {refs.trials.map((t) => (
            <option key={t.id} value={t.id}>
              {t.trialId || t.id} - {t.title}
            </option>
          ))}
        </select>
      );
    }
    if (f.type === 'select-protocol') {
      return (
        <select value={v} onChange={(e) => set(e.target.value)}>
          <option value="">Select Protocol</option>
          {refs.protocols.map((p) => (
            <option key={p.id} value={p.id}>
              {p.protocolNumber} - {p.title}
            </option>
          ))}
        </select>
      );
    }
    if (f.type === 'select') {
      return (
        <select value={v} onChange={(e) => set(e.target.value)}>
          <option value="">Select...</option>
          {f.options.map((o) => (
            <option key={o} value={o}>
              {o.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
      );
    }
    if (f.type === 'textarea') {
      return <textarea value={v} onChange={(e) => set(e.target.value)} rows={5} />;
    }
    return <input value={v} onChange={(e) => set(e.target.value)} />;
  };

  const resultText =
    result && active.resultKey ? result[active.resultKey] : result ? JSON.stringify(result, null, 2) : '';

  return (
    <div>
      <div className="page-header">
        <h1>AI Tools</h1>
      </div>
      <p style={{ color: '#666', marginBottom: 16 }}>
        Run any of {TOOLS.length} AI workflows wired to the backend `/api/ai/*` endpoints.
      </p>

      <div className="dashboard-grid" style={{ marginBottom: 24 }}>
        {TOOLS.map((t) => (
          <div
            key={t.key}
            className="dashboard-card"
            onClick={() => setActive(t)}
            style={{
              border: active.key === t.key ? '2px solid #6c5ce7' : '1px solid #e0e0e0',
              cursor: 'pointer',
            }}
          >
            <div className="card-icon">{t.icon}</div>
            <h3 style={{ fontSize: 14 }}>{t.name}</h3>
            <p style={{ fontSize: 12 }}>{t.description}</p>
          </div>
        ))}
      </div>

      <div className="detail-panel">
        <h2>
          {active.icon} {active.name}
        </h2>
        <p style={{ color: '#666', marginBottom: 12 }}>{active.description}</p>
        <div className="form-grid">
          {active.fields.map((f) => (
            <div className="form-group full-width" key={f.name}>
              <label>{f.label}</label>
              {renderField(f)}
            </div>
          ))}
        </div>
        <div className="detail-actions" style={{ marginTop: 12 }}>
          <button className="btn btn-primary" onClick={run} disabled={loading}>
            {loading ? 'Running...' : 'Run AI Workflow'}
          </button>
        </div>
      </div>

      {loading && (
        <div className="ai-loading" style={{ marginTop: 16 }}>
          <div className="pulse"></div>
          <p>AI is analyzing...</p>
        </div>
      )}

      {error && (
        <div
          className="ai-output"
          style={{ marginTop: 16, borderLeft: '4px solid #e74c3c' }}
        >
          <strong>Error:</strong> {error}
        </div>
      )}

      {result && (
        <div className="ai-output" style={{ marginTop: 16 }}>
          <div className="ai-output-header">
            <span className="ai-badge">AI RESULT</span>
            <span className="model-info">Model: {result.model || 'OpenRouter'}</span>
          </div>
          <div className="ai-output-body">
            {resultText ? <ReactMarkdown>{String(resultText)}</ReactMarkdown> : <pre>{JSON.stringify(result, null, 2)}</pre>}
          </div>
          {result.usage && (
            <div className="ai-output-footer">
              <span>Tokens: {result.usage.total_tokens}</span>
            </div>
          )}
          {result.disclaimer && (
            <div className="ai-output-footer">
              <em>{result.disclaimer}</em>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
