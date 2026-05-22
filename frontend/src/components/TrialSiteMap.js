// VIZ: Trial Site Map — fetches /api/custom-views/trial-site-map and renders
// a synthesized geo bubble plot inside an SVG (no external deps).
import React, { useEffect, useState } from 'react';
import api from '../services/api';

const C = { bg: '#0f172a', panel: '#111827', text: '#e5e7eb', sub: '#9ca3af', border: '#1f2937', good: '#10b981', warn: '#f59e0b', bad: '#ef4444' };

function dotColor(status) {
  if (status === 'red') return C.bad;
  if (status === 'amber') return C.warn;
  return C.good;
}

export default function TrialSiteMap() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    let alive = true;
    api.get('/custom-views/trial-site-map')
      .then((r) => { if (alive) setData(r.data); })
      .catch((e) => { if (alive) setErr(e?.response?.data?.error || e.message); })
      .finally(() => { if (alive) setBusy(false); });
    return () => { alive = false; };
  }, []);

  if (busy) return <div style={{ color: C.sub, padding: 16 }}>Loading trial site map…</div>;
  if (err) return <div style={{ color: C.bad, padding: 16 }}>Error: {err}</div>;
  if (!data) return null;

  const { summary, points } = data;
  const { bbox } = summary;
  const W = 720, H = 360;
  const xScale = (lng) => ((lng - bbox.minLng) / (bbox.maxLng - bbox.minLng)) * W;
  const yScale = (lat) => H - ((lat - bbox.minLat) / (bbox.maxLat - bbox.minLat)) * H;

  return (
    <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 16, color: C.text }}>
      <h3 style={{ marginTop: 0 }}>Trial Site Map</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 12, fontSize: 12 }}>
        <div style={{ background: '#0b1220', padding: 8, borderRadius: 6 }}>
          <div style={{ color: C.sub }}>Total Sites</div>
          <div style={{ fontSize: 20 }}>{summary.totalSites}</div>
        </div>
        <div style={{ background: '#0b1220', padding: 8, borderRadius: 6 }}>
          <div style={{ color: C.sub }}>Enrolled</div>
          <div style={{ fontSize: 20 }}>{summary.totalEnrolled}</div>
        </div>
        <div style={{ background: '#0b1220', padding: 8, borderRadius: 6 }}>
          <div style={{ color: C.sub }}>Avg Util %</div>
          <div style={{ fontSize: 20 }}>{summary.avgUtilization}</div>
        </div>
        <div style={{ background: '#0b1220', padding: 8, borderRadius: 6 }}>
          <div style={{ color: C.sub }}>At Capacity</div>
          <div style={{ fontSize: 20, color: C.bad }}>{summary.atCapacity}</div>
        </div>
        <div style={{ background: '#0b1220', padding: 8, borderRadius: 6 }}>
          <div style={{ color: C.sub }}>Active Trials</div>
          <div style={{ fontSize: 20 }}>{summary.activeTrials}</div>
        </div>
      </div>

      <svg width={W} height={H} style={{ background: '#020617', borderRadius: 6, display: 'block' }}>
        {/* grid */}
        {Array.from({ length: 6 }).map((_, i) => (
          <line key={`gv${i}`} x1={(W / 5) * i} y1={0} x2={(W / 5) * i} y2={H} stroke="#1e293b" />
        ))}
        {Array.from({ length: 6 }).map((_, i) => (
          <line key={`gh${i}`} x1={0} y1={(H / 5) * i} x2={W} y2={(H / 5) * i} stroke="#1e293b" />
        ))}
        {points.map((p) => {
          const r = 6 + Math.round((p.utilization / 100) * 14);
          return (
            <g key={p.id}>
              <circle cx={xScale(p.lng)} cy={yScale(p.lat)} r={r} fill={dotColor(p.status)} opacity={0.55} stroke={dotColor(p.status)} />
              <text x={xScale(p.lng) + r + 4} y={yScale(p.lat) + 4} fill={C.text} fontSize={10}>{p.name} ({p.utilization}%)</text>
            </g>
          );
        })}
      </svg>

      <div style={{ marginTop: 14, display: 'flex', gap: 16, fontSize: 12, color: C.sub }}>
        <span><span style={{ display: 'inline-block', width: 10, height: 10, background: C.good, borderRadius: '50%', marginRight: 4 }} />Good (&lt;70%)</span>
        <span><span style={{ display: 'inline-block', width: 10, height: 10, background: C.warn, borderRadius: '50%', marginRight: 4 }} />Amber (70-89%)</span>
        <span><span style={{ display: 'inline-block', width: 10, height: 10, background: C.bad, borderRadius: '50%', marginRight: 4 }} />Red (≥90%)</span>
      </div>
    </div>
  );
}
