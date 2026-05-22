// NON-VIZ — Patient Match Summary PDF
// Fetches /api/custom-views/patient-match-pdf and renders a printable report
// per patient with a "Print / Save as PDF" action.
import React, { useEffect, useState } from 'react';
import api from '../services/api';

const C = {
  panel: '#111827',
  text: '#e5e7eb',
  sub: '#9ca3af',
  border: '#1f2937',
  accent: '#10b981',
};

export default function PatientMatchPDF() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(true);
  const [selectedIdx, setSelectedIdx] = useState(0);

  const load = (patientId) => {
    setBusy(true);
    setErr('');
    const q = patientId ? `?patientId=${patientId}` : '';
    api
      .get(`/custom-views/patient-match-pdf${q}`)
      .then((r) => {
        setData(r.data);
        setSelectedIdx(0);
      })
      .catch((e) => setErr(e?.response?.data?.error || e.message))
      .finally(() => setBusy(false));
  };

  useEffect(() => {
    load();
  }, []);

  const printReport = (text) => {
    const w = window.open('', '_blank', 'width=800,height=900');
    if (!w) return;
    w.document.write(
      `<html><head><title>Patient Match Summary PDF</title></head>` +
        `<body><pre style="font-family: ui-monospace, Menlo, monospace; font-size: 12px; padding: 16px;">${text
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')}</pre>` +
        `<script>window.print();</script></body></html>`
    );
    w.document.close();
  };

  if (busy) return <div style={{ color: C.sub, padding: 16 }}>Loading patient match PDF…</div>;
  if (err) return <div style={{ color: '#ef4444', padding: 16 }}>Error: {err}</div>;
  if (!data || !data.reports.length) return <div style={{ color: C.sub, padding: 16 }}>No patient reports available.</div>;

  const current = data.reports[selectedIdx];

  return (
    <div
      data-testid="patient-match-pdf"
      style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 16, color: C.text }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
        <h3 style={{ margin: 0 }}>Patient Match Summary PDF</h3>
        <div style={{ color: C.sub, fontSize: 12 }}>
          {data.count} report(s) • patients in DB: {data.totals.patients} • trials: {data.totals.trials}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 12 }}>
        <div
          style={{
            background: '#0b1220',
            border: `1px solid ${C.border}`,
            borderRadius: 6,
            padding: 8,
            maxHeight: 520,
            overflowY: 'auto',
          }}
        >
          <div style={{ color: C.sub, fontSize: 11, padding: '4px 8px' }}>Patients</div>
          {data.reports.map((r, i) => (
            <button
              key={r.patientId}
              data-testid={`patient-row-${r.patientId}`}
              onClick={() => setSelectedIdx(i)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                background: i === selectedIdx ? '#1f2937' : 'transparent',
                color: C.text,
                border: 'none',
                padding: '8px 10px',
                cursor: 'pointer',
                borderRadius: 4,
                fontSize: 12,
              }}
            >
              <div style={{ fontWeight: 600 }}>{r.patientName}</div>
              <div style={{ color: C.sub, fontSize: 11 }}>
                {r.diagnosis || '—'} · {r.ageYears}y · {r.gender || '—'}
              </div>
              {r.topMatch && (
                <div style={{ color: C.accent, fontSize: 11 }}>
                  Top: T{r.topMatch.trialId} ({r.topMatch.matchScore}/100)
                </div>
              )}
            </button>
          ))}
        </div>

        <div style={{ background: '#0b1220', border: `1px solid ${C.border}`, borderRadius: 6, padding: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{current.patientName}</div>
              <div style={{ color: C.sub, fontSize: 12 }}>
                {current.diagnosis || '—'} • Stage {current.stage || '—'} • Page count: {current.pageCount}
              </div>
            </div>
            <button
              data-testid="print-pdf-btn"
              onClick={() => printReport(current.printableText)}
              style={{
                background: C.accent,
                color: '#0b1220',
                border: 'none',
                padding: '8px 14px',
                borderRadius: 4,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Print / Save as PDF
            </button>
          </div>

          <pre
            data-testid="pdf-preview"
            style={{
              background: '#020617',
              color: C.text,
              padding: 12,
              borderRadius: 4,
              maxHeight: 420,
              overflow: 'auto',
              fontSize: 11,
              lineHeight: 1.45,
              whiteSpace: 'pre-wrap',
              margin: 0,
              fontFamily: 'ui-monospace, Menlo, monospace',
            }}
          >
            {current.printableText}
          </pre>
        </div>
      </div>
    </div>
  );
}
