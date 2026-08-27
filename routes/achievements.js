// routes/achievements.js
// Simple self-logging for Learning & Growth: courses, certifications, tools.
// Same one-tap-logging spirit as the Defect Radar — fast to log, no forms
// with a dozen fields.

const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/achievements — list everything logged (used by the metric + any UI)
router.get('/', (req, res) => {
  const achievements = db.prepare('SELECT * FROM achievements ORDER BY created_at DESC').all();
  res.json(achievements);
});

// POST /api/achievements — log a new one
// body: { developer_id, type: 'course'|'certification'|'tool', title }
router.post('/', (req, res) => {
  const { developer_id, type, title } = req.body;

  const validTypes = ['course', 'certification', 'tool'];
  if (!validTypes.includes(type)) {
    return res.status(400).json({ error: `type must be one of: ${validTypes.join(', ')}` });
  }
  if (!developer_id) {
    return res.status(400).json({ error: 'developer_id is required' });
  }

  const stmt = db.prepare(
    'INSERT INTO achievements (developer_id, type, title) VALUES (?, ?, ?)'
  );
  const result = stmt.run(developer_id, type, title || null);

  const created = db.prepare('SELECT * FROM achievements WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(created);
});

// DELETE /api/achievements/:id
router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM achievements WHERE id = ?').run(req.params.id);
  res.status(204).send();
});

module.exports = router;
