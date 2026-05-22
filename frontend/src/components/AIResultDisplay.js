import React, { useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';

/* ============================================================
   AIResultDisplay v2 — professional renderer
   - Parses fenced ```json blocks inside `summary` / `raw`
   - Renders priority/severity as badges, confidence as bars
   - Long markdown-ish text as paragraphs/lists
   - Copy / Export / Raw-JSON toggle
   ============================================================ */

function isPlainObject(v) {
  return v && typeof v === 'object' && !Array.isArray(v);
}

// Try hard to coerce a string into structured JSON — even if it's a truncated
// or unterminated fenced block (LLM output frequently gets cut off mid-stream).
function tryParseJSON(str) {
  if (typeof str !== 'string') return null;
  let s = str.trim();
  if (!s) return null;

  // 1) Strip leading ```json or ``` fence (whether or not it's terminated)
  const openFence = s.match(/^```(?:json)?\s*\n?/i);
  if (openFence) s = s.slice(openFence[0].length);
  // strip trailing fence if present
  const closeFence = s.match(/\n?```\s*$/);
  if (closeFence) s = s.slice(0, s.length - closeFence[0].length);
  s = s.trim();

  // 2) Skip preamble — find first { or [
  if (!(s.startsWith('{') || s.startsWith('['))) {
    const first = s.indexOf('{');
    const firstA = s.indexOf('[');
    let cut = -1;
    if (first === -1) cut = firstA;
    else if (firstA === -1) cut = first;
    else cut = Math.min(first, firstA);
    if (cut === -1) return null;
    s = s.slice(cut);
  }

  // 3) Straight parse
  try { return JSON.parse(s); } catch (_) { /* keep trying */ }

  // 4) Trim trailing junk to last } or ]
  const lastBrace = Math.max(s.lastIndexOf('}'), s.lastIndexOf(']'));
  if (lastBrace > 0) {
    try { return JSON.parse(s.slice(0, lastBrace + 1)); } catch (_) { /* keep trying */ }
  }

  // 5) Truncated JSON repair: walk the string respecting strings & escapes,
  //    track brace/bracket depth, then close all open structures.
  const opener = s[0];
  if (opener !== '{' && opener !== '[') return null;
  const stack = [];
  let inStr = false, esc = false, lastValidEnd = -1;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (esc) { esc = false; continue; }
      if (c === '\\') { esc = true; continue; }
      if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') { inStr = true; continue; }
    if (c === '{' || c === '[') { stack.push(c); continue; }
    if (c === '}' || c === ']') {
      stack.pop();
      if (stack.length === 0) lastValidEnd = i;
    }
  }

  // 5a) If we have a clean substring up to lastValidEnd, try that first
  if (lastValidEnd > 0) {
    try { return JSON.parse(s.slice(0, lastValidEnd + 1)); } catch (_) { /* keep trying */ }
  }

  // 5b) Repair attempt: close any open structures, dropping a trailing partial
  //     key/value/string by trimming back to the last clean comma or closer.
  let work = s;
  // close an unterminated string if still inside one
  if (inStr) work += '"';
  // trim a trailing partial token like ': "foo' or ', ' or ': ' or ','
  work = work.replace(/[\s,]*("(?:[^"\\]|\\.)*")?\s*:?\s*("(?:[^"\\]|\\.)*"?|[\d.]+|true|false|null)?\s*$/, (m) => {
    // Don't trim if it would consume a brace/bracket
    if (/[}\]]/.test(m)) return m;
    return '';
  });
  // close remaining open containers
  while (stack.length) {
    const o = stack.pop();
    work += (o === '{' ? '}' : ']');
  }
  try { return JSON.parse(work); } catch (_) { /* give up */ }

  return null;
}

// Detect markdown indicators (headings, bold, lists, tables).
function isMarkdown(str) {
  if (!str || typeof str !== 'string') return false;
  return /(^|\n)#{1,6}\s+\S|\*\*[^*\n]+\*\*|(^|\n)[-*]\s+\S|(^|\n)\d+\.\s+\S|\n\|.*\|/.test(str);
}

