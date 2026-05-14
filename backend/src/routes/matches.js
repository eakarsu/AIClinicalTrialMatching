const express = require('express');
const { Match, Patient, Trial } = require('../models');
const { authenticate } = require('../middleware/auth');
const router = express.Router();

const DISCLAIMER = 'All AI matching suggestions require review and approval by qualified clinical research professionals.';
const VALID_STATUSES = ['candidate', 'enrolled', 'declined', 'screened_out', 'pending'];

// GET all matches with pagination
router.get('/', authenticate, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const { count, rows } = await Match.findAndCountAll({
      include: [{ model: Patient }, { model: Trial }],
      order: [['matchScore', 'DESC']],
      limit,
      offset,
    });

    res.json({
      data: rows,
      pagination: { page, limit, total: count, totalPages: Math.ceil(count / limit) },
      disclaimer: DISCLAIMER,
    });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// GET match by id
router.get('/:id', authenticate, async (req, res) => {
  try {
    const match = await Match.findByPk(req.params.id, {
      include: [{ model: Patient }, { model: Trial }],
    });
    if (!match) return res.status(404).json({ error: 'Match not found' });
    res.json({ ...match.toJSON(), disclaimer: DISCLAIMER });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// POST create match
router.post('/', authenticate, async (req, res) => {
  try {
    const { patientId, trialId, matchScore, reasoning, status } = req.body;
    if (!patientId || !trialId) {
      return res.status(400).json({ error: 'patientId and trialId are required' });
    }
    const match = await Match.create({ patientId, trialId, matchScore, reasoning, status: status || 'candidate' });
    res.status(201).json({ ...match.toJSON(), disclaimer: DISCLAIMER });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// POST /score — Re-score all matches for a patient against currently recruiting trials
router.post('/score', authenticate, async (req, res) => {
  try {
    const { patientId } = req.body;
    if (!patientId) return res.status(400).json({ error: 'patientId is required' });

    const patient = await Patient.findByPk(patientId);
    if (!patient) return res.status(404).json({ error: 'Patient not found' });

    const recruitingTrials = await Trial.findAll({ where: { status: 'recruiting' } });
    const updated = [];

    for (const trial of recruitingTrials) {
      // Basic scoring heuristic — AI-enhanced scoring handled in /api/ai/match-patient
      const diagnosisMatch = trial.indication?.toLowerCase().includes(patient.diagnosis?.toLowerCase()) ? 40 : 0;
      const phaseBonus = { 'Phase 1': 5, 'Phase 2': 10, 'Phase 3': 15, 'Phase 4': 10 }[trial.phase] || 0;
      const score = Math.min(100, diagnosisMatch + phaseBonus + Math.floor(Math.random() * 20));

      const [match, created] = await Match.findOrCreate({
        where: { patientId, trialId: trial.id },
        defaults: { matchScore: score, status: 'candidate' },
      });

      if (!created) {
        await match.update({ matchScore: score });
      }

      updated.push({ trialId: trial.id, trialTitle: trial.title, matchScore: score, isNew: created });
    }

    res.json({
      message: `Re-scored matches for patient ${patient.firstName} ${patient.lastName}`,
      trialsScored: updated.length,
      matches: updated.sort((a, b) => b.matchScore - a.matchScore),
      disclaimer: DISCLAIMER,
    });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// GET /patient/:id/ranked — Matches for a patient sorted by score descending
router.get('/patient/:id/ranked', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const patient = await Patient.findByPk(id);
    if (!patient) return res.status(404).json({ error: 'Patient not found' });

    const matches = await Match.findAll({
      where: { patientId: id },
      include: [{ model: Trial }],
      order: [['matchScore', 'DESC']],
    });

    res.json({
      patient: { id: patient.id, name: `${patient.firstName} ${patient.lastName}`, diagnosis: patient.diagnosis },
      matches,
      totalMatches: matches.length,
      disclaimer: DISCLAIMER,
    });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// PUT /:id/status — Update match status with audit log
router.put('/:id/status', authenticate, async (req, res) => {
  try {
    const { status, reason } = req.body;
    if (!status) return res.status(400).json({ error: 'status is required' });
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` });
    }

    const match = await Match.findByPk(req.params.id, { include: [{ model: Patient }, { model: Trial }] });
    if (!match) return res.status(404).json({ error: 'Match not found' });

    const previousStatus = match.status;
    await match.update({ status });

    // Build audit log entry (stored in memory — attach to response)
    const auditEntry = {
      matchId: match.id,
      patientId: match.patientId,
      trialId: match.trialId,
      previousStatus,
      newStatus: status,
      reason: reason || null,
      changedBy: req.user?.id || 'unknown',
      changedAt: new Date().toISOString(),
    };

    res.json({
      match: match.toJSON(),
      audit: auditEntry,
      disclaimer: DISCLAIMER,
    });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// PUT /:id — General update
router.put('/:id', authenticate, async (req, res) => {
  try {
    const match = await Match.findByPk(req.params.id);
    if (!match) return res.status(404).json({ error: 'Match not found' });
    await match.update(req.body);
    res.json({ ...match.toJSON(), disclaimer: DISCLAIMER });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// DELETE
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const match = await Match.findByPk(req.params.id);
    if (!match) return res.status(404).json({ error: 'Match not found' });
    await match.destroy();
    res.json({ message: 'Match deleted successfully' });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

module.exports = router;
