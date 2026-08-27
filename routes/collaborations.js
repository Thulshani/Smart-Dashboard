// routes/collaborations.js
// Simple self-logging for Collaboration Index: PR reviews, helping
// teammates, shared tasks. Same one-tap-logging pattern as achievements.js.

const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/collaborations — list everything logged
router.get('/', (req, res) => {
  const collaborations = db.prepare('SELECT * FROM collaborations ORDER BY created_at DESC').all();
  res.json(collaborations);
});

// POST /api/collaborations — log a new one
// body: { developer_id, type: 'review'|'help'|'shared', note }
router.post('/', (req, res) => {
  const { developer_id, type, note } = req.body;

  const validTypes = ['review', 'help', 'shared'];
  if (!validTypes.includes(type)) {
    return res.status(400).json({ error: `type must be one of: ${validTypes.join(', ')}` });
  }
  if (!developer_id) {
    return res.status(400).json({ error: 'developer_id is required' });
  }

  const stmt = db.prepare(
    'INSERT INTO collaborations (developer_id, type, note) VALUES (?, ?, ?)'
  );
  const result = stmt.run(developer_id, type, note || null);

  const created = db.prepare('SELECT * FROM collaborations WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(created);
});

// DELETE /api/collaborations/:id
router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM collaborations WHERE id = ?').run(req.params.id);
  res.status(204).send();
});

module.exports = router;