// If it looks like markdown, render via ReactMarkdown so headings/bold/tables
// come through. Otherwise fall back to plain paragraphs/bullets.
function renderText(str) {
  if (!str || typeof str !== 'string') return null;
  if (isMarkdown(str)) {
    return (
      <div className="ai-prose ai-markdown">
        <ReactMarkdown>{str}</ReactMarkdown>
      </div>
    );
  }
  const lines = str.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const bullets = lines.filter((l) => /^([-*•]|\d+[.)])\s+/.test(l));
  if (bullets.length >= 2 && bullets.length === lines.length) {
    return (
      <ul className="ai-bullets">
        {lines.map((l, i) => <li key={i}>{l.replace(/^([-*•]|\d+[.)])\s+/, '')}</li>)}
      </ul>
    );
  }
  return (
    <div className="ai-prose">
      {lines.map((l, i) => <p key={i}>{l}</p>)}
    </div>
  );
}

const SEVERITY_COLOR = {
  critical: '#ef4444', high: '#f97316', medium: '#f59e0b', moderate: '#f59e0b',
  low: '#22c55e', informational: '#0ea5e9', info: '#0ea5e9',
  p1: '#ef4444', p2: '#f97316', p3: '#f59e0b', p4: '#22c55e',
  urgent: '#ef4444', immediate: '#ef4444',
};
function severityColor(v) {
  if (v == null) return null;
  const k = String(v).toLowerCase().replace(/[^a-z0-9]/g, '');
  return SEVERITY_COLOR[k] || null;
}

function Badge({ children, color, kind }) {
  const c = color || severityColor(children) || '#64748b';
  return (
    <span
      className={`ai-badge ai-badge-${kind || 'pill'}`}
      style={{ color: c, borderColor: `${c}55`, background: `${c}1a` }}
    >
      {String(children).toUpperCase()}
    </span>
  );
}

function ConfidenceBar({ value }) {
  // accept "0.83", "83", "83%", numbers
  let n = value;
  if (typeof n === 'string') {
    const m = n.match(/([\d.]+)/);
    if (!m) return <span>{value}</span>;
    n = parseFloat(m[1]);
    if (n <= 1) n *= 100;
  }
  if (typeof n !== 'number' || Number.isNaN(n)) return <span>{String(value)}</span>;
  const pct = Math.max(0, Math.min(100, Math.round(n)));
  const color = pct >= 80 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#ef4444';
  return (
    <div className="ai-confbar">
      <div className="ai-confbar-track">
        <div className="ai-confbar-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="ai-confbar-label" style={{ color }}>{pct}%</span>
    </div>
  );
}

const KEYS_PRIORITY = ['priority', 'severity', 'risk', 'risk_level', 'threat_level', 'urgency', 'level', 'phish_score'];
const KEYS_CONF     = ['confidence', 'likelihood', 'probability', 'score'];
const KEYS_TITLE    = ['title','name','alert_title','heading','technique','technique_name','action','objection','label','step','phase'];
const KEYS_ID       = ['id','alert_id','case_id','asset_id','technique_id','cve_id','attack_id','order_id','report_id'];
const KEYS_TAGS     = ['tags','indicators','iocs','ttps','mitre','techniques','keywords','signals','recommended_actions'];
const KEYS_ACTION   = ['recommended_action','action','next_steps','remediation','response','recommendation','mitigation'];
const KEYS_RATIONALE= ['rationale','reasoning','explanation','justification','why','analysis','summary'];

function pickFirst(obj, keys) {
  for (const k of keys) if (obj[k] != null && obj[k] !== '') return { key: k, value: obj[k] };
  return null;
}

