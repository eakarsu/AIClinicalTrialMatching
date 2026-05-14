import React, { useState, useEffect } from 'react';
import api from '../services/api';

export default function WebhooksPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', url: '', events: '', active: true });
  const [testResult, setTestResult] = useState(null);
  const [error, setError] = useState('');

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/webhooks');
      const data = res.data;
      setItems(Array.isArray(data) ? data : (data.webhooks || data.items || []));
    } catch (e) { setError('Failed to fetch webhooks'); }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const handleSave = async () => {
    const body = { ...form, events: form.events.split(',').map(s => s.trim()).filter(Boolean) };
    try {
      await api.post('/webhooks', body);
      setShowForm(false);
      setForm({ name: '', url: '', events: '', active: true });
      loadData();
    } catch (e) { setError(e.response?.data?.error || 'Error'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this webhook?')) return;
    try { await api.delete(`/webhooks/${id}`); loadData(); } catch (e) { setError('Error'); }
  };

  const testDeliver = async (id) => {
    setTestResult(null);
    try {
      const res = await api.post(`/webhooks/${id}/test`, { event: 'test', payload: { hello: 'world' } });
      setTestResult({ id, ok: true, data: res.data });
    } catch (e) { setTestResult({ id, ok: false, data: e.response?.data || { error: e.message } }); }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>Webhooks</h1>
        <button className="btn btn-primary" onClick={() => setShowForm(s => !s)}>
          {showForm ? 'Cancel' : '+ New Webhook'}
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {showForm && (
        <div className="card" style={{ padding: 24, marginBottom: 16, maxWidth: 600 }}>
          <div className="form-group">
            <label>Name</label>
            <input className="form-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="form-group">
            <label>URL</label>
            <input className="form-input" value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} placeholder="https://..." />
          </div>
          <div className="form-group">
            <label>Events (comma-separated)</label>
            <input className="form-input" value={form.events} onChange={e => setForm({ ...form, events: e.target.value })} placeholder="enrollment.created" />
          </div>
          <div className="form-group">
            <label><input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} /> Active</label>
          </div>
          <button className="btn btn-primary" onClick={handleSave}>Save</button>
        </div>
      )}

      {testResult && (
        <div className="card" style={{ padding: 12, marginBottom: 12 }}>
          <strong>Test #{testResult.id}: {testResult.ok ? 'OK' : 'Failed'}</strong>
          <pre style={{ overflow: 'auto', fontSize: 12 }}>{JSON.stringify(testResult.data, null, 2)}</pre>
        </div>
      )}

      {loading ? <div>Loading...</div> : (
        <div className="card">
          <table className="data-table">
            <thead><tr><th>Name</th><th>URL</th><th>Events</th><th>Active</th><th></th></tr></thead>
            <tbody>
              {items.map(w => (
                <tr key={w.id}>
                  <td><strong>{w.name}</strong></td>
                  <td style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.url}</td>
                  <td>{(w.events || []).join(', ')}</td>
                  <td>{w.active ? 'yes' : 'no'}</td>
                  <td>
                    <button className="btn btn-sm" onClick={() => testDeliver(w.id)}>Test</button>{' '}
                    <button className="btn btn-sm btn-danger" onClick={() => handleDelete(w.id)}>Delete</button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', padding: 24 }}>No webhooks</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
