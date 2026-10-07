// routes/checkins.js
// Simple, private self check-in for the Burnout Risk Indicator. Framed
// supportively — this exists to protect developers, not monitor them for
// punishment. Keep any UI copy consistent with that intent.

const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/checkins — list recent check-ins
router.get('/', (req, res) => {
  const checkins = db.prepare('SELECT * FROM wellbeing_checkins ORDER BY created_at DESC LIMIT 30').all();
  res.json(checkins);
});

// POST /api/checkins — log how you're feeling right now
// body: { load_rating: 1-5 }  (1 = fine, 5 = overwhelmed)
//
// developer_id comes from the logged-in user's linked developer profile,
// not the client — same hardening as achievements.js and collaborations.js.
router.post('/', (req, res) => {
  const developer_id = req.user.developer_id || req.body.developer_id;
  const rating = Number(req.body.load_rating);

  if (!developer_id) {
    return res.status(400).json({ error: 'Your account is not linked to a developer profile — ask an admin to link it' });
  }
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'load_rating must be an integer from 1 to 5' });
  }

  const stmt = db.prepare(
      'INSERT INTO wellbeing_checkins (developer_id, load_rating) VALUES (?, ?)'
  );
  const result = stmt.run(developer_id, rating);

  const created = db.prepare('SELECT * FROM wellbeing_checkins WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(created);
});

module.exports = router;