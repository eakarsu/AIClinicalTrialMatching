const express = require('express');
const { Enrollment, Patient, Trial } = require('../models');
const { authenticate } = require('../middleware/auth');
const router = express.Router();

router.get('/', authenticate, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const where = {};
    if (req.query.status) where.status = req.query.status;
    if (req.query.trial_id) where.trialId = parseInt(req.query.trial_id);
    if (req.query.patient_id) where.patientId = parseInt(req.query.patient_id);

    const { count, rows } = await Enrollment.findAndCountAll({
      where,
      include: [{ model: Patient }, { model: Trial }],
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

router.get('/:id', authenticate, async (req, res) => {
  try {
    const item = await Enrollment.findByPk(req.params.id, { include: [{ model: Patient }, { model: Trial }] });
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json(item);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

router.post('/', authenticate, async (req, res) => {
  try {
    const { patientId, trialId } = req.body;
    const errors = [];
    if (!patientId) errors.push('patientId is required');
    if (!trialId) errors.push('trialId is required');
    if (errors.length > 0) return res.status(400).json({ errors });
    res.status(201).json(await Enrollment.create(req.body));
  } catch (error) { res.status(500).json({ error: error.message }); }
});

router.put('/:id', authenticate, async (req, res) => {
  try {
    const item = await Enrollment.findByPk(req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });
    await item.update(req.body);
    res.json(item);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    const item = await Enrollment.findByPk(req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });
    await item.destroy();
    res.json({ message: 'Deleted successfully' });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

module.exports = router;
