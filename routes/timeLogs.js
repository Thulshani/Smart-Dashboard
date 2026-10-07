// routes/timeLogs.js
// Simple clock-in / clock-out time tracking. developer_id always comes
// from the logged-in user's session (req.user.developer_id), same
// hardening pattern as achievements/collaborations/checkins — nobody can
// clock in as someone else.

const express = require('express');
const router = express.Router();
const db = require('../db');

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

// GET /api/time-logs?from=&to=&developer_id=  — list entries (manager/admin use, or self)
router.get('/', (req, res) => {
  const { from, to, developer_id } = req.query;
  let clause = '';
  const params = [];
  if (from) { clause += ' AND work_date >= ?'; params.push(from); }
  if (to) { clause += ' AND work_date <= ?'; params.push(to); }
  if (developer_id) { clause += ' AND developer_id = ?'; params.push(developer_id); }
  const logs = db.prepare(`SELECT * FROM time_logs WHERE 1=1${clause} ORDER BY start_time DESC`).all(...params);
  res.json(logs);
});

// GET /api/time-logs/status — is the current user clocked in right now?
router.get('/status', (req, res) => {
  const developer_id = req.user.developer_id;
  if (!developer_id) {
    return res.json({ clockedIn: false, reason: 'Your account is not linked to a developer profile' });
  }
  const open = db.prepare(
    'SELECT * FROM time_logs WHERE developer_id = ? AND end_time IS NULL ORDER BY start_time DESC LIMIT 1'
  ).get(developer_id);
  res.json({ clockedIn: Boolean(open), openEntry: open || null });
});

// POST /api/time-logs/clock-in
router.post('/clock-in', (req, res) => {
  const developer_id = req.user.developer_id;
  if (!developer_id) {
    return res.status(400).json({ error: 'Your account is not linked to a developer profile — ask an admin to link it' });
  }

  const existingOpen = db.prepare(
    'SELECT id FROM time_logs WHERE developer_id = ? AND end_time IS NULL'
  ).get(developer_id);
  if (existingOpen) {
    return res.status(409).json({ error: 'You are already clocked in — clock out first' });
  }

  const now = new Date().toISOString();
  const result = db.prepare(
    'INSERT INTO time_logs (developer_id, work_date, start_time) VALUES (?, ?, ?)'
  ).run(developer_id, todayDate(), now);

  const created = db.prepare('SELECT * FROM time_logs WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(created);
});

// POST /api/time-logs/clock-out
router.post('/clock-out', (req, res) => {
  const developer_id = req.user.developer_id;
  if (!developer_id) {
    return res.status(400).json({ error: 'Your account is not linked to a developer profile' });
  }

  const open = db.prepare(
    'SELECT * FROM time_logs WHERE developer_id = ? AND end_time IS NULL ORDER BY start_time DESC LIMIT 1'
  ).get(developer_id);
  if (!open) {
    return res.status(409).json({ error: 'You are not currently clocked in' });
  }

  const now = new Date();
  const start = new Date(open.start_time);
  const hoursWorked = Math.round(((now - start) / (1000 * 60 * 60)) * 100) / 100;

  db.prepare('UPDATE time_logs SET end_time = ?, hours_worked = ? WHERE id = ?')
    .run(now.toISOString(), hoursWorked, open.id);

  const updated = db.prepare('SELECT * FROM time_logs WHERE id = ?').get(open.id);
  res.json(updated);
});

module.exports = router;
