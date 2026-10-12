import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';

export const COMPLETE_EXAMPLE_LABELS = ['Demo AI · Quick review', 'Demo AI · Team planning', 'Demo AI · Detailed review'];
const human = value => String(value || '').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]/g, ' ');
const reference = key => /(?:^|_)(?:id|ids)$/i.test(key) || /[a-z](?:Id|Ids)(?:[A-Z]\w*|$)/.test(key) || /^(?:patient|client|case|document|device|selectedRecord|crewMember|serial_number|license_number|vin)$/i.test(key);
const evidence = key => /file|upload|image|photo|audio|video|recording|transcript|(?:^|_)(?:url|uri)(?:_|$)/i.test(key);
const clinical = key => /^(?:conditions|medsText)$/i.test(key) || /(?:patient.*(?:age|name|gender|acuity)|(?:^|_)(?:age|diagnosis|symptoms|allergies|medications|meds_text|demographics|social_determinants|witnessed|medical_history|chief_complaint|call_description|additional_symptoms|symptoms_description|current_medications|exam_findings|objective|subjective|vital_signs|vitals|blood_pressure|heart_rate|temperature|weight|height|oxygen_saturation|bp|hr|rr|spo2|interventions|treatments_given|procedures|transport_disposition|receiving_facility|outcome|crew_feedback|bystander_cpr|initial_rhythm|time_to_cpr|time_to_defib)(?:_|$))/i.test(human(key).toLowerCase().replace(/\W+/g, '_'));
const labelFor = element => Array.from(element.labels || []).map(label => label.textContent.trim()).join(' ') || element.closest('label')?.textContent.trim() || element.parentElement?.querySelector('label')?.textContent.trim() || element.placeholder || human(element.dataset.aiField || element.name || element.id);
const keyFor = element => element.dataset.aiField || element.name || element.id || human(labelFor(element)).toLowerCase().replace(/\W+/g, '_');
const substantive = value => typeof value === 'string' && value.trim().length > 0;
const parse = value => { try { return JSON.parse(value); } catch { return undefined; } };
const nestedSource = value => value && typeof value === 'object' && Object.entries(value).some(([key, item]) => reference(key) || evidence(key) || clinical(key) || acknowledged(key) || nestedSource(item));
const acknowledged = key => /consent|approve|approval|publish|execute|notify|send|permission|acknowledg|attest|authorize|allow.*action/i.test(key);
const eligible = element => !element.disabled && !element.readOnly && !element.hasAttribute('data-ai-exclude') && !element.closest('[hidden], [aria-hidden="true"]') && !['hidden', 'submit', 'button', 'reset', 'password'].includes(element.type);

