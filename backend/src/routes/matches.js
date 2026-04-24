const express = require('express');
const { Match, Patient, Trial } = require('../models');
const { authenticate } = require('../middleware/auth');
const router = express.Router();

router.get('/', authenticate, async (req, res) => {
  try {
    const matches = await Match.findAll({
      include: [{ model: Patient }, { model: Trial }],
      order: [['matchScore', 'DESC']],
    });
    res.json(matches);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

router.get('/:id', authenticate, async (req, res) => {
  try {
    const match = await Match.findByPk(req.params.id, {
      include: [{ model: Patient }, { model: Trial }],
    });
    if (!match) return res.status(404).json({ error: 'Match not found' });
    res.json(match);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

router.post('/', authenticate, async (req, res) => {
  try {
    const match = await Match.create(req.body);
    res.status(201).json(match);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

router.put('/:id', authenticate, async (req, res) => {
  try {
    const match = await Match.findByPk(req.params.id);
    if (!match) return res.status(404).json({ error: 'Match not found' });
    await match.update(req.body);
    res.json(match);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    const match = await Match.findByPk(req.params.id);
    if (!match) return res.status(404).json({ error: 'Match not found' });
    await match.destroy();
    res.json({ message: 'Match deleted successfully' });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

module.exports = router;
