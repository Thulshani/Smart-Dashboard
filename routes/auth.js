// routes/auth.js
// Handles account creation and login using sessions (not JWT) — simplest
// approach for a same-origin frontend like this one. The session cookie
// is set automatically by express-session once req.session.userId is set.

const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const db = require('../db');

const SALT_ROUNDS = 10;

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'username and password are required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'password must be at least 6 characters' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    return res.status(409).json({ error: 'username already taken' });
  }

  const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

  const result = db.prepare(
    'INSERT INTO users (username, password_hash) VALUES (?, ?)'
  ).run(username, password_hash);

  req.session.userId = result.lastInsertRowid;

  res.status(201).json({ id: result.lastInsertRowid, username });
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'username and password are required' });
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user) {
    return res.status(401).json({ error: 'invalid username or password' });
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'invalid username or password' });
  }

  req.session.userId = user.id;

  res.json({ id: user.id, username: user.username, role: user.role });
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.status(204).send();
  });
});

// GET /api/auth/me — used by the frontend to check "am I logged in?"
router.get('/me', (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Not logged in' });
  }
  const user = db.prepare('SELECT id, username, role FROM users WHERE id = ?').get(req.session.userId);
  if (!user) {
    return res.status(401).json({ error: 'Not logged in' });
  }
  res.json(user);
});

module.exports = router;
