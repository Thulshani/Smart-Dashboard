// routes/developers.js
// Developer roster. employee_id is the real-world unique identifier used
// to validate and link accounts — see routes/users.js for how it's used
// during account creation.

const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/developers — list everyone
router.get('/', (req, res) => {
  const developers = db.prepare('SELECT * FROM developers ORDER BY name').all();
  res.json(developers);
});

// GET /api/developers/lookup?employee_id=EMP001 — check if an employee ID
// already has a profile, without creating anything. Used by the Manage
// Users form to show "found: Asha Perera" or "not found" as you type.
router.get('/lookup', (req, res) => {
  const { employee_id } = req.query;
  if (!employee_id) {
    return res.status(400).json({ error: 'employee_id is required' });
  }
  const dev = db.prepare('SELECT * FROM developers WHERE employee_id = ?').get(employee_id.trim());
  res.json({ found: Boolean(dev), developer: dev || null });
});

// POST /api/developers — create a new developer profile directly
// body: { name, role, employee_id }
router.post('/', (req, res) => {
  const { name, role, employee_id } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'name is required' });
  }
  if (!employee_id || !employee_id.trim()) {
    return res.status(400).json({ error: 'employee_id is required' });
  }

  const existing = db.prepare('SELECT id FROM developers WHERE employee_id = ?').get(employee_id.trim());
  if (existing) {
    return res.status(409).json({ error: `Employee ID ${employee_id} is already in use` });
  }

  const result = db.prepare(
      'INSERT INTO developers (name, role, employee_id) VALUES (?, ?, ?)'
  ).run(name.trim(), role || 'developer', employee_id.trim());

  const created = db.prepare('SELECT * FROM developers WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(created);
});

module.exports = router;