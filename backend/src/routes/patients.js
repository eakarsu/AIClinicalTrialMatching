const express = require('express');
const { Patient, Trial, Match, Enrollment } = require('../models');
const { authenticate } = require('../middleware/auth');
const router = express.Router();

const DISCLAIMER = 'All AI matching suggestions require review and approval by qualified clinical research professionals.';

// GET all patients with pagination
router.get('/', authenticate, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const { count, rows } = await Patient.findAndCountAll({
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });

    res.json({
      data: rows,
      pagination: { page, limit, total: count, totalPages: Math.ceil(count / limit) },
    });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// GET patient by id
router.get('/:id', authenticate, async (req, res) => {
  try {
    const patient = await Patient.findByPk(req.params.id);
    if (!patient) return res.status(404).json({ error: 'Patient not found' });
    res.json(patient);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// POST create patient with input validation
router.post('/', authenticate, async (req, res) => {
  try {
    const { firstName, lastName, dateOfBirth, gender, email, diagnosis } = req.body;

    const errors = [];
    if (!firstName || typeof firstName !== 'string' || firstName.trim().length < 1) errors.push('firstName is required');
    if (!lastName || typeof lastName !== 'string' || lastName.trim().length < 1) errors.push('lastName is required');
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('email must be a valid email address');
    if (dateOfBirth && isNaN(new Date(dateOfBirth).getTime())) errors.push('dateOfBirth must be a valid date');

    if (errors.length > 0) return res.status(400).json({ errors });

    const patient = await Patient.create(req.body);
    res.status(201).json(patient);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// PUT update patient
router.put('/:id', authenticate, async (req, res) => {
  try {
    const patient = await Patient.findByPk(req.params.id);
    if (!patient) return res.status(404).json({ error: 'Patient not found' });
    await patient.update(req.body);
    res.json(patient);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// DELETE patient
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const patient = await Patient.findByPk(req.params.id);
    if (!patient) return res.status(404).json({ error: 'Patient not found' });
    await patient.destroy();
    res.json({ message: 'Patient deleted successfully' });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// POST /:id/eligibility-check — Quick pre-screening against all recruiting trials
router.post('/:id/eligibility-check', authenticate, async (req, res) => {
  try {
    const patient = await Patient.findByPk(req.params.id);
    if (!patient) return res.status(404).json({ error: 'Patient not found' });

    const recruitingTrials = await Trial.findAll({ where: { status: 'recruiting' } });

    const results = recruitingTrials.map(trial => {
      const checks = [];
      let passCount = 0;
      let totalChecks = 0;

      // Diagnosis match
      if (trial.indication) {
        totalChecks++;
        const match = patient.diagnosis && trial.indication.toLowerCase().includes(patient.diagnosis.toLowerCase());
        checks.push({ criterion: 'Diagnosis match', passed: match, detail: `Patient: ${patient.diagnosis}, Trial: ${trial.indication}` });
        if (match) passCount++;
      }

      // Active status
      totalChecks++;
      const isActive = patient.status === 'active';
      checks.push({ criterion: 'Active patient status', passed: isActive, detail: `Status: ${patient.status}` });
      if (isActive) passCount++;

      const score = totalChecks > 0 ? Math.round((passCount / totalChecks) * 100) : 0;

      return {
        trialId: trial.id,
        trialTitle: trial.title,
        trialPhase: trial.phase,
        eligibilityScore: score,
        passedChecks: passCount,
        totalChecks,
        checks,
        recommendation: score >= 50 ? 'Potentially eligible — full screening recommended' : 'Likely ineligible — review required',
      };
    });

    results.sort((a, b) => b.eligibilityScore - a.eligibilityScore);

    res.json({
      patient: { id: patient.id, name: `${patient.firstName} ${patient.lastName}`, diagnosis: patient.diagnosis },
      trialsChecked: recruitingTrials.length,
      results,
      disclaimer: DISCLAIMER,
    });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// GET /:id/trial-history — All trials the patient has been matched/enrolled in
router.get('/:id/trial-history', authenticate, async (req, res) => {
  try {
    const patient = await Patient.findByPk(req.params.id);
    if (!patient) return res.status(404).json({ error: 'Patient not found' });

    const [matches, enrollments] = await Promise.all([
      Match.findAll({
        where: { patientId: req.params.id },
        include: [{ model: Trial }],
        order: [['createdAt', 'DESC']],
      }),
      Enrollment.findAll({
        where: { patientId: req.params.id },
        include: [{ model: Trial }],
        order: [['createdAt', 'DESC']],
      }),
    ]);

    res.json({
      patient: { id: patient.id, name: `${patient.firstName} ${patient.lastName}`, diagnosis: patient.diagnosis },
      matches: matches.map(m => ({
        id: m.id,
        trialId: m.trialId,
        trialTitle: m.Trial?.title,
        matchScore: m.matchScore,
        status: m.status,
        reasoning: m.reasoning,
        createdAt: m.createdAt,
      })),
      enrollments: enrollments.map(e => ({
        id: e.id,
        trialId: e.trialId,
        trialTitle: e.Trial?.title,
        enrollmentDate: e.enrollmentDate,
        status: e.status,
        completionDate: e.completionDate,
      })),
      summary: {
        totalMatches: matches.length,
        totalEnrollments: enrollments.length,
        activeEnrollments: enrollments.filter(e => e.status === 'active' || e.status === 'screening').length,
      },
      disclaimer: DISCLAIMER,
    });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

module.exports = router;
