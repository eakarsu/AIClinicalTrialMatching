const express = require('express');
const { Report, Patient, Trial, Match, Enrollment, sequelize } = require('../models');
const { authenticate } = require('../middleware/auth');
const { Op } = require('sequelize');
const router = express.Router();

// ─── Basic CRUD ───────────────────────────────────────────────────────────────

// GET all reports with pagination
router.get('/', authenticate, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const { count, rows } = await Report.findAndCountAll({
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });

    res.json({
      data: rows,
      pagination: { page, limit, total: count, totalPages: Math.ceil(count / limit) },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', authenticate, async (req, res) => {
  try {
    const item = await Report.findByPk(req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json(item);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', authenticate, async (req, res) => {
  try {
    const { title } = req.body;
    if (!title || typeof title !== 'string' || title.trim().length < 1) {
      return res.status(400).json({ error: 'title is required' });
    }
    res.status(201).json(await Report.create(req.body));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', authenticate, async (req, res) => {
  try {
    const item = await Report.findByPk(req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });
    await item.update(req.body);
    res.json(item);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    const item = await Report.findByPk(req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });
    await item.destroy();
    res.json({ message: 'Deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Enrollment Summary Report ────────────────────────────────────────────────

/**
 * GET /api/reports/enrollment-summary
 * Returns enrollment rate, screen failure rate, and dropout rate.
 * Query params: trial_id (optional)
 */
router.get('/enrollment-summary', authenticate, async (req, res) => {
  try {
    const { trial_id } = req.query;
    const enrollmentWhere = trial_id ? { trialId: parseInt(trial_id) } : {};
    const matchWhere = trial_id ? { trialId: parseInt(trial_id) } : {};

    const [trials, enrollments, matches] = await Promise.all([
      trial_id
        ? Trial.findAll({ where: { id: parseInt(trial_id) } })
        : Trial.findAll({ order: [['createdAt', 'DESC']] }),
      Enrollment.findAll({ where: enrollmentWhere }),
      Match.findAll({ where: matchWhere }),
    ]);

    // Enrollment status distribution
    const statusDist = enrollments.reduce((acc, e) => {
      acc[e.status] = (acc[e.status] || 0) + 1;
      return acc;
    }, {});

    const totalEnrollments = enrollments.length;
    const screenFailed = statusDist['screen_failed'] || 0;
    const withdrawn = statusDist['withdrawn'] || 0;

    // Aggregate rates
    const screenFailureRate =
      totalEnrollments > 0
        ? ((screenFailed / totalEnrollments) * 100).toFixed(2)
        : '0.00';

    const dropoutRate =
      totalEnrollments > 0
        ? ((withdrawn / totalEnrollments) * 100).toFixed(2)
        : '0.00';

    const totalTargeted = trials.reduce((sum, t) => sum + (t.targetEnrollment || 0), 0);
    const totalCurrentlyEnrolled = trials.reduce((sum, t) => sum + (t.currentEnrollment || 0), 0);
    const enrollmentRate =
      totalTargeted > 0
        ? ((totalCurrentlyEnrolled / totalTargeted) * 100).toFixed(2)
        : '0.00';

    // Match → enrollment conversion rate
    const totalMatches = matches.length;
    const enrolledMatches = matches.filter((m) => m.status === 'enrolled').length;
    const matchConversionRate =
      totalMatches > 0
        ? ((enrolledMatches / totalMatches) * 100).toFixed(2)
        : '0.00';

    // Per-trial breakdown
    const trialBreakdown = trials.map((t) => {
      const te = enrollments.filter((e) => e.trialId === t.id);
      const tFailed = te.filter((e) => e.status === 'screen_failed').length;
      const tWithdrawn = te.filter((e) => e.status === 'withdrawn').length;
      return {
        trialId: t.id,
        trialTitle: t.title,
        phase: t.phase,
        status: t.status,
        targetEnrollment: t.targetEnrollment,
        currentEnrollment: t.currentEnrollment,
        enrollmentRate:
          t.targetEnrollment > 0
            ? ((t.currentEnrollment / t.targetEnrollment) * 100).toFixed(1) + '%'
            : 'N/A',
        totalEnrollmentRecords: te.length,
        screenFailureRate:
          te.length > 0 ? ((tFailed / te.length) * 100).toFixed(1) + '%' : 'N/A',
        dropoutRate:
          te.length > 0 ? ((tWithdrawn / te.length) * 100).toFixed(1) + '%' : 'N/A',
      };
    });

    res.json({
      summary: {
        totalTrials: trials.length,
        totalEnrollmentRecords: totalEnrollments,
        totalTargetedPatients: totalTargeted,
        totalCurrentlyEnrolled,
        enrollmentRate: enrollmentRate + '%',
        screenFailureRate: screenFailureRate + '%',
        dropoutRate: dropoutRate + '%',
        matchConversionRate: matchConversionRate + '%',
      },
      statusDistribution: statusDist,
      trialBreakdown,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── CSV Export ───────────────────────────────────────────────────────────────

/**
 * GET /api/export/matches
 * Exports matches as CSV.
 * Query params: patient_id, trial_id, status (all optional)
 */
router.get('/export/matches', authenticate, async (req, res) => {
  try {
    const { patient_id, trial_id, status } = req.query;
    const where = {};
    if (patient_id) where.patientId = parseInt(patient_id);
    if (trial_id) where.trialId = parseInt(trial_id);
    if (status) where.status = status;

    const matches = await Match.findAll({
      where,
      include: [{ model: Patient }, { model: Trial }],
      order: [['matchScore', 'DESC']],
    });

    const headers = [
      'match_id',
      'patient_id',
      'patient_name',
      'patient_diagnosis',
      'trial_id',
      'trial_title',
      'trial_phase',
      'match_score',
      'status',
      'reasoning',
      'created_at',
    ];

    const escapeCsv = (val) => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = matches.map((m) => [
      m.id,
      m.patientId,
      m.Patient ? `${m.Patient.firstName} ${m.Patient.lastName}` : '',
      m.Patient?.diagnosis || '',
      m.trialId,
      m.Trial?.title || '',
      m.Trial?.phase || '',
      m.matchScore !== null && m.matchScore !== undefined ? m.matchScore : '',
      m.status || '',
      m.reasoning || m.matchReason || '',
      m.createdAt ? new Date(m.createdAt).toISOString() : '',
    ]);

    const csv = [headers.join(','), ...rows.map((r) => r.map(escapeCsv).join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="matches-export.csv"');
    res.send(csv);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
