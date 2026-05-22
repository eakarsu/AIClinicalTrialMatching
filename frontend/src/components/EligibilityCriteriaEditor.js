// NON-VIZ — Eligibility Criteria Editor (CRUD)
// Talks to /api/custom-views/eligibility-criteria[/:id]
// Supports list / create / update / delete with inline editing.
import React, { useEffect, useState } from 'react';
import api from '../services/api';

const C = {
  panel: '#111827',
  text: '#e5e7eb',
  sub: '#9ca3af',
  border: '#1f2937',
  accent: '#10b981',
  bad: '#ef4444',
  good: '#34d399',
};

const PRIORITIES = ['required', 'preferred', 'optional'];
const CATEGORIES = ['Age', 'Diagnosis', 'Biomarker', 'Lab Value', 'Performance Status', 'Prior Therapy', 'General'];

const EMPTY = {
  trialId: '',
  description: '',
  isInclusion: true,
  category: 'General',
  priority: 'required',
  ageMin: '',
  ageMax: '',
  gender: '',
  biomarkerRequirement: '',
};

export default function EligibilityCriteriaEditor() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(true);
  const [draft, setDraft] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState({});
  const [filterTrialId, setFilterTrialId] = useState('');
  const [flash, setFlash] = useState('');

  const reload = (trialId) => {
    setBusy(true);
    setErr('');
    const q = trialId ? `?trialId=${trialId}` : '';
    api
      .get(`/custom-views/eligibility-criteria${q}`)
      .then((r) => setData(r.data))
      .catch((e) => setErr(e?.response?.data?.error || e.message))
      .finally(() => setBusy(false));
  };

  useEffect(() => {
    reload();
  }, []);

  const flashMsg = (m) => {
    setFlash(m);
    setTimeout(() => setFlash(''), 2200);
  };

  const create = async () => {
    try {
      const payload = { ...draft };
      if (payload.trialId === '') payload.trialId = null;
      else payload.trialId = Number(payload.trialId);
      if (payload.ageMin === '') payload.ageMin = null;
      if (payload.ageMax === '') payload.ageMax = null;
      const r = await api.post('/custom-views/eligibility-criteria', payload);
      flashMsg(`Created criterion #${r.data.criterion.id} (${r.data.criterion.source || 'db'})`);
      setDraft(EMPTY);
      reload(filterTrialId || null);
    } catch (e) {
      setErr(e?.response?.data?.error || e.message);
    }
  };

  const startEdit = (c) => {
    setEditingId(c.id);
    setEditDraft({
      description: c.description || '',
      isInclusion: !!c.isInclusion,
      category: c.category || 'General',
      priority: c.priority || 'required',
    });
  };

  const saveEdit = async (id) => {
    try {
      const r = await api.put(`/custom-views/eligibility-criteria/${id}`, editDraft);
      flashMsg(`Updated #${id} (${r.data.criterion.source || 'db'})`);
      setEditingId(null);
      reload(filterTrialId || null);
    } catch (e) {
      setErr(e?.response?.data?.error || e.message);
    }
  };

  const remove = async (id) => {
    try {
      await api.delete(`/custom-views/eligibility-criteria/${id}`);
      flashMsg(`Deleted #${id}`);
      reload(filterTrialId || null);
    } catch (e) {
      setErr(e?.response?.data?.error || e.message);
    }
  };

  if (busy && !data) return <div style={{ color: C.sub, padding: 16 }}>Loading eligibility criteria…</div>;
  if (err && !data) return <div style={{ color: C.bad, padding: 16 }}>Error: {err}</div>;
  if (!data) return null;

  return (
    <div
      data-testid="eligibility-criteria-editor"
      style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 16, color: C.text }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
        <h3 style={{ margin: 0 }}>Eligibility Criteria Editor (CRUD)</h3>
        <div style={{ color: C.sub, fontSize: 12 }}>
          {data.count} total ({data.dbCount} DB + {data.memCount} in-memory)
        </div>
      </div>

      {flash && (
        <div
          style={{
            background: '#064e3b',
            color: C.good,
            padding: '6px 10px',
            borderRadius: 4,
            fontSize: 12,
            marginBottom: 10,
          }}
        >
          {flash}
        </div>
      )}
      {err && (
        <div
          style={{
            background: '#7f1d1d',
            color: '#fecaca',
            padding: '6px 10px',
            borderRadius: 4,
            fontSize: 12,
            marginBottom: 10,
          }}
        >
          {err}
        </div>
      )}

      {/* Filter */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
        <span style={{ color: C.sub, fontSize: 12 }}>Filter by trial:</span>
        <select
          data-testid="trial-filter"
          value={filterTrialId}
          onChange={(e) => {
            setFilterTrialId(e.target.value);
            reload(e.target.value || null);
          }}
          style={{ background: '#0b1220', color: C.text, border: `1px solid ${C.border}`, padding: '4px 8px', borderRadius: 4 }}
        >
          <option value="">All trials</option>
          {(data.trials || []).map((t) => (
            <option key={t.id} value={t.id}>
              T{t.id} — {t.title || `Trial ${t.id}`}
            </option>
          ))}
        </select>
      </div>

      {/* Create form */}
      <div
        style={{
          background: '#0b1220',
          border: `1px solid ${C.border}`,
          borderRadius: 6,
          padding: 12,
          marginBottom: 12,
        }}
      >
        <div style={{ fontSize: 13, color: C.sub, marginBottom: 8 }}>Add new criterion</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 8 }}>
          <input
            data-testid="new-trialId"
            placeholder="Trial ID"
            value={draft.trialId}
            onChange={(e) => setDraft({ ...draft, trialId: e.target.value })}
            style={inputStyle}
          />
          <select
            data-testid="new-category"
            value={draft.category}
            onChange={(e) => setDraft({ ...draft, category: e.target.value })}
            style={inputStyle}
          >
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <select
            data-testid="new-priority"
            value={draft.priority}
            onChange={(e) => setDraft({ ...draft, priority: e.target.value })}
            style={inputStyle}
          >
            {PRIORITIES.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
          <select
            data-testid="new-isInclusion"
            value={draft.isInclusion ? 'inclusion' : 'exclusion'}
            onChange={(e) => setDraft({ ...draft, isInclusion: e.target.value === 'inclusion' })}
            style={inputStyle}
          >
            <option value="inclusion">Inclusion</option>
            <option value="exclusion">Exclusion</option>
          </select>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            data-testid="new-description"
            placeholder="Criterion description (e.g. Age 18-75 with confirmed Dx)"
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            style={{ ...inputStyle, flex: 1 }}
          />
          <button
            data-testid="create-criterion-btn"
            onClick={create}
            disabled={!draft.description.trim()}
            style={{
              background: C.accent,
              color: '#0b1220',
              border: 'none',
              padding: '8px 16px',
              borderRadius: 4,
              fontWeight: 600,
              cursor: draft.description.trim() ? 'pointer' : 'not-allowed',
              opacity: draft.description.trim() ? 1 : 0.5,
            }}
          >
            + Create
          </button>
        </div>
      </div>

      {/* Table */}
      <div
        style={{
          background: '#0b1220',
          border: `1px solid ${C.border}`,
          borderRadius: 6,
          padding: 6,
          maxHeight: 420,
          overflowY: 'auto',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '60px 70px 110px 100px 100px 1fr 150px',
            gap: 6,
            padding: '6px 8px',
            color: C.sub,
            fontSize: 11,
            borderBottom: `1px solid ${C.border}`,
          }}
        >
          <div>ID</div>
          <div>Trial</div>
          <div>Type</div>
          <div>Priority</div>
          <div>Category</div>
          <div>Description</div>
          <div>Actions</div>
        </div>
        {data.criteria.map((c) => {
          const editing = editingId === c.id;
          return (
            <div
              key={c.id}
              data-testid={`criterion-row-${c.id}`}
              style={{
                display: 'grid',
                gridTemplateColumns: '60px 70px 110px 100px 100px 1fr 150px',
                gap: 6,
                padding: '6px 8px',
                fontSize: 12,
                borderBottom: `1px solid ${C.border}`,
                alignItems: 'center',
              }}
            >
              <div style={{ color: C.sub }}>#{c.id}</div>
              <div>T{c.trialId ?? '—'}</div>
              {editing ? (
                <select
                  value={editDraft.isInclusion ? 'inclusion' : 'exclusion'}
                  onChange={(e) => setEditDraft({ ...editDraft, isInclusion: e.target.value === 'inclusion' })}
                  style={inputStyle}
                >
                  <option value="inclusion">Inclusion</option>
                  <option value="exclusion">Exclusion</option>
                </select>
              ) : (
                <div style={{ color: c.isInclusion ? C.good : '#fbbf24' }}>
                  {c.isInclusion ? 'Inclusion' : 'Exclusion'}
                </div>
              )}
              {editing ? (
                <select
                  value={editDraft.priority}
                  onChange={(e) => setEditDraft({ ...editDraft, priority: e.target.value })}
                  style={inputStyle}
                >
                  {PRIORITIES.map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              ) : (
                <div>{c.priority || 'required'}</div>
              )}
              {editing ? (
                <select
                  value={editDraft.category}
                  onChange={(e) => setEditDraft({ ...editDraft, category: e.target.value })}
                  style={inputStyle}
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat}>{cat}</option>
                  ))}
                </select>
              ) : (
                <div style={{ color: C.sub }}>{c.category || '—'}</div>
              )}
              {editing ? (
                <input
                  value={editDraft.description}
                  onChange={(e) => setEditDraft({ ...editDraft, description: e.target.value })}
                  style={inputStyle}
                />
              ) : (
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.description}
                </div>
              )}
              <div style={{ display: 'flex', gap: 4 }}>
                {editing ? (
                  <>
                    <button
                      data-testid={`save-${c.id}`}
                      onClick={() => saveEdit(c.id)}
                      style={btnStyle(C.accent)}
                    >
                      Save
                    </button>
                    <button onClick={() => setEditingId(null)} style={btnStyle('#374151')}>
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      data-testid={`edit-${c.id}`}
                      onClick={() => startEdit(c)}
                      style={btnStyle('#0ea5e9')}
                    >
                      Edit
                    </button>
                    <button
                      data-testid={`delete-${c.id}`}
                      onClick={() => remove(c.id)}
                      style={btnStyle(C.bad)}
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
        {!data.criteria.length && (
          <div style={{ padding: 24, color: C.sub, textAlign: 'center' }}>No criteria yet — add one above.</div>
        )}
      </div>
    </div>
  );
}

const inputStyle = {
  background: '#020617',
  color: '#e5e7eb',
  border: '1px solid #1f2937',
  padding: '6px 8px',
  borderRadius: 4,
  fontSize: 12,
  width: '100%',
  boxSizing: 'border-box',
};

const btnStyle = (bg) => ({
  background: bg,
  color: '#0b1220',
  border: 'none',
  padding: '4px 10px',
  borderRadius: 4,
  fontSize: 11,
  fontWeight: 600,
  cursor: 'pointer',
});
