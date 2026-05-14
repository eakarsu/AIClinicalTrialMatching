/**
 * Webhook subscriptions registry (audit gap: missing integration API).
 * Uses an in-memory store; persistent storage can be added by introducing a
 * `Webhook` Sequelize model later. Provides CRUD + manual test-delivery.
 */

const express = require('express');
const { authenticate } = require('../middleware/auth');
const router = express.Router();

const memStore = [];
let nextId = 1;

router.use(authenticate);

router.get('/', (req, res) => {
  res.json(memStore);
});

router.get('/:id', (req, res) => {
  const item = memStore.find(w => String(w.id) === String(req.params.id));
  if (!item) return res.status(404).json({ error: 'Not found' });
  res.json(item);
});

router.post('/', (req, res) => {
  try {
    const { url, events, headers, status } = req.body;
    if (!url) return res.status(400).json({ error: 'url is required' });
    const item = {
      id: nextId++,
      url,
      events: events || [],
      headers: headers || {},
      status: status || 'active',
      created_at: new Date().toISOString()
    };
    memStore.push(item);
    res.json(item);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', (req, res) => {
  try {
    const { url, events, headers, status } = req.body;
    const item = memStore.find(w => String(w.id) === String(req.params.id));
    if (!item) return res.status(404).json({ error: 'Not found' });
    if (url !== undefined) item.url = url;
    if (events !== undefined) item.events = events;
    if (headers !== undefined) item.headers = headers;
    if (status !== undefined) item.status = status;
    res.json(item);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', (req, res) => {
  const idx = memStore.findIndex(w => String(w.id) === String(req.params.id));
  if (idx >= 0) memStore.splice(idx, 1);
  res.json({ success: true });
});

router.post('/:id/test', async (req, res) => {
  try {
    const item = memStore.find(w => String(w.id) === String(req.params.id));
    if (!item) return res.status(404).json({ error: 'Not found' });
    const payload = { event: 'webhook.test', sent_at: new Date().toISOString() };
    try {
      const resp = await fetch(item.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(item.headers || {}) },
        body: JSON.stringify(payload)
      });
      res.json({ delivered: resp.ok, status: resp.status });
    } catch (err) {
      res.json({ delivered: false, error: err.message });
    }
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
