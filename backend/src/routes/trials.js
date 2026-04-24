const express = require('express');
const { Trial } = require('../models');
const { authenticate } = require('../middleware/auth');
const router = express.Router();

router.get('/', authenticate, async (req, res) => {
  try {
    const trials = await Trial.findAll({ order: [['createdAt', 'DESC']] });
    res.json(trials);
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
