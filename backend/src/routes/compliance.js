/**
 * Compliance routes — 21 CFR Part 11 audit trail and document expiry tracking.
 */
const express = require('express');
const { Regulatory, Trial, Patient, AuditLog } = require('../models');
const { authenticate } = require('../middleware/auth');
const { Op } = require('sequelize');
const router = express.Router();

/**
 * GET /api/compliance/expiring
 * Returns regulatory documents expiring within 30 days (or ?days=N).
 */
router.get('/expiring', authenticate, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const now = new Date();
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() + days);

    const expiringDocs = await Regulatory.findAll({
      where: {
        expiryDate: {
          [Op.between]: [now.toISOString().split('T')[0], cutoff.toISOString().split('T')[0]],
        },
        status: { [Op.not]: 'expired' },
      },
      include: [{ model: Trial }],
      order: [['expiryDate', 'ASC']],
    });

    const formatted = expiringDocs.map((doc) => {
      const expiry = new Date(doc.expiryDate);
      const daysUntilExpiry = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
      return {
        id: doc.id,
        trialId: doc.trialId,
        trialTitle: doc.Trial?.title || null,
        documentType: doc.documentType,
        title: doc.title,
        authority: doc.authority,
        referenceNumber: doc.referenceNumber,
        status: doc.status,
        expiryDate: doc.expiryDate,
        daysUntilExpiry,
        urgency:
          daysUntilExpiry <= 7
            ? 'critical'
            : daysUntilExpiry <= 14
            ? 'high'
            : 'moderate',
      };
    });

    res.json({
      windowDays: days,
      totalExpiring: formatted.length,
      critical: formatted.filter((d) => d.urgency === 'critical').length,
      high: formatted.filter((d) => d.urgency === 'high').length,
      moderate: formatted.filter((d) => d.urgency === 'moderate').length,
      documents: formatted,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/compliance/audit-trail
 * Log a patient data access event for 21 CFR Part 11 compliance.
 * Body: { patient_id, action, resource, reason }
 */
router.post('/audit-trail', authenticate, async (req, res) => {
  try {
    const { patient_id, action, resource, reason } = req.body;

    const errors = [];
    if (!patient_id) errors.push('patient_id is required');
    if (!action || typeof action !== 'string') errors.push('action is required');
    if (!resource || typeof resource !== 'string') errors.push('resource is required');
    if (errors.length > 0) return res.status(400).json({ errors });

    // Verify patient exists
    const patient = await Patient.findByPk(patient_id);
    if (!patient) return res.status(404).json({ error: 'Patient not found' });

    const electronicSignatureApplicable = ['create', 'modify', 'delete', 'approve'].includes(
      action.toLowerCase()
    );

    const created = await AuditLog.create({
      userId: req.user?.id || null,
      userEmail: req.user?.email || null,
      action: action.trim(),
      resource: resource.trim(),
      patientId: patient_id,
      reason: reason || null,
      ipAddress: req.ip || null,
      userAgent: req.get('User-Agent') || null,
      payload: {
        patientName: `${patient.firstName} ${patient.lastName}`,
        electronicSignatureApplicable,
        regulatoryStandard: '21 CFR Part 11',
      },
    });

    const total = await AuditLog.count();

    res.status(201).json({
      message: 'Audit entry logged successfully',
      entry: created,
      totalAuditEntries: total,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/compliance/audit-trail
 * Retrieve audit log entries with optional filtering.
 * Query params: patient_id, user_id, action, page, limit
 */
router.get('/audit-trail', authenticate, async (req, res) => {
  try {
    const { patient_id, user_id, action, page = 1, limit = 50 } = req.query;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(500, Math.max(1, parseInt(limit) || 50));
    const offset = (pageNum - 1) * limitNum;

    const where = {};
    if (patient_id) where.patientId = patient_id;
    if (user_id) where.userId = user_id;
    if (action) where.action = { [Op.iLike]: `%${action}%` };

    const { rows, count } = await AuditLog.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: limitNum,
      offset,
    });

    res.json({
      data: rows,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: count,
        totalPages: Math.ceil(count / limitNum),
      },
      regulatoryStandard: '21 CFR Part 11',
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
