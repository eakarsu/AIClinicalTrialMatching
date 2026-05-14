const express = require('express');
const { Trial } = require('../models');
const { authenticate } = require('../middleware/auth');
const router = express.Router();

router.get('/', authenticate, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const where = {};
    if (req.query.status) where.status = req.query.status;
    if (req.query.phase) where.phase = req.query.phase;

    const { count, rows } = await Trial.findAndCountAll({
      where,
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
    const trial = await Trial.findByPk(req.params.id);
    if (!trial) return res.status(404).json({ error: 'Trial not found' });
    res.json(trial);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

router.post('/', authenticate, async (req, res) => {
  try {
    const trial = await Trial.create(req.body);
    res.status(201).json(trial);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

router.put('/:id', authenticate, async (req, res) => {
  try {
    const trial = await Trial.findByPk(req.params.id);
    if (!trial) return res.status(404).json({ error: 'Trial not found' });
    await trial.update(req.body);
    res.json(trial);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    const trial = await Trial.findByPk(req.params.id);
    if (!trial) return res.status(404).json({ error: 'Trial not found' });
    await trial.destroy();
    res.json({ message: 'Trial deleted successfully' });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

module.exports = router;
