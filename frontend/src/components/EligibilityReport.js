// NON-VIZ: Patient Eligibility PDF Report — fetches /api/custom-views/eligibility-report
// Renders printable per-patient assessment table + downloadable .txt (PDF-ready).
import React, { useEffect, useState } from 'react';
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

export default function EligibilityReport() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(true);
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    let alive = true;
    api.get('/custom-views/eligibility-report')
      .then((r) => { if (alive) setData(r.data); })
      .catch((e) => { if (alive) setErr(e?.response?.data?.error || e.message); })
      .finally(() => { if (alive) setBusy(false); });
    return () => { alive = false; };
  }, []);

  if (busy) return <div style={{ color: C.sub, padding: 16 }}>Loading eligibility reports…</div>;
  if (err) return <div style={{ color: C.bad, padding: 16 }}>Error: {err}</div>;
  if (!data) return null;

  const { reports, totals, count } = data;
  const allText = reports.map((r) => r.printableText).join('\n\n========================================\n\n');

  return (
    <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 16, color: C.text }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <h3 style={{ margin: 0 }}>Patient Eligibility PDF Report</h3>
        <button
          onClick={() => downloadText(`eligibility_report_${Date.now()}.txt`, allText)}
          style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: 4, cursor: 'pointer' }}
        >
          Download All (.txt)
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 14, fontSize: 12 }}>
        <div style={{ background: '#0b1220', padding: 8, borderRadius: 6 }}>
          <div style={{ color: C.sub }}>Reports</div>
          <div style={{ fontSize: 20 }}>{count}</div>
        </div>
        <div style={{ background: '#0b1220', padding: 8, borderRadius: 6 }}>
          <div style={{ color: C.sub }}>Patients</div>
          <div style={{ fontSize: 20 }}>{totals.patients}</div>
        </div>
        <div style={{ background: '#0b1220', padding: 8, borderRadius: 6 }}>
          <div style={{ color: C.sub }}>Trials</div>
          <div style={{ fontSize: 20 }}>{totals.trials}</div>
        </div>
        <div style={{ background: '#0b1220', padding: 8, borderRadius: 6 }}>
          <div style={{ color: C.sub }}>Matches</div>
          <div style={{ fontSize: 20 }}>{totals.matches}</div>
        </div>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: '#1f2937', color: C.sub, textAlign: 'left' }}>
            <th style={{ padding: 8 }}>Patient</th>
            <th style={{ padding: 8 }}>Age/Sex</th>
            <th style={{ padding: 8 }}>Diagnosis</th>
            <th style={{ padding: 8 }}>Stage</th>
            <th style={{ padding: 8 }}>Top Match</th>
            <th style={{ padding: 8 }}>Status</th>
            <th style={{ padding: 8 }}>Score</th>
            <th style={{ padding: 8 }}></th>
          </tr>
        </thead>
        <tbody>
          {reports.map((r) => (
            <React.Fragment key={r.patientId}>
              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                <td style={{ padding: 8 }}>{r.patientName}</td>
                <td style={{ padding: 8, color: C.sub }}>{r.ageYears}/{r.gender}</td>
                <td style={{ padding: 8 }}>{r.diagnosis}</td>
                <td style={{ padding: 8, color: C.sub }}>{r.stage}</td>
                <td style={{ padding: 8 }}>{r.topMatch?.title || '—'}</td>
                <td style={{ padding: 8, color: r.topMatch?.eligibility === 'ELIGIBLE' ? C.good : C.bad }}>{r.topMatch?.eligibility || '—'}</td>
                <td style={{ padding: 8 }}>{r.topMatch?.matchScore ?? '—'}</td>
                <td style={{ padding: 8, textAlign: 'right' }}>
                  <button
                    onClick={() => setOpenId(openId === r.patientId ? null : r.patientId)}
                    style={{ background: '#374151', color: C.text, border: 'none', padding: '4px 8px', borderRadius: 4, cursor: 'pointer', marginRight: 4 }}
                  >
                    {openId === r.patientId ? 'Hide' : 'View'}
                  </button>
                  <button
                    onClick={() => downloadText(`eligibility_${r.patientId}.txt`, r.printableText)}
                    style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: 4, cursor: 'pointer' }}
                  >
                    PDF
                  </button>
                </td>
              </tr>
              {openId === r.patientId && (
                <tr>
                  <td colSpan={8} style={{ background: '#020617', padding: 12 }}>
                    <pre style={{ margin: 0, color: C.text, fontSize: 12, whiteSpace: 'pre-wrap' }}>{r.printableText}</pre>
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
