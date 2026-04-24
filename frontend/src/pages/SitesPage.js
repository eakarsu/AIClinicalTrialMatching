import React, { useState, useEffect } from 'react';
import api from '../services/api';

export default function SitesPage() {
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const emptyForm = { name: '', address: '', city: '', state: '', country: 'USA', zipCode: '', principalInvestigator: '', contactEmail: '', contactPhone: '', capacity: '', activeTrials: 0, status: 'active' };
  const [form, setForm] = useState(emptyForm);

  useEffect(() => { loadData(); }, []);
  const loadData = async () => { try { const res = await api.get('/sites'); setItems(res.data); } catch(e){} setLoading(false); };

  const handleSave = async () => {
    try {
      if (editing) await api.put(`/sites/${editing.id}`, form);
      else await api.post('/sites', form);
      setShowForm(false); setEditing(null); setForm(emptyForm); loadData();
    } catch(e) { alert(e.response?.data?.error || 'Error'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this site?')) return;
    try { await api.delete(`/sites/${id}`); setSelected(null); loadData(); } catch(e) { alert('Error'); }
  };

  const handleEdit = (item) => { setEditing(item); setForm({...item}); setShowForm(true); };

  const filtered = items.filter(s => `${s.name} ${s.city} ${s.principalInvestigator}`.toLowerCase().includes(search.toLowerCase()));

  if (loading) return <div className="loading"><div className="loading-spinner"></div>Loading sites...</div>;

  if (selected) {
    return (
      <div>
        <button className="back-btn" onClick={() => setSelected(null)}>&larr; Back to Sites</button>
        <div className="detail-panel">
          <h2>{'\u{1F3E5}'} {selected.name}</h2>
          <div className="detail-grid">
            <div className="detail-field"><label>Address</label><div className="value">{selected.address}</div></div>
            <div className="detail-field"><label>City</label><div className="value">{selected.city}, {selected.state}</div></div>
            <div className="detail-field"><label>Country</label><div className="value">{selected.country}</div></div>
            <div className="detail-field"><label>Zip Code</label><div className="value">{selected.zipCode}</div></div>
            <div className="detail-field"><label>Principal Investigator</label><div className="value">{selected.principalInvestigator}</div></div>
            <div className="detail-field"><label>Contact Email</label><div className="value">{selected.contactEmail}</div></div>
            <div className="detail-field"><label>Contact Phone</label><div className="value">{selected.contactPhone}</div></div>
            <div className="detail-field"><label>Capacity</label><div className="value">{selected.capacity}</div></div>
            <div className="detail-field"><label>Active Trials</label><div className="value">{selected.activeTrials}</div></div>
            <div className="detail-field"><label>Status</label><div className="value"><span className={`badge ${selected.status === 'active' ? 'badge-success' : 'badge-secondary'}`}>{selected.status}</span></div></div>
          </div>
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
      <div className="page-header"><h1>Sites</h1><div className="header-actions"><button className="btn btn-primary" onClick={() => { setEditing(null); setForm(emptyForm); setShowForm(true); }}>+ New Site</button></div></div>
      <div className="search-bar"><input placeholder="Search sites..." value={search} onChange={e => setSearch(e.target.value)} /></div>
      <div className="data-table-container">
        <table className="data-table">
          <thead><tr><th>Name</th><th>City</th><th>State</th><th>PI</th><th>Capacity</th><th>Active Trials</th><th>Status</th></tr></thead>
          <tbody>
            {filtered.map(s => (
              <tr key={s.id} onClick={() => setSelected(s)}>
                <td><strong>{s.name}</strong></td><td>{s.city}</td><td>{s.state}</td>
                <td>{s.principalInvestigator}</td><td>{s.capacity}</td><td>{s.activeTrials}</td>
                <td><span className={`badge ${s.status === 'active' ? 'badge-success' : 'badge-secondary'}`}>{s.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{editing ? 'Edit Site' : 'New Site'}</h2>
            <div className="form-grid">
              <div className="form-group full-width"><label>Name</label><input value={form.name} onChange={e => setForm({...form, name: e.target.value})} /></div>
              <div className="form-group full-width"><label>Address</label><input value={form.address} onChange={e => setForm({...form, address: e.target.value})} /></div>
              <div className="form-group"><label>City</label><input value={form.city} onChange={e => setForm({...form, city: e.target.value})} /></div>
              <div className="form-group"><label>State</label><input value={form.state} onChange={e => setForm({...form, state: e.target.value})} /></div>
              <div className="form-group"><label>Country</label><input value={form.country} onChange={e => setForm({...form, country: e.target.value})} /></div>
              <div className="form-group"><label>Zip Code</label><input value={form.zipCode} onChange={e => setForm({...form, zipCode: e.target.value})} /></div>
              <div className="form-group"><label>Principal Investigator</label><input value={form.principalInvestigator} onChange={e => setForm({...form, principalInvestigator: e.target.value})} /></div>
              <div className="form-group"><label>Contact Email</label><input value={form.contactEmail} onChange={e => setForm({...form, contactEmail: e.target.value})} /></div>
              <div className="form-group"><label>Contact Phone</label><input value={form.contactPhone} onChange={e => setForm({...form, contactPhone: e.target.value})} /></div>
              <div className="form-group"><label>Capacity</label><input type="number" value={form.capacity} onChange={e => setForm({...form, capacity: e.target.value})} /></div>
              <div className="form-group"><label>Status</label><select value={form.status} onChange={e => setForm({...form, status: e.target.value})}><option value="active">Active</option><option value="inactive">Inactive</option></select></div>
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
