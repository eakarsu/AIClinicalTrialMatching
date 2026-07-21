/*
 * EHR integration + patient sync.
 *
 *   GET    /api/ehr-integrations            list EHR connections
 *   POST   /api/ehr-integrations/connect    create a connection (sandbox by default)
 *   POST   /api/ehr-integrations/:id/sync   pull patients (FHIR) and upsert them
 *   GET    /api/ehr-integrations/:id/logs   sync history (from the audit trail)
 *   DELETE /api/ehr-integrations/:id        disconnect
 *
 * Writes a 21 CFR Part 11 AuditLog entry for every sync. Patients are upserted
 * by `mrn` so re-syncing updates rather than duplicates.
 */
const express = require('express');
const { Integration, Patient, Trial, Match, AuditLog } = require('../models');
const { authenticate } = require('../middleware/auth');
const { pullPatients } = require('../integrations/ehrAdapter');
const { scorePatient } = require('../services/matchingService');
const router = express.Router();

const EHR_VENDORS = ['epic', 'cerner'];
const DISCLAIMER =
  'Patients ingested from an EHR are candidates only; eligibility requires review by qualified clinical research staff.';

async function audit(req, action, integration, payload) {
  try {
    await AuditLog.create({
      userId: (req.user && req.user.id) || null,
      userEmail: (req.user && req.user.email) || null,
      action,
      resource: 'EHRIntegration',
      resourceId: String(integration.id),
      reason: payload && payload.reason,
      ipAddress: req.ip,
      userAgent: req.get && req.get('user-agent'),
      payload: payload || {},
    });
  } catch (_) {
    /* audit must never break the request */
  }
}

// List EHR connections
router.get('/', authenticate, async (req, res) => {
  try {
    const rows = await Integration.findAll({
      where: { system: 'EHR' },
      order: [['createdAt', 'DESC']],
    });
    res.json({ data: rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Connect a new EHR
router.post('/connect', authenticate, async (req, res) => {
  try {
    const { vendor, name, baseUrl, mode, config } = req.body || {};
    const v = String(vendor || '').toLowerCase();
    if (!EHR_VENDORS.includes(v)) {
      return res.status(400).json({ error: `vendor must be one of: ${EHR_VENDORS.join(', ')}` });
    }
    if ((mode || 'sandbox') === 'live' && !baseUrl) {
      return res.status(400).json({ error: 'live mode requires a FHIR baseUrl' });
    }
    const integration = await Integration.create({
      system: 'EHR',
      vendor: v,
      name: name || `${v.charAt(0).toUpperCase() + v.slice(1)} EHR`,
      baseUrl: baseUrl || null,
      mode: mode === 'live' ? 'live' : 'sandbox',
      status: 'connected',
      config: config || {},
    });
    await audit(req, 'EHR_CONNECT', integration, { vendor: v, mode: integration.mode });
    res.status(201).json(integration);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Run a patient pull/sync
router.post('/:id/sync', authenticate, async (req, res) => {
  try {
    const integration = await Integration.findByPk(req.params.id);
    if (!integration || integration.system !== 'EHR') {
      return res.status(404).json({ error: 'EHR integration not found' });
    }

    let mapped;
    try {
      mapped = await pullPatients(integration);
    } catch (e) {
      await integration.update({ status: 'error', lastSyncAt: new Date(), lastSyncSummary: { error: e.message } });
      await audit(req, 'EHR_SYNC_ERROR', integration, { error: e.message });
      return res.status(502).json({ error: `EHR sync failed: ${e.message}` });
    }

    // Auto-match pulled patients to recruiting trials unless explicitly disabled.
    const autoMatch = req.body && req.body.autoMatch === false ? false : true;

    let created = 0;
    let updated = 0;
    let matchesCreated = 0;
    const results = [];
    for (const row of mapped) {
      // Upsert by mrn (fall back to name+DOB when an EHR omits the identifier).
      const where = row.mrn ? { mrn: row.mrn } : { firstName: row.firstName, lastName: row.lastName, dateOfBirth: row.dateOfBirth };
      const existing = await Patient.findOne({ where });
      let patient;
      let action;
      if (existing) {
        await existing.update(row);
        patient = existing; action = 'updated'; updated++;
      } else {
        patient = await Patient.create(row); action = 'created'; created++;
      }

      const entry = { id: patient.id, mrn: row.mrn, name: `${row.firstName} ${row.lastName}`, action };
      if (autoMatch) {
        const matches = await scorePatient(patient, { Trial, Match });
        matchesCreated += matches.filter((m) => m.created).length;
        const top = matches[0];
        entry.topMatch = top ? { trial: top.trialTitle, score: top.matchScore } : null;
        entry.trialsScored = matches.length;
      }
      results.push(entry);
    }

    const summary = { pulled: mapped.length, created, updated, matchesCreated, autoMatch, at: new Date().toISOString(), mode: integration.mode };
    await integration.update({ status: 'connected', lastSyncAt: new Date(), lastSyncSummary: summary });
    await audit(req, 'EHR_SYNC', integration, summary);

    res.json({ ...summary, vendor: integration.vendor, patients: results, disclaimer: DISCLAIMER });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Sync history for one integration (from the audit trail)
router.get('/:id/logs', authenticate, async (req, res) => {
  try {
    const rows = await AuditLog.findAll({
      where: { resource: 'EHRIntegration', resourceId: String(req.params.id) },
      order: [['createdAt', 'DESC']],
      limit: 50,
    });
    res.json({ data: rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Disconnect
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const integration = await Integration.findByPk(req.params.id);
    if (!integration) return res.status(404).json({ error: 'Integration not found' });
    await integration.update({ status: 'disconnected' });
    await audit(req, 'EHR_DISCONNECT', integration, {});
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