function assign(element, value) {
  if (element.type === 'checkbox' || element.type === 'radio') {
    if (element.checked !== value) flushSync(() => element.click());
    return;
  }
  const prototype = element.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : element.tagName === 'SELECT' ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype;
  flushSync(() => {
    const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
    if (setter) setter.call(element, String(value)); else element.value = String(value);
    element.dispatchEvent(new Event(element.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
    if (element.tagName !== 'SELECT') element.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

function nativeNumber(element, supplied) {
  const minimum = element.min !== '' ? Number(element.min) : -Infinity;
  const maximum = element.max !== '' ? Number(element.max) : Infinity;
  const step = element.step && element.step !== 'any' ? Number(element.step) : element.step === 'any' ? NaN : 1;
  let value = Math.max(minimum, Math.min(maximum, Number(supplied)));
  if (Number.isFinite(step) && step > 0) {
    const base = Number.isFinite(minimum) ? minimum : 0;
    const lower = Number.isFinite(minimum) ? Math.ceil((minimum - base) / step - 1e-10) : -Infinity;
    const upper = Number.isFinite(maximum) ? Math.floor((maximum - base) / step + 1e-10) : Infinity;
    const index = Math.max(lower, Math.min(upper, Math.round((value - base) / step)));
    value = Number((base + index * step).toPrecision(14));
  }
  return value;
}

function numberExample(element, key, variant) {
  const hint = Number(element.placeholder);
  const base = substantive(element.placeholder) && Number.isFinite(hint) ? hint : /days|horizon|window|period/i.test(key) ? 30 : /budget|price|cost|revenue|income|balance/i.test(key) ? 100 : /count|num|limit|quantity|runs|sites/i.test(key) ? 3 : /year/i.test(key) ? 2026 : 1;
  return nativeNumber(element, base * [1, 1.5, 2][variant]);
}

export function fillDisplayedExample(scope, variant = 0, context = '', values = {}) {
  let filled = 0;
  const manual = [];
  // Scope switches can reveal or enable further optional inputs. Update them
  // first, let React render, then collect the actual active form fields.
  for (const element of scope.querySelectorAll('input[type="checkbox"]')) {
    if (eligible(element) && !reference(keyFor(element)) && !acknowledged(keyFor(element)) && !clinical(keyFor(element)) && !element.hasAttribute('data-ai-manual')) {
      assign(element, Object.prototype.hasOwnProperty.call(values, keyFor(element)) ? Boolean(values[keyFor(element)]) : [false, true, false][variant]);
    }
  }
  for (const element of scope.querySelectorAll('input, textarea, select')) {
    if (!eligible(element)) continue;
    const key = keyFor(element), label = labelFor(element) || human(key);
    const options = element.tagName === 'SELECT' ? Array.from(element.options).filter(option => option.value !== '' && !option.disabled && !option.hidden) : [];
    if (element.type === 'file' || evidence(key) || /informed_consent_text/i.test(key) || element.hasAttribute('data-ai-manual') || (clinical(key) && /ems|clinical|patient|medical|health|pharmac|optometr|therapy|hospice|shelter/i.test(context) && !Object.prototype.hasOwnProperty.call(values, key))) {
      manual.push(`${label}${substantive(element.value) ? ' (reviewed value preserved)' : ' (requires documented source)'}`);
      continue;
    }
    if (acknowledged(key)) {
      manual.push(`${label} (manual authorization preserved)`);
      continue;
    }
    let value;
    if (Object.prototype.hasOwnProperty.call(values, key) && !reference(key) && element.type !== 'url') {
      value = values[key];
      if (element.tagName === 'SELECT' && !options.some(option => option.value === String(value))) { manual.push(`${label} (choose a native supported option)`); continue; }
      if (element.type === 'number' || element.type === 'range') {
        if (!Number.isFinite(Number(value))) { manual.push(`${label} (enter a valid native numeric input)`); continue; }
        value = nativeNumber(element, value);
      }
      if (value && typeof value === 'object') value = JSON.stringify(value, null, 2);
      assign(element, value ?? ''); filled += 1; continue;
    }
    if (element.tagName === 'SELECT') {
      if (!options.length) { manual.push(`${label} (no saved option is available)`); continue; }
      const isReference = reference(key) || /\b(?:patient|record|case|trial|protocol|client|document|unit|crew|enrollment)\b/i.test(label);
      value = isReference && options.some(option => option.value === element.value) ? element.value : options[Math.min(variant, options.length - 1)].value;
    } else if (reference(key) || element.type === 'url') {
      if (!substantive(element.value)) {
        const saved = element.list && Array.from(element.list.options).filter(option => substantive(option.value));
        if (saved?.length) value = saved[Math.min(variant, saved.length - 1)].value;
        else { manual.push(`${label} (select an actual saved reference)`); continue; }
      } else { filled += 1; continue; }
    } else if (element.type === 'checkbox') value = [false, true, false][variant];
    else if (element.type === 'radio') {
      if (!element.name) continue;
      const group = Array.from(scope.querySelectorAll('input[type="radio"]')).filter(item => item.name === element.name && eligible(item));
      if (element !== group[Math.min(variant, group.length - 1)]) continue;
      value = true;
    } else if (element.type === 'number' || element.type === 'range') value = numberExample(element, key, variant);
    else if (element.type === 'date' || element.type === 'datetime-local') {
      const date = new Date(); date.setDate(date.getDate() + [7, 14, 30][variant]);
      value = date.toISOString().slice(0, element.type === 'date' ? 10 : 16);
      if (element.min && value < element.min) value = element.min;
      if (element.max && value > element.max) value = element.max;
    } else if (element.type === 'time') value = ['09:00', '12:00', '15:00'][variant];
    else {
      const current = parse(element.value), placeholder = parse(element.placeholder);
      if (current !== undefined) value = element.value;
      else if (placeholder !== undefined && !nestedSource(placeholder)) value = JSON.stringify(placeholder, null, 2);
      else if (/json|geojson|payload|telemetry|readings|measurements|data\s*set|polygon|coordinates/i.test(key + ' ' + label)) { manual.push(`${label} (paste the native documented data structure)`); continue; }
      else if (element.type === 'email') value = ['reviewer@example.test', 'team@example.test', 'owner@example.test'][variant];
      else if (/tone|style/i.test(key)) value = ['Clear and concise', 'Professional and collaborative', 'Detailed and evidence based'][variant];
      else if (/audience|recipient/i.test(key)) value = ['Project owner', 'Operations team', 'Authorized reviewers'][variant];
      else if (/format/i.test(key)) value = ['Executive summary and next steps', 'Summary and planning table', 'Detailed report with assumptions and alternatives'][variant];
      else value = `Illustrative ${human(label || key).replace(/\*/g, '').trim().toLowerCase()} for ${context || 'this workflow'}: ${['prepare a concise review', 'prepare a team planning review', 'compare alternatives and explain assumptions'][variant]}. Use the supplied information and identify missing evidence.`;
    }
    assign(element, value);
    filled += 1;
  }
  return { filled, manual: [...new Set(manual)] };
}

const RequiredInputs = createContext(false);
export function AIRequiredButton({ disabled, ...props }) {
  const unavailable = useContext(RequiredInputs);
  return <button {...props} disabled={Boolean(disabled) || unavailable} />;
}

export default function CompleteAIExamples({ children, busy = false, context = '', presets = null }) {
  const scope = useRef(null);
  const [status, setStatus] = useState('');
  const [missing, setMissing] = useState(false);
  useEffect(() => { setStatus(''); }, [context]);
  const requiredMissing = useCallback(() => Array.from(scope.current?.querySelectorAll('input, textarea, select') || []).filter(element => eligible(element) && element.required && (element.type === 'checkbox' ? !element.checked : !substantive(element.value))), []);
  const refreshGate = useCallback(() => setMissing(requiredMissing().length > 0), [requiredMissing]);
  useEffect(() => {
    refreshGate();
    const element = scope.current;
    element?.addEventListener('input', refreshGate);
    element?.addEventListener('change', refreshGate);
    const observer = new MutationObserver(refreshGate);
    if (element) observer.observe(element, { childList: true, subtree: true });
    return () => { element?.removeEventListener('input', refreshGate); element?.removeEventListener('change', refreshGate); observer.disconnect(); };
  }, [busy, refreshGate]);
  const fill = variant => {
    const result = fillDisplayedExample(scope.current, variant, context, presets?.[variant]?.values || {});
    refreshGate();
    setStatus(`${result.filled} editable fields filled, including optional inputs. ${result.manual.length ? `Actual source fields: ${result.manual.join('; ')}.` : 'Review the complete example, then choose Generate.'} No AI request was sent.`);
  };
  const preventMissing = event => {
    if (requiredMissing().length && (event.type === 'submit' || event.target.closest?.('[data-ai-generate]'))) {
      event.preventDefault(); event.stopPropagation();
      setStatus(`Supply actual required inputs before generating: ${requiredMissing().map(labelFor).join(', ')}.`);
    }
  };
  return <RequiredInputs.Provider value={busy || missing}><section ref={scope} onSubmitCapture={preventMissing} onClickCapture={preventMissing} data-complete-ai-examples>
    <div style={{ border: '1px solid #d8dfea', borderRadius: 10, padding: 14, marginBottom: 16, background: '#f6f8fc', color: '#243247' }}>
      <strong>Demo AI</strong>
      <p style={{ margin: '6px 0 10px', fontSize: 13 }}>Fill all editable AI fields, including optional inputs. Saved references use actual available options. Clinical facts, source files and authorizations remain manual when undocumented.</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{COMPLETE_EXAMPLE_LABELS.map((label, index) => <button key={label} type="button" disabled={busy} onClick={() => fill(index)} style={{ border: '1px solid #bccbe0', borderRadius: 7, padding: '8px 12px', background: 'white', color: '#244c83', cursor: busy ? 'wait' : 'pointer' }}>{label}</button>)}</div>
      {status && <p role="status" style={{ fontSize: 13, marginBottom: 0 }}>{status}</p>}
    </div>
    {children}
  </section></RequiredInputs.Provider>;
}
