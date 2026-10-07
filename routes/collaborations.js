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
// body: { type }
//
// developer_id comes from the logged-in user's linked developer profile,
// not the client — same hardening as achievements.js.
router.post('/', (req, res) => {
  const { type } = req.body;
  const developer_id = req.user.developer_id || req.body.developer_id;

  const validTypes = ['review', 'help', 'shared'];
  if (!validTypes.includes(type)) {
    return res.status(400).json({ error: `type must be one of: ${validTypes.join(', ')}` });
  }
  if (!developer_id) {
    return res.status(400).json({ error: 'Your account is not linked to a developer profile — ask an admin to link it' });
  }

  const stmt = db.prepare(
      'INSERT INTO collaborations (developer_id, type, note) VALUES (?, ?, ?)'
  );
  const result = stmt.run(developer_id, type, req.body.note || null);

  const created = db.prepare('SELECT * FROM collaborations WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(created);
});

// DELETE /api/collaborations/:id
router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM collaborations WHERE id = ?').run(req.params.id);
  res.status(204).send();
});

module.exports = router;