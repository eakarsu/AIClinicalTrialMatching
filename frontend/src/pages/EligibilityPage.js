import React, { useState, useEffect } from 'react';
import api from '../services/api';

export default function EligibilityPage() {
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const emptyForm = { trialId: '', criteriaType: '', category: '', description: '', isInclusion: true, priority: 'required', ageMin: '', ageMax: '', gender: 'All', biomarkerRequirement: '' };
  const [form, setForm] = useState(emptyForm);

  useEffect(() => { loadData(); }, []);
  const loadData = async () => { try { const res = await api.get('/eligibility'); setItems(Array.isArray(res.data) ? res.data : (res.data?.items || res.data?.data || res.data?.rows || [])); } catch(e){} setLoading(false); };

  const handleSave = async () => {
    try {
      if (editing) await api.put(`/eligibility/${editing.id}`, form);
      else await api.post('/eligibility', form);
      setShowForm(false); setEditing(null); setForm(emptyForm); loadData();
    } catch(e) { alert(e.response?.data?.error || 'Error'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this criteria?')) return;
    try { await api.delete(`/eligibility/${id}`); setSelected(null); loadData(); } catch(e) { alert('Error'); }
  };

  const handleEdit = (item) => { setEditing(item); setForm({...item}); setShowForm(true); };

  const filtered = items.filter(e => `${e.description} ${e.category} ${e.criteriaType}`.toLowerCase().includes(search.toLowerCase()));

  if (loading) return <div className="loading"><div className="loading-spinner"></div>Loading...</div>;

  if (selected) {
    return (
      <div>
        <button className="back-btn" onClick={() => setSelected(null)}>&larr; Back</button>
        <div className="detail-panel">
          <h2>{'\u2705'} Eligibility Criteria</h2>
          <div className="detail-grid">
            <div className="detail-field"><label>Type</label><div className="value"><span className={`badge ${selected.isInclusion ? 'badge-success' : 'badge-danger'}`}>{selected.isInclusion ? 'Inclusion' : 'Exclusion'}</span></div></div>
            <div className="detail-field"><label>Category</label><div className="value">{selected.category}</div></div>
            <div className="detail-field"><label>Criteria Type</label><div className="value">{selected.criteriaType}</div></div>
            <div className="detail-field"><label>Priority</label><div className="value">{selected.priority}</div></div>
            <div className="detail-field"><label>Age Range</label><div className="value">{selected.ageMin || 'N/A'} - {selected.ageMax || 'N/A'}</div></div>
            <div className="detail-field"><label>Gender</label><div className="value">{selected.gender}</div></div>
            <div className="detail-field"><label>Trial ID</label><div className="value">{selected.trialId}</div></div>
          </div>
          <div className="detail-field" style={{marginTop: 16}}><label>Description</label><div className="value">{selected.description}</div></div>
          <div className="detail-field" style={{marginTop: 16}}><label>Biomarker Requirement</label><div className="value">{selected.biomarkerRequirement || 'None'}</div></div>
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
      <div className="page-header"><h1>Eligibility Criteria</h1><div className="header-actions"><button className="btn btn-primary" onClick={() => { setEditing(null); setForm(emptyForm); setShowForm(true); }}>+ New Criteria</button></div></div>
      <div className="search-bar"><input placeholder="Search criteria..." value={search} onChange={e => setSearch(e.target.value)} /></div>
      <div className="data-table-container">
        <table className="data-table">
          <thead><tr><th>Type</th><th>Category</th><th>Description</th><th>Priority</th><th>Gender</th><th>Trial</th></tr></thead>
          <tbody>
            {filtered.map(e => (
              <tr key={e.id} onClick={() => setSelected(e)}>
                <td><span className={`badge ${e.isInclusion ? 'badge-success' : 'badge-danger'}`}>{e.isInclusion ? 'Inclusion' : 'Exclusion'}</span></td>
                <td>{e.category}</td>
                <td style={{maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>{e.description}</td>
                <td>{e.priority}</td><td>{e.gender}</td><td>{e.trialId}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{editing ? 'Edit Criteria' : 'New Eligibility Criteria'}</h2>
            <div className="form-grid">
              <div className="form-group"><label>Trial ID</label><input type="number" value={form.trialId} onChange={e => setForm({...form, trialId: e.target.value})} /></div>
              <div className="form-group"><label>Criteria Type</label><input value={form.criteriaType} onChange={e => setForm({...form, criteriaType: e.target.value})} placeholder="e.g., Molecular, Clinical" /></div>
              <div className="form-group"><label>Category</label><input value={form.category} onChange={e => setForm({...form, category: e.target.value})} placeholder="e.g., Biomarker, Disease Stage" /></div>
              <div className="form-group"><label>Inclusion/Exclusion</label><select value={form.isInclusion} onChange={e => setForm({...form, isInclusion: e.target.value === 'true'})}><option value="true">Inclusion</option><option value="false">Exclusion</option></select></div>
              <div className="form-group"><label>Priority</label><select value={form.priority} onChange={e => setForm({...form, priority: e.target.value})}><option value="required">Required</option><option value="preferred">Preferred</option><option value="optional">Optional</option></select></div>
              <div className="form-group"><label>Gender</label><select value={form.gender} onChange={e => setForm({...form, gender: e.target.value})}><option>All</option><option>Male</option><option>Female</option></select></div>
              <div className="form-group"><label>Min Age</label><input type="number" value={form.ageMin} onChange={e => setForm({...form, ageMin: e.target.value})} /></div>
              <div className="form-group"><label>Max Age</label><input type="number" value={form.ageMax} onChange={e => setForm({...form, ageMax: e.target.value})} /></div>
              <div className="form-group full-width"><label>Description</label><textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} /></div>
              <div className="form-group full-width"><label>Biomarker Requirement</label><textarea value={form.biomarkerRequirement} onChange={e => setForm({...form, biomarkerRequirement: e.target.value})} /></div>
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
