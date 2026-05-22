// NON-VIZ: Consent Form Generator — POSTs /api/custom-views/consent-form
// Returns plain-language ICF with section blocks + download.
import React, { useState } from 'react';
import api from '../services/api';

const C = { panel: '#111827', text: '#e5e7eb', sub: '#9ca3af', border: '#1f2937', good: '#10b981', bad: '#ef4444' };

function downloadText(filename, text) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function ConsentFormGenerator() {
  const [patientId, setPatientId] = useState('');
  const [trialId, setTrialId] = useState('');
  const [readingLevel, setReadingLevel] = useState('grade-8');
  const [language, setLanguage] = useState('en');
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const run = async () => {
    setBusy(true); setErr(''); setData(null);
    try {
      const r = await api.post('/custom-views/consent-form', {
        patientId: patientId ? Number(patientId) : null,
        trialId: trialId ? Number(trialId) : null,
        readingLevel,
        language,
      });
      setData(r.data);
    } catch (e) {
      setErr(e?.response?.data?.error || e.message || 'Failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 16, color: C.text }}>
      <h3 style={{ marginTop: 0 }}>Consent Form Generator</h3>
      <p style={{ color: C.sub, fontSize: 12, marginTop: 0 }}>
        Generates a plain-language Informed Consent Form (ICF) tailored to patient + trial. POSTs <code>/api/custom-views/consent-form</code>.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 12 }}>
        <div>
          <label style={{ fontSize: 12, color: C.sub }}>Patient ID</label>
          <input value={patientId} onChange={(e) => setPatientId(e.target.value)} placeholder="auto"
                 style={{ width: '100%', padding: 6, background: '#020617', border: `1px solid ${C.border}`, color: C.text, borderRadius: 4 }} />
        </div>
        <div>
          <label style={{ fontSize: 12, color: C.sub }}>Trial ID</label>
          <input value={trialId} onChange={(e) => setTrialId(e.target.value)} placeholder="auto"
                 style={{ width: '100%', padding: 6, background: '#020617', border: `1px solid ${C.border}`, color: C.text, borderRadius: 4 }} />
        </div>
        <div>
          <label style={{ fontSize: 12, color: C.sub }}>Reading Level</label>
          <select value={readingLevel} onChange={(e) => setReadingLevel(e.target.value)}
                  style={{ width: '100%', padding: 6, background: '#020617', border: `1px solid ${C.border}`, color: C.text, borderRadius: 4 }}>
            <option value="grade-6">Grade 6</option>
            <option value="grade-8">Grade 8</option>
            <option value="grade-10">Grade 10</option>
          </select>
        </div>
        <div>
          <label style={{ fontSize: 12, color: C.sub }}>Language</label>
          <select value={language} onChange={(e) => setLanguage(e.target.value)}
                  style={{ width: '100%', padding: 6, background: '#020617', border: `1px solid ${C.border}`, color: C.text, borderRadius: 4 }}>
            <option value="en">English</option>
            <option value="es">Spanish</option>
            <option value="zh">Mandarin</option>
          </select>
        </div>
      </div>

      <button
        onClick={run}
        disabled={busy}
        style={{ background: busy ? '#374151' : '#10b981', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 4, cursor: busy ? 'wait' : 'pointer' }}
      >
        {busy ? 'Generating…' : 'Generate Consent Form'}
      </button>

      {err && <div style={{ color: C.bad, marginTop: 12 }}>{err}</div>}

      {data && (
        <div style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ fontSize: 13 }}>
              <span style={{ color: C.sub }}>Trial:</span> {data.trial.title} [Phase {data.trial.phase}]
              <span style={{ color: C.sub, marginLeft: 12 }}>Patient:</span> {data.patient.name}
            </div>
            <button
              onClick={() => downloadText(`consent_p${data.patient.id}_t${data.trial.id}.txt`, data.printableText)}
              style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: 4, cursor: 'pointer' }}
            >
              Download (.txt)
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12, fontSize: 12 }}>
            <div style={{ background: '#0b1220', padding: 8, borderRadius: 6 }}>
              <div style={{ color: C.sub }}>Reading Score</div>
              <div style={{ fontSize: 18 }}>{data.readability.fleschKincaid}</div>
            </div>
            <div style={{ background: '#0b1220', padding: 8, borderRadius: 6 }}>
              <div style={{ color: C.sub }}>Words</div>
              <div style={{ fontSize: 18 }}>{data.readability.wordCount}</div>
            </div>
            <div style={{ background: '#0b1220', padding: 8, borderRadius: 6 }}>
              <div style={{ color: C.sub }}>Sections</div>
              <div style={{ fontSize: 18 }}>{data.readability.sectionCount}</div>
            </div>
          </div>

          {data.sections.map((s) => (
            <div key={s.id} style={{ background: '#0b1220', borderLeft: `3px solid #10b981`, padding: 10, marginBottom: 8, borderRadius: 4 }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>{s.heading}</div>
              <div style={{ fontSize: 13, color: C.text }}>{s.text}</div>
            </div>
          ))}

          <div style={{ marginTop: 12 }}>
            <div style={{ color: C.sub, fontSize: 12, marginBottom: 4 }}>Pre-signature checklist</div>
            {data.checklist.map((c) => (
              <div key={c.id} style={{ fontSize: 12 }}>
                <span style={{ color: c.done ? C.good : C.bad, marginRight: 6 }}>{c.done ? '[X]' : '[ ]'}</span>
                {c.label}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
