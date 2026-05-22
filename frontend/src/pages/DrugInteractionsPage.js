import React, { useState, useEffect } from 'react';
import api from '../services/api';
import ReactMarkdown from 'react-markdown';
import AIResultDisplay from '../components/AIResultDisplay';

export default function DrugInteractionsPage() {
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [aiResult, setAiResult] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [checkMeds, setCheckMeds] = useState('');
  const emptyForm = { drugA: '', drugB: '', interactionType: '', severity: '', description: '', recommendation: '', evidenceLevel: '', mechanism: '' };
  const [form, setForm] = useState(emptyForm);

  useEffect(() => { loadData(); }, []);
  const loadData = async () => { try { const res = await api.get('/drug-interactions'); setItems(Array.isArray(res.data) ? res.data : (res.data?.items || res.data?.data || res.data?.rows || [])); } catch(e){} setLoading(false); };

  const handleSave = async () => {
    try {
      if (editing) await api.put(`/drug-interactions/${editing.id}`, form);
      else await api.post('/drug-interactions', form);
      setShowForm(false); setEditing(null); setForm(emptyForm); loadData();
    } catch(e) { alert(e.response?.data?.error || 'Error'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this interaction?')) return;
    try { await api.delete(`/drug-interactions/${id}`); setSelected(null); loadData(); } catch(e) { alert('Error'); }
  };

  const handleEdit = (item) => { setEditing(item); setForm({...item}); setShowForm(true); };

  const handleAICheck = async () => {
    if (!checkMeds.trim()) return alert('Enter medications to check');
    setAiLoading(true); setAiResult(null);
    try { const res = await api.post('/ai/check-interactions', { medications: checkMeds }); setAiResult(res.data); }
    catch(e) { setAiResult({ analysis: 'Error: ' + (e.response?.data?.error || e.message) }); }
    setAiLoading(false);
  };

  const getSeverityBadge = (s) => {
    if (!s) return 'badge-secondary';
    const lower = s.toLowerCase();
    if (lower === 'high') return 'badge-danger';
    if (lower === 'moderate') return 'badge-warning';
    return 'badge-success';
  };

  const filtered = items.filter(i => `${i.drugA} ${i.drugB} ${i.severity}`.toLowerCase().includes(search.toLowerCase()));

  if (loading) return <div className="loading"><div className="loading-spinner"></div>Loading...</div>;

  if (selected) {
    return (
      <div>
        <button className="back-btn" onClick={() => setSelected(null)}>&larr; Back</button>
        <div className="detail-panel">
          <h2>{'\u{1F48A}'} {selected.drugA} + {selected.drugB}</h2>
          <div className="detail-grid">
            <div className="detail-field"><label>Drug A</label><div className="value">{selected.drugA}</div></div>
            <div className="detail-field"><label>Drug B</label><div className="value">{selected.drugB}</div></div>
            <div className="detail-field"><label>Interaction Type</label><div className="value">{selected.interactionType}</div></div>
            <div className="detail-field"><label>Severity</label><div className="value"><span className={`badge ${getSeverityBadge(selected.severity)}`}>{selected.severity}</span></div></div>
            <div className="detail-field"><label>Evidence Level</label><div className="value">{selected.evidenceLevel}</div></div>
          </div>
          <div className="detail-field" style={{marginTop: 16}}><label>Description</label><div className="value">{selected.description}</div></div>
          <div className="detail-field" style={{marginTop: 16}}><label>Mechanism</label><div className="value">{selected.mechanism}</div></div>
          <div className="detail-field" style={{marginTop: 16}}><label>Recommendation</label><div className="value">{selected.recommendation}</div></div>
          <div className="detail-actions">
            <button className="btn btn-warning" onClick={() => handleEdit(selected)}>Edit</button>
            <button className="btn btn-danger" onClick={() => handleDelete(selected.id)}>Delete</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header"><h1>Drug Interactions</h1><div className="header-actions"><button className="btn btn-primary" onClick={() => { setEditing(null); setForm(emptyForm); setShowForm(true); }}>+ New Interaction</button></div></div>

      <div className="detail-panel" style={{marginBottom: 24}}>
        <h2 style={{fontSize: 18}}>{'\u{1F916}'} AI Drug Interaction Checker</h2>
        <div className="form-group">
          <label>Enter Medications (comma-separated)</label>
          <textarea value={checkMeds} onChange={e => setCheckMeds(e.target.value)} placeholder="e.g., Osimertinib, Metformin, Lisinopril" style={{minHeight: 60}} />
        </div>
        <button className="btn btn-primary" onClick={handleAICheck} disabled={aiLoading}>Check Interactions with AI</button>
        {aiLoading && <div className="ai-loading" style={{marginTop: 16}}><div className="pulse"></div><p>AI is checking interactions...</p></div>}
        {aiResult && (
          <div style={{ marginTop: 16 }}>
            <AIResultDisplay result={aiResult} loading={false} error={null} />
          </div>
        )}
      </div>

      <div className="search-bar"><input placeholder="Search interactions..." value={search} onChange={e => setSearch(e.target.value)} /></div>
      <div className="data-table-container">
        <table className="data-table">
          <thead><tr><th>Drug A</th><th>Drug B</th><th>Type</th><th>Severity</th><th>Evidence</th></tr></thead>
          <tbody>
            {filtered.map(i => (
              <tr key={i.id} onClick={() => setSelected(i)}>
                <td><strong>{i.drugA}</strong></td><td><strong>{i.drugB}</strong></td><td>{i.interactionType}</td>
                <td><span className={`badge ${getSeverityBadge(i.severity)}`}>{i.severity}</span></td>
                <td>{i.evidenceLevel}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{editing ? 'Edit Interaction' : 'New Drug Interaction'}</h2>
            <div className="form-grid">
              <div className="form-group"><label>Drug A</label><input value={form.drugA} onChange={e => setForm({...form, drugA: e.target.value})} /></div>
              <div className="form-group"><label>Drug B</label><input value={form.drugB} onChange={e => setForm({...form, drugB: e.target.value})} /></div>
              <div className="form-group"><label>Interaction Type</label><select value={form.interactionType} onChange={e => setForm({...form, interactionType: e.target.value})}><option value="">Select</option><option>Pharmacokinetic</option><option>Pharmacodynamic</option></select></div>
              <div className="form-group"><label>Severity</label><select value={form.severity} onChange={e => setForm({...form, severity: e.target.value})}><option value="">Select</option><option>Low</option><option>Moderate</option><option>High</option></select></div>
              <div className="form-group"><label>Evidence Level</label><select value={form.evidenceLevel} onChange={e => setForm({...form, evidenceLevel: e.target.value})}><option value="">Select</option><option>Low</option><option>Moderate</option><option>High</option></select></div>
              <div className="form-group full-width"><label>Description</label><textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} /></div>
              <div className="form-group full-width"><label>Mechanism</label><textarea value={form.mechanism} onChange={e => setForm({...form, mechanism: e.target.value})} /></div>
              <div className="form-group full-width"><label>Recommendation</label><textarea value={form.recommendation} onChange={e => setForm({...form, recommendation: e.target.value})} /></div>
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
