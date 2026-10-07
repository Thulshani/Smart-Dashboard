// routes/auth.js
// Handles login using sessions (not JWT) — simplest approach for a
// same-origin frontend like this one. The session cookie is set
// automatically by express-session once req.session.userId is set.
//
// Account CREATION is handled separately in routes/users.js, restricted
// to Admins only — there is no public self-signup, by design (see
// dissertation Chapter 3 for the rationale: role-based access control).

const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const db = require('../db');

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

  res.json({ id: user.id, username: user.username, role: user.role, developer_id: user.developer_id });
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.status(204).send();
  });
});

// GET /api/auth/me — used by the frontend to check "am I logged in?"
// and to decide which view (manager dashboard vs developer activity page)
// to show.
router.get('/me', (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Not logged in' });
  }
  const user = db.prepare(
      'SELECT id, username, role, developer_id FROM users WHERE id = ?'
  ).get(req.session.userId);
  if (!user) {
    return res.status(401).json({ error: 'Not logged in' });
  }
  res.json(user);
});

module.exports = router;