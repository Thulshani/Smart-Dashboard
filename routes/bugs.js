// routes/bugs.js
// JIRA-style bug logging: title, description, severity, and who reported
// it — on top of the original "caught before release / escaped to prod"
// outcome, which is what actually feeds Defect Prevention.

const express = require('express');
const router = express.Router();
const db = require('../db');

// POST /api/bugs — log a bug
// body: { title, description?, severity, found_in_testing (0 or 1), task_id? }
//
// reported_by comes from the logged-in user's linked developer profile,
// not the client — same hardening pattern as achievements/collaborations.
// Falls back to an explicit body.reported_by only for accounts with no
// link (e.g. a Manager logging on someone's behalf).
router.post('/', (req, res) => {
  const { title, description, severity, found_in_testing, task_id } = req.body;
  const reported_by = req.user.developer_id || req.body.reported_by || null;

  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'title is required' });
  }
  if (found_in_testing === undefined) {
    return res.status(400).json({ error: 'found_in_testing is required (0 or 1)' });
  }

  const validSeverities = ['low', 'medium', 'high'];
  const finalSeverity = validSeverities.includes(severity) ? severity : 'medium';

  const stmt = db.prepare(`
    INSERT INTO bugs (task_id, found_in_testing, severity, title, description, reported_by, status)
    VALUES (?, ?, ?, ?, ?, ?, 'open')
  `);
  const result = stmt.run(
      task_id || null,
      found_in_testing ? 1 : 0,
      finalSeverity,
      title.trim(),
      description ? description.trim() : null,
      reported_by
  );

  const bug = db.prepare(`
    SELECT b.*, d.name AS reported_by_name
    FROM bugs b
    LEFT JOIN developers d ON b.reported_by = d.id
    WHERE b.id = ?
  `).get(result.lastInsertRowid);
  res.status(201).json(bug);
});

// PUT /api/bugs/:id — mark resolved/reopened
// body: { status: 'open' | 'resolved' }
router.put('/:id', (req, res) => {
  const { status } = req.body;
  if (!['open', 'resolved'].includes(status)) {
    return res.status(400).json({ error: "status must be 'open' or 'resolved'" });
  }
  db.prepare('UPDATE bugs SET status = ? WHERE id = ?').run(status, req.params.id);
  const updated = db.prepare('SELECT * FROM bugs WHERE id = ?').get(req.params.id);
  res.json(updated);
});

// GET /api/bugs — list all bugs, most recent first, with reporter name joined in
router.get('/', (req, res) => {
  const bugs = db.prepare(`
    SELECT b.*, d.name AS reported_by_name
    FROM bugs b
    LEFT JOIN developers d ON b.reported_by = d.id
    ORDER BY b.created_at DESC
  `).all();
  res.json(bugs);
});

module.exports = router;