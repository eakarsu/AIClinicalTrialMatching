import React, { useState, useEffect } from 'react';
import api from '../services/api';
import ReactMarkdown from 'react-markdown';

export default function OutcomesPage() {
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [aiResult, setAiResult] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const emptyForm = { trialId: '', patientId: '', outcomeType: '', endpoint: '', value: '', unit: '', assessmentDate: '', status: '', prediction: '', confidence: '', notes: '' };
  const [form, setForm] = useState(emptyForm);

  useEffect(() => { loadData(); }, []);
  const loadData = async () => { try { const res = await api.get('/outcomes'); setItems(res.data); } catch(e){} setLoading(false); };

  const handleSave = async () => {
    try {
      if (editing) await api.put(`/outcomes/${editing.id}`, form);
      else await api.post('/outcomes', form);
      setShowForm(false); setEditing(null); setForm(emptyForm); loadData();
    } catch(e) { alert(e.response?.data?.error || 'Error'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this outcome?')) return;
    try { await api.delete(`/outcomes/${id}`); setSelected(null); loadData(); } catch(e) { alert('Error'); }
  };

  const handleEdit = (item) => { setEditing(item); setForm({...item}); setShowForm(true); };

  const handleAI = async (patientId, trialId) => {
    setAiLoading(true); setAiResult(null);
    try { const res = await api.post('/ai/predict-outcome', { patientId, trialId }); setAiResult(res.data); }
    catch(e) { setAiResult({ prediction: 'Error: ' + (e.response?.data?.error || e.message) }); }
    setAiLoading(false);
  };

  const filtered = items.filter(o => `${o.endpoint} ${o.value} ${o.outcomeType}`.toLowerCase().includes(search.toLowerCase()));

  if (loading) return <div className="loading"><div className="loading-spinner"></div>Loading...</div>;

  if (selected) {
    return (
      <div>
        <button className="back-btn" onClick={() => { setSelected(null); setAiResult(null); }}>&larr; Back</button>
        <div className="detail-panel">
          <h2>{'\u{1F4CA}'} Outcome Details</h2>
          <div className="detail-grid">
            <div className="detail-field"><label>Endpoint</label><div className="value" style={{fontWeight: 700, fontSize: 18}}>{selected.endpoint}</div></div>
            <div className="detail-field"><label>Value</label><div className="value" style={{fontWeight: 700, fontSize: 18, color: '#6c5ce7'}}>{selected.value} {selected.unit}</div></div>
            <div className="detail-field"><label>Outcome Type</label><div className="value">{selected.outcomeType}</div></div>
            <div className="detail-field"><label>Status</label><div className="value"><span className={`badge ${selected.status === 'confirmed' ? 'badge-success' : selected.status === 'pending' ? 'badge-warning' : 'badge-info'}`}>{selected.status}</span></div></div>
            <div className="detail-field"><label>Assessment Date</label><div className="value">{selected.assessmentDate}</div></div>
            <div className="detail-field"><label>Confidence</label><div className="value">{selected.confidence ? `${(selected.confidence * 100).toFixed(0)}%` : 'N/A'}</div></div>
            <div className="detail-field"><label>Patient ID</label><div className="value">{selected.patientId}</div></div>
            <div className="detail-field"><label>Trial ID</label><div className="value">{selected.trialId}</div></div>
          </div>
          <div className="detail-field" style={{marginTop: 16}}><label>Prediction</label><div className="value">{selected.prediction}</div></div>
          <div className="detail-field" style={{marginTop: 16}}><label>Notes</label><div className="value">{selected.notes}</div></div>
          <div className="detail-actions">
            <button className="btn btn-primary" onClick={() => handleAI(selected.patientId, selected.trialId)}>AI Outcome Prediction</button>
            <button className="btn btn-warning" onClick={() => handleEdit(selected)}>Edit</button>
            <button className="btn btn-danger" onClick={() => handleDelete(selected.id)}>Delete</button>
          </div>
        </div>
        {aiLoading && <div className="ai-loading"><div className="pulse"></div><p>AI is predicting outcomes...</p></div>}
        {aiResult && (
          <div className="ai-output">
            <div className="ai-output-header"><span className="ai-badge">AI OUTCOME PREDICTION</span><span className="model-info">Model: {aiResult.model || 'Claude Haiku'}</span></div>
            <div className="ai-output-body"><ReactMarkdown>{aiResult.prediction}</ReactMarkdown></div>
            {aiResult.usage && <div className="ai-output-footer"><span>Tokens: {aiResult.usage.total_tokens}</span></div>}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="page-header"><h1>Outcomes</h1><div className="header-actions"><button className="btn btn-primary" onClick={() => { setEditing(null); setForm(emptyForm); setShowForm(true); }}>+ New Outcome</button></div></div>
      <div className="search-bar"><input placeholder="Search outcomes..." value={search} onChange={e => setSearch(e.target.value)} /></div>
      <div className="data-table-container">
        <table className="data-table">
          <thead><tr><th>Endpoint</th><th>Value</th><th>Type</th><th>Patient</th><th>Trial</th><th>Confidence</th><th>Status</th></tr></thead>
          <tbody>
            {filtered.map(o => (
              <tr key={o.id} onClick={() => setSelected(o)}>
                <td><strong>{o.endpoint}</strong></td><td>{o.value} {o.unit}</td><td>{o.outcomeType}</td>
                <td>{o.patientId}</td><td>{o.trialId}</td>
                <td>{o.confidence ? `${(o.confidence * 100).toFixed(0)}%` : 'N/A'}</td>
                <td><span className={`badge ${o.status === 'confirmed' ? 'badge-success' : o.status === 'pending' ? 'badge-warning' : 'badge-info'}`}>{o.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{editing ? 'Edit Outcome' : 'New Outcome'}</h2>
            <div className="form-grid">
              <div className="form-group"><label>Patient ID</label><input type="number" value={form.patientId} onChange={e => setForm({...form, patientId: e.target.value})} /></div>
              <div className="form-group"><label>Trial ID</label><input type="number" value={form.trialId} onChange={e => setForm({...form, trialId: e.target.value})} /></div>
              <div className="form-group"><label>Endpoint</label><input value={form.endpoint} onChange={e => setForm({...form, endpoint: e.target.value})} /></div>
              <div className="form-group"><label>Value</label><input value={form.value} onChange={e => setForm({...form, value: e.target.value})} /></div>
              <div className="form-group"><label>Unit</label><input value={form.unit} onChange={e => setForm({...form, unit: e.target.value})} /></div>
              <div className="form-group"><label>Outcome Type</label><select value={form.outcomeType} onChange={e => setForm({...form, outcomeType: e.target.value})}><option value="">Select</option><option>efficacy</option><option>safety</option><option>biomarker</option><option>quality_of_life</option></select></div>
              <div className="form-group"><label>Assessment Date</label><input type="date" value={form.assessmentDate} onChange={e => setForm({...form, assessmentDate: e.target.value})} /></div>
              <div className="form-group"><label>Status</label><select value={form.status} onChange={e => setForm({...form, status: e.target.value})}><option value="">Select</option><option>confirmed</option><option>pending</option><option>ongoing</option></select></div>
              <div className="form-group"><label>Confidence</label><input type="number" min="0" max="1" step="0.01" value={form.confidence} onChange={e => setForm({...form, confidence: e.target.value})} /></div>
              <div className="form-group full-width"><label>Prediction</label><textarea value={form.prediction} onChange={e => setForm({...form, prediction: e.target.value})} /></div>
              <div className="form-group full-width"><label>Notes</label><textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} /></div>
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
