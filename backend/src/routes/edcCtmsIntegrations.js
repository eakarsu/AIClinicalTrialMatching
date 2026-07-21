/*
 * EDC / CTMS integration + outbound push.
 *
 *   GET    /api/edc-ctms-integrations            list EDC + CTMS connections
 *   POST   /api/edc-ctms-integrations/connect    create a connection
 *   POST   /api/edc-ctms-integrations/:id/push   push records to the system
 *   GET    /api/edc-ctms-integrations/:id/logs   push history (audit trail)
 *   DELETE /api/edc-ctms-integrations/:id        disconnect
 *
 * EDC (Medidata Rave)  → pushes Enrollments as study subjects.
 * CTMS (Veeva Vault)   → pushes Trials as master records.
 * Every push is written to AuditLog (21 CFR Part 11).
 */
const express = require('express');
const { Integration, Enrollment, Trial, Patient, AuditLog } = require('../models');
const { authenticate } = require('../middleware/auth');
const { pushRecords } = require('../integrations/edcCtmsAdapter');
const router = express.Router();

// system -> allowed vendor
const VENDORS = { EDC: ['medidata'], CTMS: ['veeva'] };

async function audit(req, action, integration, payload) {
  try {
    await AuditLog.create({
      userId: (req.user && req.user.id) || null,
      userEmail: (req.user && req.user.email) || null,
      action,
      resource: `${integration.system}Integration`,
      resourceId: String(integration.id),
      ipAddress: req.ip,
      userAgent: req.get && req.get('user-agent'),
      payload: payload || {},
    });
  } catch (_) { /* audit must never break the request */ }
}

// List EDC + CTMS connections
router.get('/', authenticate, async (req, res) => {
  try {
    const rows = await Integration.findAll({
      where: { system: ['EDC', 'CTMS'] },
      order: [['createdAt', 'DESC']],
    });
    res.json({ data: rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Connect an EDC or CTMS system
router.post('/connect', authenticate, async (req, res) => {
  try {
    const { system, vendor, name, baseUrl, mode, config } = req.body || {};
    const sys = String(system || '').toUpperCase();
    const v = String(vendor || '').toLowerCase();
    if (!VENDORS[sys]) return res.status(400).json({ error: 'system must be EDC or CTMS' });
    if (!VENDORS[sys].includes(v)) {
      return res.status(400).json({ error: `${sys} vendor must be one of: ${VENDORS[sys].join(', ')}` });
    }
    if ((mode || 'sandbox') === 'live' && !baseUrl) {
      return res.status(400).json({ error: 'live mode requires a baseUrl' });
    }
    const integration = await Integration.create({
      system: sys,
      vendor: v,
      name: name || `${v.charAt(0).toUpperCase() + v.slice(1)} ${sys}`,
      baseUrl: baseUrl || null,
      mode: mode === 'live' ? 'live' : 'sandbox',
      status: 'connected',
      config: config || {},
    });
    await audit(req, `${sys}_CONNECT`, integration, { vendor: v, mode: integration.mode });
    res.status(201).json(integration);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Push records out to the external system
router.post('/:id/push', authenticate, async (req, res) => {
  try {
    const integration = await Integration.findByPk(req.params.id);
    if (!integration || !['EDC', 'CTMS'].includes(integration.system)) {
      return res.status(404).json({ error: 'EDC/CTMS integration not found' });
    }

    // Gather the records to push from the local DB and shape them for the target.
    let records = [];
    if (integration.system === 'EDC') {
      const enrollments = await Enrollment.findAll({
        include: [{ model: Patient }, { model: Trial }],
        limit: 200,
      });
      records = enrollments.map((e) => ({
        localId: e.id,
        label: `${e.Patient ? e.Patient.firstName + ' ' + e.Patient.lastName : 'Subject ' + e.patientId}`,
        subject: {
          subjectId: e.id,
          mrn: e.Patient && e.Patient.mrn,
          trial: e.Trial && e.Trial.trialId,
          status: e.status,
          enrollmentDate: e.enrollmentDate,
        },
      }));
    } else {
      const trials = await Trial.findAll({ limit: 200 });
      records = trials.map((t) => ({
        localId: t.id,
        label: t.title,
        record: {
          studyId: t.trialId,
          title: t.title,
          phase: t.phase,
          status: t.status,
          sponsor: t.sponsor,
          indication: t.indication,
        },
      }));
    }

    if (records.length === 0) {
      return res.status(400).json({ error: `Nothing to push — no ${integration.system === 'EDC' ? 'enrollments' : 'trials'} found.` });
    }

    let results;
    try {
      results = await pushRecords(integration, records);
    } catch (e) {
      await integration.update({ status: 'error', lastSyncAt: new Date(), lastSyncSummary: { error: e.message } });
      await audit(req, `${integration.system}_PUSH_ERROR`, integration, { error: e.message });
      return res.status(502).json({ error: `${integration.system} push failed: ${e.message}` });
    }

    const summary = {
      pushed: results.length,
      target: integration.vendor,
      at: new Date().toISOString(),
      mode: integration.mode,
    };
    await integration.update({ status: 'connected', lastSyncAt: new Date(), lastSyncSummary: summary });
    await audit(req, `${integration.system}_PUSH`, integration, summary);

    res.json({ ...summary, system: integration.system, results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Push history
router.get('/:id/logs', authenticate, async (req, res) => {
  try {
    const integration = await Integration.findByPk(req.params.id);
    if (!integration) return res.status(404).json({ error: 'Integration not found' });
    const rows = await AuditLog.findAll({
      where: { resource: `${integration.system}Integration`, resourceId: String(req.params.id) },
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
    await audit(req, `${integration.system}_DISCONNECT`, integration, {});
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
