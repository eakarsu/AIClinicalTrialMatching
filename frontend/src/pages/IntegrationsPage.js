import React, { useState, useEffect } from 'react';
import api from '../services/api';

// Vendor options per system.
const SYSTEMS = {
  EHR: { label: 'EHR (pull patients)', vendors: ['epic', 'cerner'] },
  EDC: { label: 'EDC (push subjects)', vendors: ['medidata'] },
  CTMS: { label: 'CTMS (push trials)', vendors: ['veeva'] },
};

const asList = (d) => (Array.isArray(d) ? d : d?.data || d?.rows || []);

export default function IntegrationsPage() {
  const [ehr, setEhr] = useState([]);
  const [edcCtms, setEdcCtms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [result, setResult] = useState(null);
  const [logs, setLogs] = useState({ id: null, system: null, rows: [] });
  const [form, setForm] = useState({ system: 'EHR', vendor: 'epic', mode: 'sandbox', baseUrl: '' });

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    try {
      const [a, b] = await Promise.all([
        api.get('/ehr-integrations'),
        api.get('/edc-ctms-integrations'),
      ]);
      setEhr(asList(a.data));
      setEdcCtms(asList(b.data));
    } catch (e) { /* ignore */ }
    setLoading(false);
  }

  const all = [...ehr, ...edcCtms];
  const connectedCount = all.filter((i) => i.status === 'connected').length;

  async function handleConnect() {
    try {
      if (form.system === 'EHR') {
        await api.post('/ehr-integrations/connect', {
          vendor: form.vendor, mode: form.mode, baseUrl: form.baseUrl || undefined,
        });
      } else {
        await api.post('/edc-ctms-integrations/connect', {
          system: form.system, vendor: form.vendor, mode: form.mode, baseUrl: form.baseUrl || undefined,
        });
      }
      setResult({ ok: true, text: `Connected ${form.vendor} (${form.system})` });
      loadAll();
    } catch (e) {
      setResult({ ok: false, text: e.response?.data?.error || 'Connect failed' });
    }
  }

  async function handleSync(item) {
    setBusyId(item.id); setResult(null);
    try {
      const isEhr = item.system === 'EHR';
      const url = isEhr ? `/ehr-integrations/${item.id}/sync` : `/edc-ctms-integrations/${item.id}/push`;
      const { data } = await api.post(url);
      const text = isEhr
        ? `Synced ${item.vendor}: pulled ${data.pulled}, created ${data.created}, updated ${data.updated}` +
          (data.autoMatch ? `, ${data.matchesCreated} trial match(es) generated` : '')
        : `Pushed ${data.pushed} record(s) to ${item.vendor} (${item.system})`;
      setResult({ ok: true, text, detail: data });
      loadAll();
    } catch (e) {
      setResult({ ok: false, text: e.response?.data?.error || 'Sync failed' });
    }
    setBusyId(null);
  }

  async function handleLogs(item) {
    const base = item.system === 'EHR' ? '/ehr-integrations' : '/edc-ctms-integrations';
    try {
      const { data } = await api.get(`${base}/${item.id}/logs`);
      setLogs({ id: item.id, system: item.system, rows: asList(data) });
    } catch (e) { /* ignore */ }
  }

  async function handleDisconnect(item) {
    if (!window.confirm(`Disconnect ${item.name}?`)) return;
    const base = item.system === 'EHR' ? '/ehr-integrations' : '/edc-ctms-integrations';
    try { await api.delete(`${base}/${item.id}`); loadAll(); } catch (e) { /* ignore */ }
  }

  const badge = (status) => ({
    padding: '2px 8px', borderRadius: 12, fontSize: 12, fontWeight: 600,
    background: status === 'connected' ? '#dcfce7' : status === 'error' ? '#fee2e2' : '#f1f5f9',
    color: status === 'connected' ? '#166534' : status === 'error' ? '#991b1b' : '#475569',
  });

  if (loading) return <div style={{ padding: 24 }}>Loading integrations…</div>;

  return (
    <div style={{ padding: 24, maxWidth: 1000 }}>
      <h1>🔌 Integrations</h1>
      <p style={{ color: '#64748b' }}>
        Connect EHR, EDC, and CTMS systems to sync patients and trial data.
      </p>
      <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 8, padding: '10px 14px', margin: '12px 0' }}>
        <strong>{connectedCount}</strong> system{connectedCount === 1 ? '' : 's'} connected
      </div>

      {/* Connect form */}
      <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 16, marginBottom: 20 }}>
        <h3 style={{ marginTop: 0 }}>Connect a system</h3>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <label>System<br />
            <select value={form.system} onChange={(e) => {
              const system = e.target.value;
              setForm({ ...form, system, vendor: SYSTEMS[system].vendors[0] });
            }}>
              {Object.entries(SYSTEMS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </label>
          <label>Vendor<br />
            <select value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })}>
              {SYSTEMS[form.system].vendors.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </label>
          <label>Mode<br />
            <select value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })}>
              <option value="sandbox">sandbox</option>
              <option value="live">live</option>
            </select>
          </label>
          {form.mode === 'live' && (
            <label>Base URL<br />
              <input placeholder="https://fhir.example.org" value={form.baseUrl}
                onChange={(e) => setForm({ ...form, baseUrl: e.target.value })} style={{ width: 240 }} />
            </label>
          )}
          <button onClick={handleConnect}>Connect</button>
        </div>
      </div>

      {result && (
        <div style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 16,
          background: result.ok ? '#ecfdf5' : '#fef2f2', color: result.ok ? '#166534' : '#991b1b' }}>
          {result.text}
        </div>
      )}

      {/* Connections */}
      {all.length === 0 && <p style={{ color: '#94a3b8' }}>No connections yet. Connect a system above.</p>}
      <div style={{ display: 'grid', gap: 12 }}>
        {all.map((item) => (
          <div key={`${item.system}-${item.id}`} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong style={{ fontSize: 16 }}>{item.name}</strong>{' '}
                <span style={{ color: '#64748b', fontSize: 13 }}>· {item.system} · {item.vendor} · {item.mode}</span>
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
                  {item.lastSyncAt ? `Last sync: ${new Date(item.lastSyncAt).toLocaleString()}` : 'Never synced'}
                </div>
              </div>
              <span style={badge(item.status)}>{item.status}</span>
            </div>
            <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
              <button disabled={busyId === item.id} onClick={() => handleSync(item)}>
                {busyId === item.id ? 'Working…' : item.system === 'EHR' ? '⤓ Sync patients' : '⤒ Push data'}
              </button>
              <button onClick={() => handleLogs(item)}>Logs</button>
              <button onClick={() => handleDisconnect(item)} style={{ color: '#b91c1c' }}>Disconnect</button>
            </div>

            {logs.id === item.id && logs.system === item.system && (
              <div style={{ marginTop: 12, background: '#f8fafc', borderRadius: 6, padding: 10, fontSize: 13 }}>
                <strong>Audit log</strong>
                {logs.rows.length === 0 ? <div style={{ color: '#94a3b8' }}>No entries.</div> :
                  logs.rows.map((r) => (
                    <div key={r.id} style={{ borderTop: '1px solid #e2e8f0', padding: '4px 0' }}>
                      <code>{r.action}</code> · {new Date(r.createdAt).toLocaleString()}
                      {r.payload && (r.payload.created != null || r.payload.pushed != null) &&
                        <span style={{ color: '#64748b' }}>
                          {' '}— {r.payload.pulled != null ? `pulled ${r.payload.pulled}, created ${r.payload.created}, updated ${r.payload.updated}` : `pushed ${r.payload.pushed}`}
                        </span>}
                    </div>
                  ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
