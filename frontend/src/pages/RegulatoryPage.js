import React, { useState, useEffect } from 'react';
import api from '../services/api';
import ReactMarkdown from 'react-markdown';
import AIResultDisplay from '../components/AIResultDisplay';

export default function RegulatoryPage() {
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [aiResult, setAiResult] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const emptyForm = { trialId: '', documentType: '', title: '', status: 'pending', submissionDate: '', approvalDate: '', expiryDate: '', authority: '', referenceNumber: '', notes: '' };
  const [form, setForm] = useState(emptyForm);

  useEffect(() => { loadData(); }, []);
  const loadData = async () => { try { const res = await api.get('/regulatory'); setItems(Array.isArray(res.data) ? res.data : (res.data?.items || res.data?.data || res.data?.rows || [])); } catch(e){} setLoading(false); };

  const handleSave = async () => {
    try {
      if (editing) await api.put(`/regulatory/${editing.id}`, form);
      else await api.post('/regulatory', form);
      setShowForm(false); setEditing(null); setForm(emptyForm); loadData();
    } catch(e) { alert(e.response?.data?.error || 'Error'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this document?')) return;
    try { await api.delete(`/regulatory/${id}`); setSelected(null); loadData(); } catch(e) { alert('Error'); }
  };

  const handleEdit = (item) => { setEditing(item); setForm({...item}); setShowForm(true); };

  const handleAI = async (trialId) => {
    setAiLoading(true); setAiResult(null);
    try { const res = await api.post('/ai/check-compliance', { trialId }); setAiResult(res.data); }
    catch(e) { setAiResult({ analysis: 'Error: ' + (e.response?.data?.error || e.message) }); }
    setAiLoading(false);
  };

  const filtered = items.filter(r => `${r.title} ${r.documentType} ${r.authority}`.toLowerCase().includes(search.toLowerCase()));

  if (loading) return <div className="loading"><div className="loading-spinner"></div>Loading...</div>;

  if (selected) {
    return (
      <div>
        <button className="back-btn" onClick={() => { setSelected(null); setAiResult(null); }}>&larr; Back</button>
        <div className="detail-panel">
          <h2>{'\u{1F4DC}'} {selected.title}</h2>
          <div className="detail-grid">
            <div className="detail-field"><label>Document Type</label><div className="value">{selected.documentType}</div></div>
            <div className="detail-field"><label>Status</label><div className="value"><span className={`badge ${selected.status === 'approved' ? 'badge-success' : selected.status === 'pending' ? 'badge-warning' : 'badge-info'}`}>{selected.status}</span></div></div>
            <div className="detail-field"><label>Authority</label><div className="value">{selected.authority}</div></div>
            <div className="detail-field"><label>Reference #</label><div className="value">{selected.referenceNumber}</div></div>
            <div className="detail-field"><label>Submission Date</label><div className="value">{selected.submissionDate}</div></div>
            <div className="detail-field"><label>Approval Date</label><div className="value">{selected.approvalDate}</div></div>
            <div className="detail-field"><label>Expiry Date</label><div className="value">{selected.expiryDate || 'N/A'}</div></div>
            <div className="detail-field"><label>Trial ID</label><div className="value">{selected.trialId}</div></div>
          </div>
          <div className="detail-field" style={{marginTop: 16}}><label>Notes</label><div className="value">{selected.notes}</div></div>
          <div className="detail-actions">
            <button className="btn btn-primary" onClick={() => handleAI(selected.trialId)}>AI Compliance Check</button>
            <button className="btn btn-warning" onClick={() => handleEdit(selected)}>Edit</button>
            <button className="btn btn-danger" onClick={() => handleDelete(selected.id)}>Delete</button>
          </div>
        </div>
        {aiLoading && <div className="ai-loading"><div className="pulse"></div><p>AI is checking compliance...</p></div>}
        {aiResult && (
          <AIResultDisplay result={aiResult} loading={false} error={null} />
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="page-header"><h1>Regulatory</h1><div className="header-actions"><button className="btn btn-primary" onClick={() => { setEditing(null); setForm(emptyForm); setShowForm(true); }}>+ New Document</button></div></div>
      <div className="search-bar"><input placeholder="Search documents..." value={search} onChange={e => setSearch(e.target.value)} /></div>
      <div className="data-table-container">
        <table className="data-table">
          <thead><tr><th>Type</th><th>Title</th><th>Authority</th><th>Submission</th><th>Expiry</th><th>Status</th></tr></thead>
          <tbody>
            {filtered.map(r => (
              <tr key={r.id} onClick={() => setSelected(r)}>
                <td><strong>{r.documentType}</strong></td>
                <td style={{maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>{r.title}</td>
                <td>{r.authority}</td><td>{r.submissionDate}</td><td>{r.expiryDate || 'N/A'}</td>
                <td><span className={`badge ${r.status === 'approved' ? 'badge-success' : r.status === 'pending' ? 'badge-warning' : 'badge-info'}`}>{r.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{editing ? 'Edit Document' : 'New Regulatory Document'}</h2>
            <div className="form-grid">
              <div className="form-group"><label>Trial ID</label><input type="number" value={form.trialId} onChange={e => setForm({...form, trialId: e.target.value})} /></div>
              <div className="form-group"><label>Document Type</label><input value={form.documentType} onChange={e => setForm({...form, documentType: e.target.value})} /></div>
              <div className="form-group full-width"><label>Title</label><input value={form.title} onChange={e => setForm({...form, title: e.target.value})} /></div>
              <div className="form-group"><label>Status</label><select value={form.status} onChange={e => setForm({...form, status: e.target.value})}><option value="pending">Pending</option><option value="submitted">Submitted</option><option value="approved">Approved</option><option value="draft">Draft</option></select></div>
              <div className="form-group"><label>Authority</label><input value={form.authority} onChange={e => setForm({...form, authority: e.target.value})} /></div>
              <div className="form-group"><label>Reference #</label><input value={form.referenceNumber} onChange={e => setForm({...form, referenceNumber: e.target.value})} /></div>
              <div className="form-group"><label>Submission Date</label><input type="date" value={form.submissionDate} onChange={e => setForm({...form, submissionDate: e.target.value})} /></div>
              <div className="form-group"><label>Approval Date</label><input type="date" value={form.approvalDate} onChange={e => setForm({...form, approvalDate: e.target.value})} /></div>
              <div className="form-group"><label>Expiry Date</label><input type="date" value={form.expiryDate} onChange={e => setForm({...form, expiryDate: e.target.value})} /></div>
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
