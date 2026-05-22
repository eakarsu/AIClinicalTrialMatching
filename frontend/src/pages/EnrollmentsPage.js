import React, { useState, useEffect } from 'react';
import api from '../services/api';

export default function EnrollmentsPage() {
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [patients, setPatients] = useState([]);
  const [trials, setTrials] = useState([]);
  const emptyForm = { patientId: '', trialId: '', siteId: '', enrollmentDate: '', status: 'screening', consentDate: '', screeningResult: '', notes: '' };
  const [form, setForm] = useState(emptyForm);

  useEffect(() => { loadData(); }, []);
  const loadData = async () => {
    try {
      const [e, p, t] = await Promise.all([api.get('/enrollments'), api.get('/patients'), api.get('/trials')]);
      setItems(Array.isArray(e.data) ? e.data : (e.data?.items || e.data?.data || e.data?.rows || [])); setPatients(Array.isArray(p.data) ? p.data : (p.data?.items || p.data?.data || p.data?.rows || [])); setTrials(Array.isArray(t.data) ? t.data : (t.data?.items || t.data?.data || t.data?.rows || []));
    } catch(e){} setLoading(false);
  };

  const handleSave = async () => {
    try {
      if (editing) await api.put(`/enrollments/${editing.id}`, form);
      else await api.post('/enrollments', form);
      setShowForm(false); setEditing(null); setForm(emptyForm); loadData();
    } catch(e) { alert(e.response?.data?.error || 'Error'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this enrollment?')) return;
    try { await api.delete(`/enrollments/${id}`); setSelected(null); loadData(); } catch(e) { alert('Error'); }
  };

  const handleEdit = (item) => { setEditing(item); setForm({...item}); setShowForm(true); };

  const getStatusBadge = (status) => {
    const map = { enrolled: 'badge-success', screening: 'badge-info', screen_fail: 'badge-danger', withdrawn: 'badge-warning' };
    return map[status] || 'badge-secondary';
  };

  const filtered = items.filter(e => {
    const pName = e.Patient ? `${e.Patient.firstName} ${e.Patient.lastName}` : '';
    const tName = e.Trial ? e.Trial.title : '';
    return `${pName} ${tName} ${e.status}`.toLowerCase().includes(search.toLowerCase());
  });

  if (loading) return <div className="loading"><div className="loading-spinner"></div>Loading enrollments...</div>;

  if (selected) {
    return (
      <div>
        <button className="back-btn" onClick={() => setSelected(null)}>&larr; Back to Enrollments</button>
        <div className="detail-panel">
          <h2>{'\u{1F4CB}'} Enrollment Details</h2>
          <div className="detail-grid">
            <div className="detail-field"><label>Patient</label><div className="value">{selected.Patient ? `${selected.Patient.firstName} ${selected.Patient.lastName}` : selected.patientId}</div></div>
            <div className="detail-field"><label>Trial</label><div className="value">{selected.Trial ? selected.Trial.title : selected.trialId}</div></div>
            <div className="detail-field"><label>Status</label><div className="value"><span className={`badge ${getStatusBadge(selected.status)}`}>{selected.status}</span></div></div>
            <div className="detail-field"><label>Enrollment Date</label><div className="value">{selected.enrollmentDate}</div></div>
            <div className="detail-field"><label>Consent Date</label><div className="value">{selected.consentDate}</div></div>
            <div className="detail-field"><label>Screening Result</label><div className="value">{selected.screeningResult}</div></div>
          </div>
          <div className="detail-field" style={{marginTop: 16}}><label>Notes</label><div className="value">{selected.notes}</div></div>
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
      <div className="page-header"><h1>Enrollments</h1><div className="header-actions"><button className="btn btn-primary" onClick={() => { setEditing(null); setForm(emptyForm); setShowForm(true); }}>+ New Enrollment</button></div></div>
      <div className="search-bar"><input placeholder="Search enrollments..." value={search} onChange={e => setSearch(e.target.value)} /></div>
      <div className="data-table-container">
        <table className="data-table">
          <thead><tr><th>Patient</th><th>Trial</th><th>Enrollment Date</th><th>Consent Date</th><th>Screening</th><th>Status</th></tr></thead>
          <tbody>
            {filtered.map(e => (
              <tr key={e.id} onClick={() => setSelected(e)}>
                <td><strong>{e.Patient ? `${e.Patient.firstName} ${e.Patient.lastName}` : e.patientId}</strong></td>
                <td style={{maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>{e.Trial ? e.Trial.title : e.trialId}</td>
                <td>{e.enrollmentDate}</td><td>{e.consentDate}</td><td>{e.screeningResult}</td>
                <td><span className={`badge ${getStatusBadge(e.status)}`}>{e.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{editing ? 'Edit Enrollment' : 'New Enrollment'}</h2>
            <div className="form-grid">
              <div className="form-group"><label>Patient</label><select value={form.patientId} onChange={e => setForm({...form, patientId: e.target.value})}><option value="">Select</option>{patients.map(p => <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>)}</select></div>
              <div className="form-group"><label>Trial</label><select value={form.trialId} onChange={e => setForm({...form, trialId: e.target.value})}><option value="">Select</option>{trials.map(t => <option key={t.id} value={t.id}>{t.trialId}</option>)}</select></div>
              <div className="form-group"><label>Enrollment Date</label><input type="date" value={form.enrollmentDate} onChange={e => setForm({...form, enrollmentDate: e.target.value})} /></div>
              <div className="form-group"><label>Consent Date</label><input type="date" value={form.consentDate} onChange={e => setForm({...form, consentDate: e.target.value})} /></div>
              <div className="form-group"><label>Status</label><select value={form.status} onChange={e => setForm({...form, status: e.target.value})}><option value="screening">Screening</option><option value="enrolled">Enrolled</option><option value="screen_fail">Screen Fail</option><option value="withdrawn">Withdrawn</option><option value="completed">Completed</option></select></div>
              <div className="form-group"><label>Screening Result</label><select value={form.screeningResult} onChange={e => setForm({...form, screeningResult: e.target.value})}><option value="">Select</option><option value="pass">Pass</option><option value="fail">Fail</option><option value="pending">Pending</option></select></div>
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
