// routes/bugs.js
const express = require('express');
const router = express.Router();
const db = require('../db');

// POST /api/bugs — log a bug
// body: { task_id?, found_in_testing (0 or 1), severity? }
router.post('/', (req, res) => {
  const { task_id, found_in_testing, severity } = req.body;

  if (found_in_testing === undefined) {
    return res.status(400).json({ error: 'found_in_testing is required (0 or 1)' });
  }

  const stmt = db.prepare(`
    INSERT INTO bugs (task_id, found_in_testing, severity)
    VALUES (?, ?, ?)
  `);
  const result = stmt.run(
    task_id || null,
    found_in_testing ? 1 : 0,
    severity || 'medium'
  );

  const bug = db.prepare(`SELECT * FROM bugs WHERE id = ?`).get(result.lastInsertRowid);
  res.status(201).json(bug);
});

// GET /api/bugs — list all bugs
router.get('/', (req, res) => {
  const bugs = db.prepare(`SELECT * FROM bugs ORDER BY created_at DESC`).all();
  res.json(bugs);
});

module.exports = router;
