// routes/developers.js
// Minimal developer list — tasks reference these via assignee_id.

const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/developers
router.get('/', (req, res) => {
  const developers = db.prepare('SELECT * FROM developers').all();
  res.json(developers);
});

// POST /api/developers
router.post('/', (req, res) => {
  const { name, role } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  const result = db.prepare('INSERT INTO developers (name, role) VALUES (?, ?)')
    .run(name, role || 'developer');

  const newDev = db.prepare('SELECT * FROM developers WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(newDev);
});

module.exports = router;
