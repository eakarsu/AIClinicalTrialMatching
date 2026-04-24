import React, { useState, useEffect } from 'react';
import api from '../services/api';

export default function NotificationsPage() {
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const emptyForm = { title: '', message: '', type: '', priority: 'normal', isRead: false, category: '' };
  const [form, setForm] = useState(emptyForm);

  useEffect(() => { loadData(); }, []);
  const loadData = async () => { try { const res = await api.get('/notifications'); setItems(res.data); } catch(e){} setLoading(false); };

  const handleSave = async () => {
    try {
      if (editing) await api.put(`/notifications/${editing.id}`, form);
      else await api.post('/notifications', form);
      setShowForm(false); setEditing(null); setForm(emptyForm); loadData();
    } catch(e) { alert(e.response?.data?.error || 'Error'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this notification?')) return;
    try { await api.delete(`/notifications/${id}`); setSelected(null); loadData(); } catch(e) { alert('Error'); }
  };

  const handleEdit = (item) => { setEditing(item); setForm({...item}); setShowForm(true); };

  const markRead = async (item) => {
    try { await api.put(`/notifications/${item.id}`, { ...item, isRead: true }); loadData(); } catch(e) {}
  };

  const getPriorityBadge = (p) => {
    if (p === 'urgent') return 'badge-danger';
    if (p === 'high') return 'badge-warning';
    return 'badge-info';
  };

  const filtered = items.filter(n => `${n.title} ${n.message} ${n.category}`.toLowerCase().includes(search.toLowerCase()));

  if (loading) return <div className="loading"><div className="loading-spinner"></div>Loading...</div>;

  if (selected) {
    return (
      <div>
        <button className="back-btn" onClick={() => setSelected(null)}>&larr; Back</button>
        <div className="detail-panel">
          <h2>{'\u{1F514}'} {selected.title}</h2>
          <div className="detail-grid">
            <div className="detail-field"><label>Type</label><div className="value">{selected.type}</div></div>
            <div className="detail-field"><label>Priority</label><div className="value"><span className={`badge ${getPriorityBadge(selected.priority)}`}>{selected.priority}</span></div></div>
            <div className="detail-field"><label>Category</label><div className="value">{selected.category}</div></div>
            <div className="detail-field"><label>Read</label><div className="value">{selected.isRead ? 'Yes' : 'No'}</div></div>
            <div className="detail-field"><label>Created</label><div className="value">{new Date(selected.createdAt).toLocaleString()}</div></div>
          </div>
          <div className="detail-field" style={{marginTop: 16}}><label>Message</label><div className="value">{selected.message}</div></div>
          <div className="detail-actions">
            {!selected.isRead && <button className="btn btn-success" onClick={() => { markRead(selected); setSelected({...selected, isRead: true}); }}>Mark as Read</button>}
            <button className="btn btn-warning" onClick={() => handleEdit(selected)}>Edit</button>
            <button className="btn btn-danger" onClick={() => handleDelete(selected.id)}>Delete</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header"><h1>Notifications</h1><div className="header-actions"><button className="btn btn-primary" onClick={() => { setEditing(null); setForm(emptyForm); setShowForm(true); }}>+ New Notification</button></div></div>
      <div className="search-bar"><input placeholder="Search notifications..." value={search} onChange={e => setSearch(e.target.value)} /></div>
      <div className="data-table-container">
        <table className="data-table">
          <thead><tr><th>Title</th><th>Type</th><th>Priority</th><th>Category</th><th>Read</th><th>Date</th></tr></thead>
          <tbody>
            {filtered.map(n => (
              <tr key={n.id} onClick={() => setSelected(n)} style={{background: n.isRead ? 'transparent' : '#f8f0ff'}}>
                <td><strong>{n.title}</strong></td><td>{n.type}</td>
                <td><span className={`badge ${getPriorityBadge(n.priority)}`}>{n.priority}</span></td>
                <td>{n.category}</td>
                <td>{n.isRead ? 'Yes' : 'No'}</td>
                <td>{new Date(n.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{editing ? 'Edit Notification' : 'New Notification'}</h2>
            <div className="form-grid">
              <div className="form-group full-width"><label>Title</label><input value={form.title} onChange={e => setForm({...form, title: e.target.value})} /></div>
              <div className="form-group"><label>Type</label><input value={form.type} onChange={e => setForm({...form, type: e.target.value})} /></div>
              <div className="form-group"><label>Priority</label><select value={form.priority} onChange={e => setForm({...form, priority: e.target.value})}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select></div>
              <div className="form-group"><label>Category</label><input value={form.category} onChange={e => setForm({...form, category: e.target.value})} /></div>
              <div className="form-group full-width"><label>Message</label><textarea value={form.message} onChange={e => setForm({...form, message: e.target.value})} /></div>
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
