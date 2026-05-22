// VIZ — Enrollment Funnel
// Fetches /api/custom-views/enrollment-funnel and renders:
//   • Overall funnel SVG (Screened → Eligible → Consented → Enrolled)
//   • Per-trial conversion bars
import React, { useEffect, useState } from 'react';
import api from '../services/api';

const C = {
  bg: '#0f172a',
  panel: '#111827',
  text: '#e5e7eb',
  sub: '#9ca3af',
  border: '#1f2937',
  stages: ['#60a5fa', '#22d3ee', '#34d399', '#fbbf24'],
  good: '#10b981',
  bad: '#fb7185',
};

export default function EnrollmentFunnel() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    let alive = true;
    api
      .get('/custom-views/enrollment-funnel')
      .then((r) => alive && setData(r.data))
      .catch((e) => alive && setErr(e?.response?.data?.error || e.message))
      .finally(() => alive && setBusy(false));
    return () => {
      alive = false;
    };
  }, []);

  if (busy) return <div style={{ color: C.sub, padding: 16 }}>Loading enrollment funnel…</div>;
  if (err) return <div style={{ color: '#ef4444', padding: 16 }}>Error: {err}</div>;
  if (!data) return null;

  const { overall, funnels, stages, totals, overallConversionPct } = data;
  const W = 720;
  const H = 240;
  const maxTotal = Math.max(...overall.map((s) => s.total), 1);

  return (
    <div
      data-testid="enrollment-funnel"
      style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 16, color: C.text }}
    >
      <h3 style={{ marginTop: 0 }}>Enrollment Funnel</h3>
      <div style={{ color: C.sub, fontSize: 12, marginBottom: 10 }}>
        Screened → Eligible → Consented → Enrolled, across all trials. Overall conversion:{' '}
        <span style={{ color: C.good, fontWeight: 600 }}>{overallConversionPct}%</span>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 8,
          marginBottom: 12,
          fontSize: 12,
        }}
      >
        {[
          ['Trials', totals.trials],
          ['Patients', totals.patients],
          ['Enrollments', totals.enrollments],
          ['Matches', totals.matches],
        ].map(([k, v]) => (
          <div key={k} style={{ background: '#0b1220', padding: 8, borderRadius: 6 }}>
            <div style={{ color: C.sub }}>{k}</div>
            <div style={{ fontSize: 20 }}>{v}</div>
          </div>
        ))}
      </div>

      <div style={{ background: '#020617', borderRadius: 6, padding: 12 }}>
        <div style={{ color: C.sub, fontSize: 12, marginBottom: 8 }}>Overall funnel</div>
        <svg width={W} height={H} style={{ display: 'block' }}>
          {overall.map((s, i) => {
            const w = (s.total / maxTotal) * (W - 80);
            const y = i * (H / overall.length) + 4;
            const h = H / overall.length - 8;
            const x = (W - w) / 2;
            return (
              <g key={s.label}>
                <rect x={x} y={y} width={w} height={h} fill={C.stages[i]} opacity={0.88} rx={3} />
                <text
                  x={W / 2}
                  y={y + h / 2 + 4}
                  fill="#0b1220"
                  fontSize={12}
                  textAnchor="middle"
                  fontWeight={700}
                >
                  {s.label}: {s.total}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <h4 style={{ marginTop: 18, marginBottom: 8 }}>Per-Trial Conversion</h4>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {funnels.map((f) => (
          <div
            key={f.trialId}
            style={{ background: '#0b1220', borderRadius: 6, padding: 10, border: `1px solid ${C.border}` }}
          >
            <div style={{ fontSize: 13, marginBottom: 6 }}>
              <span style={{ color: C.text }}>{f.title}</span>
              <span style={{ color: C.sub, marginLeft: 6 }}>[Phase {f.phase}, {f.therapeuticArea}]</span>
              <span style={{ float: 'right', color: C.good }}>{f.conversionPct}%</span>
            </div>
            {f.stages.map((s, i) => (
              <div key={s.label} style={{ display: 'flex', alignItems: 'center', marginBottom: 3 }}>
                <div style={{ width: 110, fontSize: 11, color: C.sub }}>{s.label}</div>
                <div style={{ flex: 1, background: '#1f2937', height: 14, borderRadius: 3, overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${(s.count / Math.max(f.stages[0].count, 1)) * 100}%`,
                      background: C.stages[i],
                    }}
                  />
                </div>
                <div style={{ width: 60, textAlign: 'right', fontSize: 11, color: C.text }}>{s.count}</div>
                <div
                  style={{
                    width: 50,
                    textAlign: 'right',
                    fontSize: 11,
                    color: i === 0 ? C.sub : C.bad,
                  }}
                >
                  {i === 0 ? '—' : `-${s.dropoffPct}%`}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      <div style={{ marginTop: 14, display: 'flex', gap: 12, fontSize: 11, color: C.sub, flexWrap: 'wrap' }}>
        {stages.map((s, i) => (
          <span key={s}>
            <span
              style={{
                display: 'inline-block',
                width: 10,
                height: 10,
                background: C.stages[i],
                borderRadius: 2,
                marginRight: 4,
              }}
            />
            {s}
          </span>
        ))}
      </div>
    </div>
  );
}
