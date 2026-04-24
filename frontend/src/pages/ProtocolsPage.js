import React, { useState, useEffect } from 'react';
import api from '../services/api';
import ReactMarkdown from 'react-markdown';

export default function ProtocolsPage() {
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [aiResult, setAiResult] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const emptyForm = { trialId: '', protocolNumber: '', title: '', version: '', status: 'draft', approvalDate: '', amendmentNumber: 0, summary: '', objectives: '', studyDesign: '', dosageRegimen: '' };
  const [form, setForm] = useState(emptyForm);

  useEffect(() => { loadData(); }, []);
  const loadData = async () => { try { const res = await api.get('/protocols'); setItems(res.data); } catch(e){} setLoading(false); };

  const handleSave = async () => {
    try {
      if (editing) await api.put(`/protocols/${editing.id}`, form);
      else await api.post('/protocols', form);
      setShowForm(false); setEditing(null); setForm(emptyForm); loadData();
    } catch(e) { alert(e.response?.data?.error || 'Error'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this protocol?')) return;
    try { await api.delete(`/protocols/${id}`); setSelected(null); loadData(); } catch(e) { alert('Error'); }
  };

  const handleEdit = (item) => { setEditing(item); setForm({...item}); setShowForm(true); };

  const handleAI = async (protocolId) => {
    setAiLoading(true); setAiResult(null);
    try { const res = await api.post('/ai/analyze-protocol', { protocolId }); setAiResult(res.data); }
    catch(e) { setAiResult({ analysis: 'Error: ' + (e.response?.data?.error || e.message) }); }
    setAiLoading(false);
  };

  const filtered = items.filter(p => `${p.protocolNumber} ${p.title} ${p.status}`.toLowerCase().includes(search.toLowerCase()));

  if (loading) return <div className="loading"><div className="loading-spinner"></div>Loading...</div>;

  if (selected) {
    return (
      <div>
        <button className="back-btn" onClick={() => { setSelected(null); setAiResult(null); }}>&larr; Back</button>
        <div className="detail-panel">
          <h2>{'\u{1F4D1}'} {selected.title}</h2>
          <div className="detail-grid">
            <div className="detail-field"><label>Protocol Number</label><div className="value">{selected.protocolNumber}</div></div>
            <div className="detail-field"><label>Version</label><div className="value">{selected.version}</div></div>
            <div className="detail-field"><label>Status</label><div className="value"><span className={`badge ${selected.status === 'approved' ? 'badge-success' : selected.status === 'draft' ? 'badge-warning' : 'badge-info'}`}>{selected.status}</span></div></div>
            <div className="detail-field"><label>Approval Date</label><div className="value">{selected.approvalDate}</div></div>
            <div className="detail-field"><label>Amendment #</label><div className="value">{selected.amendmentNumber}</div></div>
            <div className="detail-field"><label>Trial ID</label><div className="value">{selected.trialId}</div></div>
          </div>
          <div className="detail-field" style={{marginTop: 16}}><label>Summary</label><div className="value">{selected.summary}</div></div>
          <div className="detail-field" style={{marginTop: 16}}><label>Objectives</label><div className="value">{selected.objectives}</div></div>
          <div className="detail-field" style={{marginTop: 16}}><label>Study Design</label><div className="value">{selected.studyDesign}</div></div>
          <div className="detail-field" style={{marginTop: 16}}><label>Dosage Regimen</label><div className="value">{selected.dosageRegimen}</div></div>
          <div className="detail-actions">
            <button className="btn btn-primary" onClick={() => handleAI(selected.id)}>AI Protocol Analysis</button>
            <button className="btn btn-warning" onClick={() => handleEdit(selected)}>Edit</button>
            <button className="btn btn-danger" onClick={() => handleDelete(selected.id)}>Delete</button>
          </div>
        </div>
        {aiLoading && <div className="ai-loading"><div className="pulse"></div><p>AI is analyzing protocol...</p></div>}
        {aiResult && (
          <div className="ai-output">
            <div className="ai-output-header"><span className="ai-badge">AI PROTOCOL ANALYSIS</span><span className="model-info">Model: {aiResult.model || 'Claude Haiku'}</span></div>
            <div className="ai-output-body"><ReactMarkdown>{aiResult.analysis}</ReactMarkdown></div>
            {aiResult.usage && <div className="ai-output-footer"><span>Tokens: {aiResult.usage.total_tokens}</span></div>}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="page-header"><h1>Protocols</h1><div className="header-actions"><button className="btn btn-primary" onClick={() => { setEditing(null); setForm(emptyForm); setShowForm(true); }}>+ New Protocol</button></div></div>
      <div className="search-bar"><input placeholder="Search protocols..." value={search} onChange={e => setSearch(e.target.value)} /></div>
      <div className="data-table-container">
        <table className="data-table">
          <thead><tr><th>Protocol #</th><th>Title</th><th>Version</th><th>Status</th><th>Approval Date</th><th>Amendments</th></tr></thead>
          <tbody>
            {filtered.map(p => (
              <tr key={p.id} onClick={() => setSelected(p)}>
                <td><strong>{p.protocolNumber}</strong></td>
                <td style={{maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>{p.title}</td>
                <td>{p.version}</td>
                <td><span className={`badge ${p.status === 'approved' ? 'badge-success' : 'badge-warning'}`}>{p.status}</span></td>
                <td>{p.approvalDate}</td><td>{p.amendmentNumber}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{editing ? 'Edit Protocol' : 'New Protocol'}</h2>
            <div className="form-grid">
              <div className="form-group"><label>Protocol Number</label><input value={form.protocolNumber} onChange={e => setForm({...form, protocolNumber: e.target.value})} /></div>
              <div className="form-group"><label>Trial ID</label><input type="number" value={form.trialId} onChange={e => setForm({...form, trialId: e.target.value})} /></div>
              <div className="form-group full-width"><label>Title</label><input value={form.title} onChange={e => setForm({...form, title: e.target.value})} /></div>
              <div className="form-group"><label>Version</label><input value={form.version} onChange={e => setForm({...form, version: e.target.value})} /></div>
              <div className="form-group"><label>Status</label><select value={form.status} onChange={e => setForm({...form, status: e.target.value})}><option value="draft">Draft</option><option value="approved">Approved</option><option value="amended">Amended</option></select></div>
              <div className="form-group"><label>Approval Date</label><input type="date" value={form.approvalDate} onChange={e => setForm({...form, approvalDate: e.target.value})} /></div>
              <div className="form-group"><label>Amendment #</label><input type="number" value={form.amendmentNumber} onChange={e => setForm({...form, amendmentNumber: e.target.value})} /></div>
              <div className="form-group full-width"><label>Summary</label><textarea value={form.summary} onChange={e => setForm({...form, summary: e.target.value})} /></div>
              <div className="form-group full-width"><label>Objectives</label><textarea value={form.objectives} onChange={e => setForm({...form, objectives: e.target.value})} /></div>
              <div className="form-group full-width"><label>Study Design</label><textarea value={form.studyDesign} onChange={e => setForm({...form, studyDesign: e.target.value})} /></div>
              <div className="form-group full-width"><label>Dosage Regimen</label><textarea value={form.dosageRegimen} onChange={e => setForm({...form, dosageRegimen: e.target.value})} /></div>
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
