import React, { useEffect, useState } from 'react';

export default function RetentionRiskPage() {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch('/api/retention-risk', {
      headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
    })
      .then((res) => res.json())
      .then(setData)
      .catch(() => setData({ error: 'Unable to load retention risk.' }));
  }, []);

  if (!data) return <div className="page">Loading...</div>;

  return (
    <div className="page">
      <h1>Retention Risk</h1>
      <p>Participant retention triage based on missed visits, travel burden, and coordinator outreach needs.</p>
      <div className="stats-grid">
        <div className="stat-card"><strong>{data.summary?.highRiskParticipants}</strong><span>High Risk</span></div>
        <div className="stat-card"><strong>{data.summary?.missedVisitRisk}</strong><span>Missed Visit Risk</span></div>
        <div className="stat-card"><strong>{data.summary?.travelBurdenCases}</strong><span>Travel Burden</span></div>
        <div className="stat-card"><strong>{data.summary?.outreachPriority}</strong><span>Priority</span></div>
      </div>
      <div className="card">
        {data.participants?.map((p) => (
          <div key={p.id} className="list-row">
            <strong>{p.id}</strong><span>{p.trial}</span><span>{p.risk}</span><span>{p.driver}</span>
          </div>
        ))}
      </div>
      <div className="card"><h2>Interventions</h2><ul>{data.interventions?.map((i) => <li key={i}>{i}</li>)}</ul></div>
    </div>
  );
}
