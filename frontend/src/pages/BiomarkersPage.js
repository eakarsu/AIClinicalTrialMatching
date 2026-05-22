import React, { useState, useEffect } from 'react';
import api from '../services/api';
import ReactMarkdown from 'react-markdown';
import AIResultDisplay from '../components/AIResultDisplay';

export default function BiomarkersPage() {
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [aiResult, setAiResult] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const emptyForm = { patientId: '', name: '', value: '', unit: '', testDate: '', normalRange: '', status: '', category: '', significance: '' };
  const [form, setForm] = useState(emptyForm);

  useEffect(() => { loadData(); }, []);
  const loadData = async () => { try { const res = await api.get('/biomarkers'); setItems(Array.isArray(res.data) ? res.data : (res.data?.items || res.data?.data || res.data?.rows || [])); } catch(e){} setLoading(false); };

  const handleSave = async () => {
    try {
      if (editing) await api.put(`/biomarkers/${editing.id}`, form);
      else await api.post('/biomarkers', form);
      setShowForm(false); setEditing(null); setForm(emptyForm); loadData();
    } catch(e) { alert(e.response?.data?.error || 'Error'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this biomarker?')) return;
    try { await api.delete(`/biomarkers/${id}`); setSelected(null); loadData(); } catch(e) { alert('Error'); }
  };

  const handleEdit = (item) => { setEditing(item); setForm({...item}); setShowForm(true); };

  const handleAI = async (patientId) => {
    setAiLoading(true); setAiResult(null);
    try { const res = await api.post('/ai/analyze-biomarkers', { patientId }); setAiResult(res.data); }
    catch(e) { setAiResult({ analysis: 'Error: ' + (e.response?.data?.error || e.message) }); }
    setAiLoading(false);
  };

  const filtered = items.filter(b => `${b.name} ${b.value} ${b.category}`.toLowerCase().includes(search.toLowerCase()));

  if (loading) return <div className="loading"><div className="loading-spinner"></div>Loading...</div>;

  if (selected) {
    return (
      <div>
        <button className="back-btn" onClick={() => { setSelected(null); setAiResult(null); }}>&larr; Back</button>
        <div className="detail-panel">
          <h2>{'\u{1F9EC}'} {selected.name}</h2>
          <div className="detail-grid">
            <div className="detail-field"><label>Value</label><div className="value" style={{fontSize: 20, fontWeight: 700}}>{selected.value} {selected.unit}</div></div>
            <div className="detail-field"><label>Normal Range</label><div className="value">{selected.normalRange}</div></div>
            <div className="detail-field"><label>Category</label><div className="value">{selected.category}</div></div>
            <div className="detail-field"><label>Status</label><div className="value"><span className={`badge ${selected.status === 'abnormal' ? 'badge-danger' : selected.status === 'favorable' ? 'badge-success' : 'badge-info'}`}>{selected.status}</span></div></div>
            <div className="detail-field"><label>Test Date</label><div className="value">{selected.testDate}</div></div>
            <div className="detail-field"><label>Patient ID</label><div className="value">{selected.patientId}</div></div>
          </div>
          <div className="detail-field" style={{marginTop: 16}}><label>Clinical Significance</label><div className="value">{selected.significance}</div></div>
          <div className="detail-actions">
            <button className="btn btn-primary" onClick={() => handleAI(selected.patientId)}>AI Biomarker Analysis</button>
            <button className="btn btn-warning" onClick={() => handleEdit(selected)}>Edit</button>
            <button className="btn btn-danger" onClick={() => handleDelete(selected.id)}>Delete</button>
          </div>
        </div>
        {aiLoading && <div className="ai-loading"><div className="pulse"></div><p>AI is analyzing biomarkers...</p></div>}
        {aiResult && (
          <AIResultDisplay result={aiResult} loading={false} error={null} />
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="page-header"><h1>Biomarkers</h1><div className="header-actions"><button className="btn btn-primary" onClick={() => { setEditing(null); setForm(emptyForm); setShowForm(true); }}>+ New Biomarker</button></div></div>
      <div className="search-bar"><input placeholder="Search biomarkers..." value={search} onChange={e => setSearch(e.target.value)} /></div>
      <div className="data-table-container">
        <table className="data-table">
          <thead><tr><th>Name</th><th>Value</th><th>Normal Range</th><th>Category</th><th>Patient</th><th>Status</th></tr></thead>
          <tbody>
            {filtered.map(b => (
              <tr key={b.id} onClick={() => setSelected(b)}>
                <td><strong>{b.name}</strong></td><td>{b.value} {b.unit}</td><td>{b.normalRange}</td><td>{b.category}</td><td>{b.patientId}</td>
                <td><span className={`badge ${b.status === 'abnormal' ? 'badge-danger' : b.status === 'favorable' ? 'badge-success' : 'badge-info'}`}>{b.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{editing ? 'Edit Biomarker' : 'New Biomarker'}</h2>
            <div className="form-grid">
              <div className="form-group"><label>Patient ID</label><input type="number" value={form.patientId} onChange={e => setForm({...form, patientId: e.target.value})} /></div>
              <div className="form-group"><label>Name</label><input value={form.name} onChange={e => setForm({...form, name: e.target.value})} /></div>
              <div className="form-group"><label>Value</label><input value={form.value} onChange={e => setForm({...form, value: e.target.value})} /></div>
              <div className="form-group"><label>Unit</label><input value={form.unit} onChange={e => setForm({...form, unit: e.target.value})} /></div>
              <div className="form-group"><label>Test Date</label><input type="date" value={form.testDate} onChange={e => setForm({...form, testDate: e.target.value})} /></div>
              <div className="form-group"><label>Normal Range</label><input value={form.normalRange} onChange={e => setForm({...form, normalRange: e.target.value})} /></div>
              <div className="form-group"><label>Category</label><select value={form.category} onChange={e => setForm({...form, category: e.target.value})}><option value="">Select</option><option>Genomic</option><option>Protein</option><option>Immunologic</option><option>Tumor Marker</option><option>Epigenomic</option><option>Proliferation</option></select></div>
              <div className="form-group"><label>Status</label><select value={form.status} onChange={e => setForm({...form, status: e.target.value})}><option value="">Select</option><option value="abnormal">Abnormal</option><option value="normal">Normal</option><option value="favorable">Favorable</option></select></div>
              <div className="form-group full-width"><label>Significance</label><textarea value={form.significance} onChange={e => setForm({...form, significance: e.target.value})} /></div>
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
