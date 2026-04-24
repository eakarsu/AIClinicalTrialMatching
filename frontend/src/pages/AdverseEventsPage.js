import React, { useState, useEffect } from 'react';
import api from '../services/api';
import ReactMarkdown from 'react-markdown';

export default function AdverseEventsPage() {
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [aiResult, setAiResult] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const emptyForm = { patientId: '', trialId: '', eventType: '', severity: '', description: '', onsetDate: '', resolutionDate: '', outcome: '', relatedness: '', actionTaken: '', status: 'open' };
  const [form, setForm] = useState(emptyForm);

  useEffect(() => { loadData(); }, []);
  const loadData = async () => { try { const res = await api.get('/adverse-events'); setItems(res.data); } catch(e){} setLoading(false); };

  const handleSave = async () => {
    try {
      if (editing) await api.put(`/adverse-events/${editing.id}`, form);
      else await api.post('/adverse-events', form);
      setShowForm(false); setEditing(null); setForm(emptyForm); loadData();
    } catch(e) { alert(e.response?.data?.error || 'Error'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this adverse event?')) return;
    try { await api.delete(`/adverse-events/${id}`); setSelected(null); loadData(); } catch(e) { alert('Error'); }
  };

  const handleEdit = (item) => { setEditing(item); setForm({...item}); setShowForm(true); };

  const handleAI = async (trialId) => {
    setAiLoading(true); setAiResult(null);
    try { const res = await api.post('/ai/analyze-adverse-events', { trialId }); setAiResult(res.data); }
    catch(e) { setAiResult({ analysis: 'Error: ' + (e.response?.data?.error || e.message) }); }
    setAiLoading(false);
  };

  const getSeverityClass = (s) => {
    if (!s) return '';
    if (s.includes('3') || s.includes('4')) return 'severity-high';
    if (s.includes('2')) return 'severity-moderate';
    return 'severity-low';
  };

  const filtered = items.filter(e => `${e.eventType} ${e.severity} ${e.description}`.toLowerCase().includes(search.toLowerCase()));

  if (loading) return <div className="loading"><div className="loading-spinner"></div>Loading...</div>;

  if (selected) {
    return (
      <div>
        <button className="back-btn" onClick={() => { setSelected(null); setAiResult(null); }}>&larr; Back</button>
        <div className="detail-panel">
          <h2>{'\u26A0\uFE0F'} Adverse Event Details</h2>
          <div className="detail-grid">
            <div className="detail-field"><label>Event Type</label><div className="value">{selected.eventType}</div></div>
            <div className="detail-field"><label>Severity</label><div className={`value ${getSeverityClass(selected.severity)}`} style={{fontWeight: 700}}>{selected.severity}</div></div>
            <div className="detail-field"><label>Patient ID</label><div className="value">{selected.patientId}</div></div>
            <div className="detail-field"><label>Trial ID</label><div className="value">{selected.trialId}</div></div>
            <div className="detail-field"><label>Onset Date</label><div className="value">{selected.onsetDate}</div></div>
            <div className="detail-field"><label>Resolution Date</label><div className="value">{selected.resolutionDate || 'Ongoing'}</div></div>
            <div className="detail-field"><label>Outcome</label><div className="value">{selected.outcome}</div></div>
            <div className="detail-field"><label>Relatedness</label><div className="value">{selected.relatedness}</div></div>
            <div className="detail-field"><label>Action Taken</label><div className="value">{selected.actionTaken}</div></div>
            <div className="detail-field"><label>Status</label><div className="value"><span className={`badge ${selected.status === 'closed' ? 'badge-success' : 'badge-danger'}`}>{selected.status}</span></div></div>
          </div>
          <div className="detail-field" style={{marginTop: 16}}><label>Description</label><div className="value">{selected.description}</div></div>
          <div className="detail-actions">
            <button className="btn btn-primary" onClick={() => handleAI(selected.trialId)}>AI Safety Analysis</button>
            <button className="btn btn-warning" onClick={() => handleEdit(selected)}>Edit</button>
            <button className="btn btn-danger" onClick={() => handleDelete(selected.id)}>Delete</button>
          </div>
        </div>
        {aiLoading && <div className="ai-loading"><div className="pulse"></div><p>AI is analyzing safety data...</p></div>}
        {aiResult && (
          <div className="ai-output">
            <div className="ai-output-header"><span className="ai-badge">AI SAFETY ANALYSIS</span><span className="model-info">Model: {aiResult.model || 'Claude Haiku'} | Events: {aiResult.eventCount}</span></div>
            <div className="ai-output-body"><ReactMarkdown>{aiResult.analysis}</ReactMarkdown></div>
            {aiResult.usage && <div className="ai-output-footer"><span>Tokens: {aiResult.usage.total_tokens}</span></div>}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="page-header"><h1>Adverse Events</h1><div className="header-actions"><button className="btn btn-primary" onClick={() => { setEditing(null); setForm(emptyForm); setShowForm(true); }}>+ New Event</button></div></div>
      <div className="search-bar"><input placeholder="Search events..." value={search} onChange={e => setSearch(e.target.value)} /></div>
      <div className="data-table-container">
        <table className="data-table">
          <thead><tr><th>Event Type</th><th>Severity</th><th>Patient</th><th>Trial</th><th>Onset</th><th>Relatedness</th><th>Status</th></tr></thead>
          <tbody>
            {filtered.map(e => (
              <tr key={e.id} onClick={() => setSelected(e)}>
                <td><strong>{e.eventType}</strong></td>
                <td><span className={getSeverityClass(e.severity)} style={{fontWeight: 700}}>{e.severity}</span></td>
                <td>{e.patientId}</td><td>{e.trialId}</td><td>{e.onsetDate}</td><td>{e.relatedness}</td>
                <td><span className={`badge ${e.status === 'closed' ? 'badge-success' : 'badge-danger'}`}>{e.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{editing ? 'Edit Event' : 'New Adverse Event'}</h2>
            <div className="form-grid">
              <div className="form-group"><label>Patient ID</label><input type="number" value={form.patientId} onChange={e => setForm({...form, patientId: e.target.value})} /></div>
              <div className="form-group"><label>Trial ID</label><input type="number" value={form.trialId} onChange={e => setForm({...form, trialId: e.target.value})} /></div>
              <div className="form-group"><label>Event Type</label><input value={form.eventType} onChange={e => setForm({...form, eventType: e.target.value})} /></div>
              <div className="form-group"><label>Severity</label><select value={form.severity} onChange={e => setForm({...form, severity: e.target.value})}><option value="">Select</option><option>Grade 1</option><option>Grade 2</option><option>Grade 3</option><option>Grade 4</option><option>Grade 5</option></select></div>
              <div className="form-group"><label>Onset Date</label><input type="date" value={form.onsetDate} onChange={e => setForm({...form, onsetDate: e.target.value})} /></div>
              <div className="form-group"><label>Resolution Date</label><input type="date" value={form.resolutionDate} onChange={e => setForm({...form, resolutionDate: e.target.value})} /></div>
              <div className="form-group"><label>Outcome</label><input value={form.outcome} onChange={e => setForm({...form, outcome: e.target.value})} /></div>
              <div className="form-group"><label>Relatedness</label><select value={form.relatedness} onChange={e => setForm({...form, relatedness: e.target.value})}><option value="">Select</option><option>Definite</option><option>Probable</option><option>Possible</option><option>Unlikely</option><option>Unrelated</option></select></div>
              <div className="form-group"><label>Action Taken</label><input value={form.actionTaken} onChange={e => setForm({...form, actionTaken: e.target.value})} /></div>
              <div className="form-group"><label>Status</label><select value={form.status} onChange={e => setForm({...form, status: e.target.value})}><option value="open">Open</option><option value="closed">Closed</option></select></div>
              <div className="form-group full-width"><label>Description</label><textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} /></div>
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
