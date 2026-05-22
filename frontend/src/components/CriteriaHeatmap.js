// VIZ — Trial Criteria Heatmap
// Fetches /api/custom-views/criteria-heatmap and renders a criterion × trial grid.
import React, { useEffect, useState } from 'react';
import api from '../services/api';

const C = {
  panel: '#111827',
  text: '#e5e7eb',
  sub: '#9ca3af',
  border: '#1f2937',
  low: '#1e3a8a',
  med: '#0ea5e9',
  high: '#10b981',
};

function colorFor(score) {
  if (score >= 75) return C.high;
  if (score >= 50) return C.med;
  return C.low;
}

export default function CriteriaHeatmap() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(true);
  const [hover, setHover] = useState(null);

  useEffect(() => {
    let alive = true;
    api
      .get('/custom-views/criteria-heatmap')
      .then((r) => alive && setData(r.data))
      .catch((e) => alive && setErr(e?.response?.data?.error || e.message))
      .finally(() => alive && setBusy(false));
    return () => {
      alive = false;
    };
  }, []);

  if (busy) return <div style={{ color: C.sub, padding: 16 }}>Loading criteria heatmap…</div>;
  if (err) return <div style={{ color: '#ef4444', padding: 16 }}>Error: {err}</div>;
  if (!data) return null;

  const { trials, criteria, matrix, summary } = data;
  const colW = 84;
  const rowH = 30;
  const labelW = 230;

  return (
    <div
      data-testid="criteria-heatmap"
      style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 16, color: C.text }}
    >
      <h3 style={{ marginTop: 0 }}>Trial Criteria Heatmap</h3>
      <div style={{ color: C.sub, fontSize: 12, marginBottom: 10 }}>
        Eligibility criterion (rows) × Trial (columns) — cell color = applicability score.
        {' '}
        <span style={{ color: C.text }}>
          {summary.criteriaCount} criteria × {summary.trialCount} trials
        </span>
        {' '}
        ({summary.eligibilityRowCount} backing eligibility rows in DB)
      </div>

      <div style={{ overflowX: 'auto', background: '#0b1220', borderRadius: 6, padding: 10 }}>
        {/* Header row */}
        <div style={{ display: 'flex' }}>
          <div style={{ width: labelW, color: C.sub, fontSize: 11, padding: '4px 6px' }}>Criterion ↓ / Trial →</div>
          {trials.map((t) => (
            <div
              key={t.id}
              title={`${t.title} • Phase ${t.phase} • ${t.therapeuticArea}`}
              style={{
                width: colW,
                textAlign: 'center',
                color: C.text,
                fontSize: 11,
                padding: '4px 2px',
                borderLeft: `1px solid ${C.border}`,
              }}
            >
              <div style={{ fontWeight: 600 }}>T{t.id}</div>
              <div style={{ color: C.sub, fontSize: 10 }}>Ph {t.phase}</div>
            </div>
          ))}
        </div>

        {/* Body rows */}
        {matrix.map((row) => (
          <div key={row.criterion} style={{ display: 'flex', borderTop: `1px solid ${C.border}` }}>
            <div
              style={{
                width: labelW,
                fontSize: 12,
                padding: '6px 6px',
                color: C.text,
                background: '#0f172a',
              }}
            >
              {row.criterion}
            </div>
            {row.cells.map((cell, i) => (
              <div
                key={i}
                onMouseEnter={() => setHover({ row: row.criterion, ...cell })}
                onMouseLeave={() => setHover(null)}
                title={`${row.criterion} × ${cell.trialTitle} — score ${cell.score} (${cell.bucket})${cell.backedByDB ? ' • DB' : ''}`}
                style={{
                  width: colW,
                  height: rowH,
                  background: colorFor(cell.score),
                  opacity: 0.35 + cell.score / 150,
                  borderLeft: `1px solid ${C.border}`,
                  color: '#0b1220',
                  fontWeight: 700,
                  fontSize: 11,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                {cell.score}
              </div>
            ))}
          </div>
        ))}
      </div>

      <div
        style={{
          marginTop: 12,
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          fontSize: 11,
          color: C.sub,
          flexWrap: 'wrap',
        }}
      >
        <span>Legend:</span>
        {summary.legend.map((l) => (
          <span key={l.bucket} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 12, height: 12, background: l.color, borderRadius: 2 }} />
            {l.bucket} ({l.range})
          </span>
        ))}
        {hover && (
          <span style={{ marginLeft: 'auto', color: C.text }}>
            Hover: <b>{hover.row}</b> × <b>{hover.trialTitle}</b> = {hover.score} ({hover.bucket})
          </span>
        )}
      </div>
    </div>
  );
}
