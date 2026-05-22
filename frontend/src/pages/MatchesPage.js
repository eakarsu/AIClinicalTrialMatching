import React, { useState, useEffect } from 'react';
import api from '../services/api';
import ReactMarkdown from 'react-markdown';
import AIResultDisplay from '../components/AIResultDisplay';

export default function MatchesPage() {
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [aiResult, setAiResult] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [patients, setPatients] = useState([]);
  const [trials, setTrials] = useState([]);
  const emptyForm = { patientId: '', trialId: '', matchScore: '', matchReason: '', status: 'pending', aiAnalysis: '' };
  const [form, setForm] = useState(emptyForm);

  useEffect(() => { loadData(); }, []);
  const loadData = async () => {
    try {
      const [m, p, t] = await Promise.all([api.get('/matches'), api.get('/patients'), api.get('/trials')]);
      setItems(Array.isArray(m.data) ? m.data : (m.data?.items || m.data?.data || m.data?.rows || [])); setPatients(Array.isArray(p.data) ? p.data : (p.data?.items || p.data?.data || p.data?.rows || [])); setTrials(Array.isArray(t.data) ? t.data : (t.data?.items || t.data?.data || t.data?.rows || []));
    } catch(e) {} setLoading(false);
  };

  const handleSave = async () => {
    try {
      if (editing) await api.put(`/matches/${editing.id}`, form);
      else await api.post('/matches', form);
      setShowForm(false); setEditing(null); setForm(emptyForm); loadData();
    } catch(e) { alert(e.response?.data?.error || 'Error'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this match?')) return;
    try { await api.delete(`/matches/${id}`); setSelected(null); loadData(); } catch(e) { alert('Error'); }
  };

  const handleEdit = (item) => { setEditing(item); setForm({...item}); setShowForm(true); };

  const handleAIScreen = async () => {
    if (!selected) return;
    setAiLoading(true); setAiResult(null);
    try {
      const res = await api.post('/ai/screen-patient', { patientId: selected.patientId, trialId: selected.trialId });
      setAiResult(res.data);
    } catch(e) { setAiResult({ screening: 'Error: ' + (e.response?.data?.error || e.message) }); }
    setAiLoading(false);
  };

  const getScoreColor = (score) => score >= 85 ? '#00b894' : score >= 70 ? '#f39c12' : '#e74c3c';
  const filtered = items.filter(m => {
    const pName = m.Patient ? `${m.Patient.firstName} ${m.Patient.lastName}` : '';
    const tName = m.Trial ? m.Trial.title : '';
    return `${pName} ${tName} ${m.matchReason}`.toLowerCase().includes(search.toLowerCase());
  });

  if (loading) return <div className="loading"><div className="loading-spinner"></div>Loading matches...</div>;

  if (selected) {
    return (
      <div>
        <button className="back-btn" onClick={() => { setSelected(null); setAiResult(null); }}>&larr; Back to Matches</button>
        <div className="detail-panel">
          <h2>{'\u{1F3AF}'} Match Details</h2>
          <div className="detail-grid">
            <div className="detail-field"><label>Patient</label><div className="value">{selected.Patient ? `${selected.Patient.firstName} ${selected.Patient.lastName}` : `ID: ${selected.patientId}`}</div></div>
            <div className="detail-field"><label>Trial</label><div className="value">{selected.Trial ? selected.Trial.title : `ID: ${selected.trialId}`}</div></div>
            <div className="detail-field"><label>Match Score</label><div className="value" style={{fontSize: 24, fontWeight: 700, color: getScoreColor(selected.matchScore)}}>{selected.matchScore}%</div></div>
            <div className="detail-field"><label>Status</label><div className="value"><span className={`badge ${selected.status === 'approved' ? 'badge-success' : selected.status === 'review' ? 'badge-warning' : 'badge-info'}`}>{selected.status}</span></div></div>
          </div>
          <div className="detail-field" style={{marginTop: 16}}><label>Match Reason</label><div className="value">{selected.matchReason}</div></div>
          <div className="detail-field" style={{marginTop: 16}}><label>AI Analysis</label><div className="value">{selected.aiAnalysis}</div></div>
          <div className="detail-actions">
            <button className="btn btn-primary" onClick={handleAIScreen}>AI Eligibility Screening</button>
            <button className="btn btn-warning" onClick={() => handleEdit(selected)}>Edit</button>
            <button className="btn btn-danger" onClick={() => handleDelete(selected.id)}>Delete</button>
          </div>
        </div>
        {aiLoading && <div className="ai-loading"><div className="pulse"></div><p>AI is screening patient eligibility...</p></div>}
        {aiResult && (
          <AIResultDisplay result={aiResult} loading={false} error={null} />
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="page-header"><h1>AI Trial Matching</h1><div className="header-actions"><button className="btn btn-primary" onClick={() => { setEditing(null); setForm(emptyForm); setShowForm(true); }}>+ New Match</button></div></div>
      <div className="search-bar"><input placeholder="Search matches..." value={search} onChange={e => setSearch(e.target.value)} /></div>
      <div className="data-table-container">
        <table className="data-table">
          <thead><tr><th>Patient</th><th>Trial</th><th>Score</th><th>Reason</th><th>Status</th></tr></thead>
          <tbody>
            {filtered.map(m => (
              <tr key={m.id} onClick={() => setSelected(m)}>
                <td><strong>{m.Patient ? `${m.Patient.firstName} ${m.Patient.lastName}` : m.patientId}</strong></td>
                <td style={{maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>{m.Trial ? m.Trial.title : m.trialId}</td>
                <td><div className="score-bar"><div className="score-bar-fill" style={{width: `${m.matchScore}%`, background: getScoreColor(m.matchScore)}}></div></div>{m.matchScore}%</td>
                <td style={{maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>{m.matchReason}</td>
                <td><span className={`badge ${m.status === 'approved' ? 'badge-success' : m.status === 'review' ? 'badge-warning' : 'badge-info'}`}>{m.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{editing ? 'Edit Match' : 'New Match'}</h2>
            <div className="form-grid">
              <div className="form-group"><label>Patient</label><select value={form.patientId} onChange={e => setForm({...form, patientId: e.target.value})}><option value="">Select Patient</option>{patients.map(p => <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>)}</select></div>
              <div className="form-group"><label>Trial</label><select value={form.trialId} onChange={e => setForm({...form, trialId: e.target.value})}><option value="">Select Trial</option>{trials.map(t => <option key={t.id} value={t.id}>{t.trialId} - {t.title}</option>)}</select></div>
              <div className="form-group"><label>Match Score</label><input type="number" min="0" max="100" value={form.matchScore} onChange={e => setForm({...form, matchScore: e.target.value})} /></div>
              <div className="form-group"><label>Status</label><select value={form.status} onChange={e => setForm({...form, status: e.target.value})}><option value="pending">Pending</option><option value="approved">Approved</option><option value="review">Review</option><option value="rejected">Rejected</option></select></div>
              <div className="form-group full-width"><label>Match Reason</label><textarea value={form.matchReason} onChange={e => setForm({...form, matchReason: e.target.value})} /></div>
              <div className="form-group full-width"><label>AI Analysis</label><textarea value={form.aiAnalysis} onChange={e => setForm({...form, aiAnalysis: e.target.value})} /></div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave}>{editing ? 'Update' : 'Create'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
