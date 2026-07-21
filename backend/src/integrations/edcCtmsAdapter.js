/*
 * EDC / CTMS adapter — pushes data OUT of the app to external trial systems:
 *   - EDC  (Medidata Rave): study subjects / enrollments
 *   - CTMS (Veeva Vault):    trial & site master records
 *
 * Mirrors the EHR adapter's two modes:
 *   - 'sandbox' (default): simulates the remote API, returning realistic
 *      external record ids so a push runs end-to-end without vendor creds.
 *   - 'live': POSTs to the integration's baseUrl with config.accessToken.
 */

function externalIdFor(vendor, localId, idx) {
  const prefix =
    vendor === 'medidata' ? 'RAVE-SUBJ' :
    vendor === 'veeva' ? 'VV-REC' :
    'EXT';
  const n = String(localId != null ? localId : idx + 1).padStart(5, '0');
  return `${prefix}-${n}`;
}

async function postLive(integration, path, payload) {
  const base = (integration.baseUrl || '').replace(/\/$/, '');
  if (!base) throw new Error('Live push requires a baseUrl on the integration.');
  const token = integration.config && integration.config.accessToken;
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`${integration.vendor} ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

/**
 * Push a batch of records to the external system. `records` is an array of
 * plain objects already shaped for the target (see the route). Returns a
 * per-record result with the assigned external id.
 */
async function pushRecords(integration, records) {
  const path = integration.system === 'EDC' ? '/subjects' : '/records';
  const results = [];
  for (let i = 0; i < records.length; i++) {
    const rec = records[i];
    if (integration.mode === 'live') {
      const resp = await postLive(integration, path, rec);
      results.push({ localId: rec.localId, externalId: resp.id || resp.externalId || null, status: 'sent' });
    } else {
      // Sandbox: simulate acceptance and assign a deterministic external id.
      results.push({
        localId: rec.localId,
        label: rec.label,
        externalId: externalIdFor(integration.vendor, rec.localId, i),
        status: 'accepted',
      });
    }
  }
  return results;
}

module.exports = { pushRecords };
