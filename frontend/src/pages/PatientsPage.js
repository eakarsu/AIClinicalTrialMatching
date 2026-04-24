import React, { useState, useEffect } from 'react';
import api from '../services/api';
import ReactMarkdown from 'react-markdown';

export default function PatientsPage() {
  const [patients, setPatients] = useState([]);
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [aiResult, setAiResult] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [form, setForm] = useState({ firstName: '', lastName: '', dateOfBirth: '', gender: '', email: '', phone: '', diagnosis: '', stage: '', biomarkers: '', medicalHistory: '', currentMedications: '', status: 'active' });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const res = await api.get('/patients');
      setPatients(res.data);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const handleSave = async () => {
    try {
      if (editing) {
        await api.put(`/patients/${editing.id}`, form);
      } else {
        await api.post('/patients', form);
      }
      setShowForm(false);
      setEditing(null);
      setForm({ firstName: '', lastName: '', dateOfBirth: '', gender: '', email: '', phone: '', diagnosis: '', stage: '', biomarkers: '', medicalHistory: '', currentMedications: '', status: 'active' });
      loadData();
    } catch (err) { alert(err.response?.data?.error || 'Error saving'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this patient?')) return;
    try {
      await api.delete(`/patients/${id}`);
      setSelected(null);
      loadData();
    } catch (err) { alert('Error deleting'); }
  };

  const handleEdit = (patient) => {
    setEditing(patient);
    setForm({ ...patient });
    setShowForm(true);
  };

  const handleAIMatch = async (patientId) => {
    setAiLoading(true);
    setAiResult(null);
    try {
      const res = await api.post('/ai/match-patient', { patientId });
      setAiResult(res.data);
    } catch (err) { setAiResult({ analysis: 'Error: ' + (err.response?.data?.error || err.message) }); }
    setAiLoading(false);
  };

  const filtered = patients.filter(p =>
    `${p.firstName} ${p.lastName} ${p.diagnosis}`.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div className="loading"><div className="loading-spinner"></div>Loading patients...</div>;

  if (selected) {
    return (
      <div>
        <button className="back-btn" onClick={() => { setSelected(null); setAiResult(null); }}>&#8592; Back to Patients</button>
        <div className="detail-panel">
          <h2>{'\u{1F9D1}\u200D\u2695\uFE0F'} {selected.firstName} {selected.lastName}</h2>
          <div className="detail-grid">
            <div className="detail-field"><label>Date of Birth</label><div className="value">{selected.dateOfBirth}</div></div>
            <div className="detail-field"><label>Gender</label><div className="value">{selected.gender}</div></div>
            <div className="detail-field"><label>Email</label><div className="value">{selected.email}</div></div>
            <div className="detail-field"><label>Phone</label><div className="value">{selected.phone}</div></div>
            <div className="detail-field"><label>Diagnosis</label><div className="value">{selected.diagnosis}</div></div>
            <div className="detail-field"><label>Stage</label><div className="value">{selected.stage}</div></div>
            <div className="detail-field"><label>Status</label><div className="value"><span className={`badge ${selected.status === 'active' ? 'badge-success' : 'badge-secondary'}`}>{selected.status}</span></div></div>
            <div className="detail-field"><label>Biomarkers</label><div className="value">{selected.biomarkers}</div></div>
            <div className="detail-field"><label>Medical History</label><div className="value">{selected.medicalHistory}</div></div>
            <div className="detail-field"><label>Current Medications</label><div className="value">{selected.currentMedications}</div></div>
          </div>
          <div className="detail-actions">
            <button className="btn btn-primary" onClick={() => handleAIMatch(selected.id)}>AI Trial Matching</button>
            <button className="btn btn-warning" onClick={() => handleEdit(selected)}>Edit</button>
            <button className="btn btn-danger" onClick={() => handleDelete(selected.id)}>Delete</button>
          </div>
        </div>
        {aiLoading && <div className="ai-loading"><div className="pulse"></div><p>AI is analyzing patient data...</p></div>}
        {aiResult && (
          <div className="ai-output">
            <div className="ai-output-header">
              <span className="ai-badge">AI ANALYSIS</span>
              <span className="model-info">Model: {aiResult.model || 'Claude Haiku'} | Trials Analyzed: {aiResult.trialsAnalyzed || 'N/A'}</span>
            </div>
            <div className="ai-output-body"><ReactMarkdown>{aiResult.analysis}</ReactMarkdown></div>
            {aiResult.usage && (
              <div className="ai-output-footer">
                <span>Tokens: {aiResult.usage.total_tokens}</span>
                <span>Prompt: {aiResult.usage.prompt_tokens}</span>
                <span>Response: {aiResult.usage.completion_tokens}</span>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h1>Patients</h1>
        <div className="header-actions">
          <button className="btn btn-primary" onClick={() => { setEditing(null); setForm({ firstName: '', lastName: '', dateOfBirth: '', gender: '', email: '', phone: '', diagnosis: '', stage: '', biomarkers: '', medicalHistory: '', currentMedications: '', status: 'active' }); setShowForm(true); }}>+ New Patient</button>
        </div>
      </div>
      <div className="search-bar">
        <input placeholder="Search patients by name or diagnosis..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <div className="data-table-container">
        <table className="data-table">
          <thead>
            <tr><th>Name</th><th>Diagnosis</th><th>Stage</th><th>Gender</th><th>Biomarkers</th><th>Status</th></tr>
          </thead>
          <tbody>
            {filtered.map(p => (
              <tr key={p.id} onClick={() => setSelected(p)}>
                <td><strong>{p.firstName} {p.lastName}</strong></td>
                <td>{p.diagnosis}</td>
                <td>{p.stage}</td>
                <td>{p.gender}</td>
                <td style={{maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>{p.biomarkers}</td>
                <td><span className={`badge ${p.status === 'active' ? 'badge-success' : 'badge-secondary'}`}>{p.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="empty-state"><div className="empty-icon">{'\u{1F9D1}\u200D\u2695\uFE0F'}</div><h3>No patients found</h3></div>}
      </div>
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{editing ? 'Edit Patient' : 'New Patient'}</h2>
            <div className="form-grid">
              <div className="form-group"><label>First Name</label><input value={form.firstName} onChange={e => setForm({...form, firstName: e.target.value})} /></div>
              <div className="form-group"><label>Last Name</label><input value={form.lastName} onChange={e => setForm({...form, lastName: e.target.value})} /></div>
              <div className="form-group"><label>Date of Birth</label><input type="date" value={form.dateOfBirth} onChange={e => setForm({...form, dateOfBirth: e.target.value})} /></div>
              <div className="form-group"><label>Gender</label><select value={form.gender} onChange={e => setForm({...form, gender: e.target.value})}><option value="">Select</option><option>Male</option><option>Female</option><option>Other</option></select></div>
              <div className="form-group"><label>Email</label><input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} /></div>
              <div className="form-group"><label>Phone</label><input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} /></div>
              <div className="form-group full-width"><label>Diagnosis</label><input value={form.diagnosis} onChange={e => setForm({...form, diagnosis: e.target.value})} /></div>
              <div className="form-group"><label>Stage</label><input value={form.stage} onChange={e => setForm({...form, stage: e.target.value})} /></div>
              <div className="form-group"><label>Status</label><select value={form.status} onChange={e => setForm({...form, status: e.target.value})}><option value="active">Active</option><option value="inactive">Inactive</option></select></div>
              <div className="form-group full-width"><label>Biomarkers</label><textarea value={form.biomarkers} onChange={e => setForm({...form, biomarkers: e.target.value})} /></div>
              <div className="form-group full-width"><label>Medical History</label><textarea value={form.medicalHistory} onChange={e => setForm({...form, medicalHistory: e.target.value})} /></div>
              <div className="form-group full-width"><label>Current Medications</label><textarea value={form.currentMedications} onChange={e => setForm({...form, currentMedications: e.target.value})} /></div>
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