function ItemCard({ item, index }) {
  if (!isPlainObject(item)) {
    return (
      <div className="ai-item-card">
        <div className="ai-item-body"><Value v={item} /></div>
      </div>
    );
  }
  const title = pickFirst(item, KEYS_TITLE);
  const id    = pickFirst(item, KEYS_ID);
  const prio  = pickFirst(item, KEYS_PRIORITY);
  const conf  = pickFirst(item, KEYS_CONF);
  const action= pickFirst(item, KEYS_ACTION);
  const ratio = pickFirst(item, KEYS_RATIONALE);

  const consumed = new Set([
    ...(title ? [title.key] : []),
    ...(id ? [id.key] : []),
    ...(prio ? [prio.key] : []),
    ...(conf ? [conf.key] : []),
    ...(action ? [action.key] : []),
    ...(ratio ? [ratio.key] : []),
  ]);

  const accent = severityColor(prio?.value) || '#0ea5e9';

  return (
    <div className="ai-item-card" style={{ borderLeftColor: accent }}>
      <div className="ai-item-head">
        <div className="ai-item-head-left">
          {id && <span className="ai-item-id">{id.value}</span>}
          <span className="ai-item-title">{title?.value || `Item ${index + 1}`}</span>
        </div>
        <div className="ai-item-head-right">
          {prio && <Badge color={accent}>{prio.value}</Badge>}
          {conf && (
            <div className="ai-item-conf">
              <span className="ai-item-conf-label">confidence</span>
              <ConfidenceBar value={conf.value} />
            </div>
          )}
        </div>
      </div>

      <div className="ai-item-body">
        {action && (
          <div className="ai-callout ai-callout-action">
            <span className="ai-callout-label">{action.key.replace(/_/g, ' ')}</span>
            <Value v={action.value} />
          </div>
        )}
        {ratio && (
          <div className="ai-callout ai-callout-rationale">
            <span className="ai-callout-label">{ratio.key.replace(/_/g, ' ')}</span>
            <Value v={ratio.value} />
          </div>
        )}

        {Object.entries(item).map(([k, v]) => {
          if (consumed.has(k)) return null;
          if (v == null || v === '') return null;
          return (
            <div className="ai-kv" key={k}>
              <div className="ai-kv-key">{k.replace(/_/g, ' ')}</div>
              <div className="ai-kv-val"><Value v={v} /></div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Value({ v }) {
  if (v == null || v === '') return <span className="ai-empty">—</span>;
  if (typeof v === 'boolean') return <Badge color={v ? '#22c55e' : '#64748b'}>{v ? 'YES' : 'NO'}</Badge>;
  if (typeof v === 'number') return <span className="ai-num">{v.toLocaleString()}</span>;
  if (typeof v === 'string') {
    // long-form text → paragraphs/bullets
    if (v.length > 80 || v.includes('\n')) return renderText(v);
    return <span className="ai-str">{v}</span>;
  }
  if (Array.isArray(v)) {
    if (v.length === 0) return <span className="ai-empty">empty</span>;
    if (v.every((x) => typeof x === 'string' || typeof x === 'number' || typeof x === 'boolean')) {
      return (
        <div className="ai-tag-list">
          {v.map((x, i) => <span key={i} className="ai-tag">{String(x)}</span>)}
        </div>
      );
    }
    return (
      <div className="ai-item-list">
        {v.map((item, i) => <ItemCard key={i} item={item} index={i} />)}
      </div>
    );
  }
  if (isPlainObject(v)) {
    return (
      <div className="ai-object">
        {Object.entries(v).map(([k, val]) => (
          <div className="ai-kv" key={k}>
            <div className="ai-kv-key">{k.replace(/_/g, ' ')}</div>
            <div className="ai-kv-val"><Value v={val} /></div>
          </div>
        ))}
      </div>
    );
  }
  return <span>{String(v)}</span>;
}

function isEmptyValue(v) {
  if (v == null || v === '') return true;
  if (Array.isArray(v)) return v.length === 0;
  if (isPlainObject(v)) return Object.keys(v).length === 0;
  return false;
}

function normalize(result) {
  // The backend sometimes returns BOTH a fenced ```json``` inside `summary` AND
  // empty default arrays at the top level (e.g. triaged: [], next_steps: []).
  // We must let the PARSED content win over those empty defaults.
  if (!result || typeof result !== 'object') return { sections: {}, leadSummary: null };

  const { summary, raw, error, ...rest } = result;

  let parsed = null;
  let leadSummary = null;

  const fromSummary = tryParseJSON(summary);
  const fromRaw = tryParseJSON(raw);
  if (fromSummary && (isPlainObject(fromSummary) || Array.isArray(fromSummary))) parsed = fromSummary;
  else if (fromRaw && (isPlainObject(fromRaw) || Array.isArray(fromRaw))) parsed = fromRaw;

  // If summary was a clean plain-English string (not JSON), use it as the lead.
  if (!parsed && typeof summary === 'string' && summary.trim()) leadSummary = summary.trim();

  // Drop empty arrays / empty objects from rest so they don't clobber parsed content.
  const restNonEmpty = Object.fromEntries(
    Object.entries(rest).filter(([, v]) => !isEmptyValue(v))
  );

  let sections;
  if (Array.isArray(parsed)) {
    // parsed is an array → promote as `items`, then layer non-empty rest on top
    sections = { items: parsed, ...restNonEmpty };
  } else if (isPlainObject(parsed)) {
    // Promote parsed.summary as the lead if present
    let parsedClone = parsed;
    if (typeof parsed.summary === 'string' && !leadSummary) {
      leadSummary = parsed.summary;
      const { summary: _s, ...rest2 } = parsed;
      parsedClone = rest2;
    }
    // PARSED CONTENT WINS — rest only fills gaps it didn't cover
    sections = { ...restNonEmpty, ...parsedClone };
    // Drop any leftover empty values from the merged result
    sections = Object.fromEntries(
      Object.entries(sections).filter(([, v]) => !isEmptyValue(v))
    );
  } else {
    sections = restNonEmpty;
  }

  return { sections, leadSummary, error, raw: raw || (parsed ? null : summary) };
}

function AIResultDisplay({ result, loading, error }) {
  const [showRaw, setShowRaw] = useState(false);
  const [copied, setCopied] = useState(false);

  const normalized = useMemo(() => (result ? normalize(result) : null), [result]);

  if (loading) {
    return (
      <div className="ai-panel">
        <div className="ai-panel-header"><h4>AI Copilot</h4></div>
        <div className="ai-loading">
          <div className="spinner" />
          <p>Calling AI — this can take a few seconds…</p>
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="ai-panel">
        <div className="ai-panel-header"><h4>AI Copilot</h4></div>
        <div className="ai-panel-body"><div className="ai-error">{error}</div></div>
      </div>
    );
  }
  if (!result) return null;

  const { sections, leadSummary, error: aiError, raw } = normalized;
  const sectionEntries = Object.entries(sections).filter(([, v]) => v != null && v !== '');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(result, null, 2));
      setCopied(true); setTimeout(() => setCopied(false), 1400);
    } catch (_) { /* noop */ }
  };
  const download = () => {
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `ai-result-${Date.now()}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="ai-panel">
      <div className="ai-panel-header">
        <h4>AI Copilot Result</h4>
        <div className="ai-panel-actions">
          <button className="ai-tool-btn" onClick={copy} title="Copy JSON">{copied ? '✓ Copied' : '⧉ Copy'}</button>
          <button className="ai-tool-btn" onClick={download} title="Download JSON">↓ Export</button>
          <button className="ai-tool-btn" onClick={() => setShowRaw((s) => !s)} title="Show raw JSON">
            {showRaw ? '⌃ Hide raw' : '⌄ Raw'}
          </button>
        </div>
      </div>

      <div className="ai-panel-body">
        {aiError && <div className="ai-error" style={{ marginBottom: 14 }}>{aiError}</div>}

        {leadSummary && (
          <div className="ai-lead">
            <span className="ai-lead-eyebrow">EXECUTIVE SUMMARY</span>
            {renderText(leadSummary)}
          </div>
        )}

        {sectionEntries.map(([k, v]) => (
          <div className="ai-section" key={k}>
            <div className="ai-section-title">{k.replace(/_/g, ' ')}</div>
            <Value v={v} />
          </div>
        ))}

        {showRaw && (
          <div className="ai-section">
            <div className="ai-section-title">raw payload</div>
            <pre className="ai-raw-pre">{JSON.stringify(result, null, 2)}</pre>
          </div>
        )}

        {!sectionEntries.length && !leadSummary && !aiError && raw && (
          <pre className="ai-raw-pre">{String(raw).slice(0, 2000)}</pre>
        )}
      </div>
    </div>
  );
}

export default AIResultDisplay;
