// routes/recommendations.js
// Managers/Admins send targeted recommendations tied to a specific metric
// for a specific developer (e.g. "your Focus Stability is low, here's what
// to try"). Developers can only ever see recommendations sent to THEM —
// never to anyone else, and they can't send or delete any.

const express = require('express');
const router = express.Router();
const db = require('../db');

function isManagerOrAdmin(user) {
  return user.role === 'manager' || user.role === 'admin';
}

// GET /api/recommendations?developer_id=123
// Developers/QA: always scoped to their own linked profile, regardless of
// what (if anything) is passed in the query string.
// Managers/Admins: can view any developer's recommendations by passing
// developer_id; omitting it returns an empty list (there's no "all" view
// for a feed of personal notes).
router.get('/', (req, res) => {
  let targetDeveloperId = req.query.developer_id;

  if (!isManagerOrAdmin(req.user)) {
    targetDeveloperId = req.user.developer_id;
  }

  if (!targetDeveloperId) {
    return res.json([]);
  }

  const recs = db.prepare(
    `SELECT r.*, u.username AS manager_username
     FROM recommendations r
     LEFT JOIN users u ON r.manager_id = u.id
     WHERE r.developer_id = ?
     ORDER BY r.created_at DESC`
  ).all(targetDeveloperId);
  res.json(recs);
});

// POST /api/recommendations — Manager/Admin only
// body: { developer_id, metric_key, message }
router.post('/', (req, res) => {
  if (!isManagerOrAdmin(req.user)) {
    return res.status(403).json({ error: 'Only managers can send recommendations' });
  }

  const { developer_id, metric_key, message } = req.body;
  if (!developer_id || !metric_key || !message || !message.trim()) {
    return res.status(400).json({ error: 'developer_id, metric_key, and message are required' });
  }

  const dev = db.prepare('SELECT id FROM developers WHERE id = ?').get(developer_id);
  if (!dev) {
    return res.status(400).json({ error: 'developer_id does not match an existing developer' });
  }

  const stmt = db.prepare(
    'INSERT INTO recommendations (developer_id, manager_id, metric_key, message) VALUES (?, ?, ?, ?)'
  );
  const result = stmt.run(developer_id, req.user.id, metric_key, message.trim());

  const created = db.prepare('SELECT * FROM recommendations WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(created);
});

// DELETE /api/recommendations/:id — Manager/Admin only
router.delete('/:id', (req, res) => {
  if (!isManagerOrAdmin(req.user)) {
    return res.status(403).json({ error: 'Only managers can remove recommendations' });
  }
  db.prepare('DELETE FROM recommendations WHERE id = ?').run(req.params.id);
  res.status(204).send();
});

module.exports = router;
