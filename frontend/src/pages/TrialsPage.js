import React, { useState, useEffect } from 'react';
import api from '../services/api';
import ReactMarkdown from 'react-markdown';
import AIResultDisplay from '../components/AIResultDisplay';

export default function TrialsPage() {
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [aiResult, setAiResult] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const emptyForm = { trialId: '', title: '', description: '', phase: '', status: 'recruiting', sponsor: '', therapeuticArea: '', indication: '', startDate: '', endDate: '', targetEnrollment: '', currentEnrollment: 0, eligibilityCriteria: '', primaryEndpoint: '', secondaryEndpoints: '' };
  const [form, setForm] = useState(emptyForm);

  useEffect(() => { loadData(); }, []);
  const loadData = async () => { try { const res = await api.get('/trials'); setItems(Array.isArray(res.data) ? res.data : (res.data?.items || res.data?.data || res.data?.rows || [])); } catch(e){} setLoading(false); };

  const handleSave = async () => {
    try {
      if (editing) await api.put(`/trials/${editing.id}`, form);
      else await api.post('/trials', form);
      setShowForm(false); setEditing(null); setForm(emptyForm); loadData();
    } catch(e) { alert(e.response?.data?.error || 'Error'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this trial?')) return;
    try { await api.delete(`/trials/${id}`); setSelected(null); loadData(); } catch(e) { alert('Error'); }
  };

  const handleEdit = (item) => { setEditing(item); setForm({...item}); setShowForm(true); };

  const handleAI = async (trialId) => {
    setAiLoading(true); setAiResult(null);
    try { const res = await api.post('/ai/optimize-enrollment', { trialId }); setAiResult(res.data); }
    catch(e) { setAiResult({ analysis: 'Error: ' + (e.response?.data?.error || e.message) }); }
    setAiLoading(false);
  };

  const filtered = items.filter(t => `${t.trialId} ${t.title} ${t.indication}`.toLowerCase().includes(search.toLowerCase()));

  if (loading) return <div className="loading"><div className="loading-spinner"></div>Loading trials...</div>;

  if (selected) {
    const pct = selected.targetEnrollment ? Math.round((selected.currentEnrollment / selected.targetEnrollment) * 100) : 0;
    return (
      <div>
        <button className="back-btn" onClick={() => { setSelected(null); setAiResult(null); }}>&#8592; Back to Trials</button>
        <div className="detail-panel">
          <h2>{'\u{1F9EA}'} {selected.title}</h2>
          <div className="detail-grid">
            <div className="detail-field"><label>Trial ID</label><div className="value">{selected.trialId}</div></div>
            <div className="detail-field"><label>Phase</label><div className="value">{selected.phase}</div></div>
            <div className="detail-field"><label>Status</label><div className="value"><span className={`badge ${selected.status === 'recruiting' ? 'badge-success' : 'badge-info'}`}>{selected.status}</span></div></div>
            <div className="detail-field"><label>Sponsor</label><div className="value">{selected.sponsor}</div></div>
            <div className="detail-field"><label>Therapeutic Area</label><div className="value">{selected.therapeuticArea}</div></div>
            <div className="detail-field"><label>Indication</label><div className="value">{selected.indication}</div></div>
            <div className="detail-field"><label>Start Date</label><div className="value">{selected.startDate}</div></div>
            <div className="detail-field"><label>End Date</label><div className="value">{selected.endDate}</div></div>
            <div className="detail-field"><label>Enrollment</label><div className="value">{selected.currentEnrollment} / {selected.targetEnrollment} ({pct}%)</div></div>
            <div className="detail-field"><label>Primary Endpoint</label><div className="value">{selected.primaryEndpoint}</div></div>
          </div>
          <div className="detail-field" style={{marginTop: 16}}><label>Description</label><div className="value">{selected.description}</div></div>
          <div className="detail-field" style={{marginTop: 16}}><label>Eligibility Criteria</label><div className="value">{selected.eligibilityCriteria}</div></div>
          <div className="detail-actions">
            <button className="btn btn-primary" onClick={() => handleAI(selected.id)}>AI Enrollment Optimization</button>
            <button className="btn btn-warning" onClick={() => handleEdit(selected)}>Edit</button>
            <button className="btn btn-danger" onClick={() => handleDelete(selected.id)}>Delete</button>
          </div>
        </div>
        {aiLoading && <div className="ai-loading"><div className="pulse"></div><p>AI is analyzing enrollment data...</p></div>}
        {aiResult && (
          <AIResultDisplay result={aiResult} loading={false} error={null} />
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="page-header"><h1>Clinical Trials</h1><div className="header-actions"><button className="btn btn-primary" onClick={() => { setEditing(null); setForm(emptyForm); setShowForm(true); }}>+ New Trial</button></div></div>
      <div className="search-bar"><input placeholder="Search trials..." value={search} onChange={e => setSearch(e.target.value)} /></div>
      <div className="data-table-container">
        <table className="data-table">
          <thead><tr><th>Trial ID</th><th>Title</th><th>Phase</th><th>Status</th><th>Sponsor</th><th>Indication</th><th>Enrollment</th></tr></thead>
          <tbody>
            {filtered.map(t => (
              <tr key={t.id} onClick={() => setSelected(t)}>
                <td><strong>{t.trialId}</strong></td>
                <td style={{maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>{t.title}</td>
                <td>{t.phase}</td>
                <td><span className={`badge ${t.status === 'recruiting' ? 'badge-success' : 'badge-info'}`}>{t.status}</span></td>
                <td>{t.sponsor}</td>
                <td>{t.indication}</td>
                <td>{t.currentEnrollment}/{t.targetEnrollment}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{editing ? 'Edit Trial' : 'New Trial'}</h2>
            <div className="form-grid">
              <div className="form-group"><label>Trial ID</label><input value={form.trialId} onChange={e => setForm({...form, trialId: e.target.value})} /></div>
              <div className="form-group"><label>Phase</label><select value={form.phase} onChange={e => setForm({...form, phase: e.target.value})}><option value="">Select</option><option>Phase I</option><option>Phase II</option><option>Phase II/III</option><option>Phase III</option><option>Phase IV</option></select></div>
              <div className="form-group full-width"><label>Title</label><input value={form.title} onChange={e => setForm({...form, title: e.target.value})} /></div>
              <div className="form-group"><label>Status</label><select value={form.status} onChange={e => setForm({...form, status: e.target.value})}><option value="recruiting">Recruiting</option><option value="active">Active</option><option value="completed">Completed</option><option value="suspended">Suspended</option></select></div>
              <div className="form-group"><label>Sponsor</label><input value={form.sponsor} onChange={e => setForm({...form, sponsor: e.target.value})} /></div>
              <div className="form-group"><label>Therapeutic Area</label><input value={form.therapeuticArea} onChange={e => setForm({...form, therapeuticArea: e.target.value})} /></div>
              <div className="form-group"><label>Indication</label><input value={form.indication} onChange={e => setForm({...form, indication: e.target.value})} /></div>
              <div className="form-group"><label>Start Date</label><input type="date" value={form.startDate} onChange={e => setForm({...form, startDate: e.target.value})} /></div>
              <div className="form-group"><label>End Date</label><input type="date" value={form.endDate} onChange={e => setForm({...form, endDate: e.target.value})} /></div>
              <div className="form-group"><label>Target Enrollment</label><input type="number" value={form.targetEnrollment} onChange={e => setForm({...form, targetEnrollment: e.target.value})} /></div>
              <div className="form-group"><label>Current Enrollment</label><input type="number" value={form.currentEnrollment} onChange={e => setForm({...form, currentEnrollment: e.target.value})} /></div>
              <div className="form-group"><label>Primary Endpoint</label><input value={form.primaryEndpoint} onChange={e => setForm({...form, primaryEndpoint: e.target.value})} /></div>
              <div className="form-group full-width"><label>Description</label><textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} /></div>
              <div className="form-group full-width"><label>Eligibility Criteria</label><textarea value={form.eligibilityCriteria} onChange={e => setForm({...form, eligibilityCriteria: e.target.value})} /></div>
              <div className="form-group full-width"><label>Secondary Endpoints</label><textarea value={form.secondaryEndpoints} onChange={e => setForm({...form, secondaryEndpoints: e.target.value})} /></div>
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
