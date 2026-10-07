// routes/users.js
// Admin-only account management. This is where accounts actually get
// created now — there is no public self-signup (see routes/auth.js).
//
// All routes here must be mounted with requireAuth + requireRole('admin')
// in server.js.

const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const db = require('../db');

const SALT_ROUNDS = 10;
const VALID_ROLES = ['admin', 'manager', 'developer', 'qa'];

// GET /api/users — list all accounts (no password hashes returned)
router.get('/', (req, res) => {
  const users = db.prepare(`
    SELECT u.id, u.username, u.role, u.developer_id, u.created_at,
           d.name AS developer_name, d.employee_id AS employee_id
    FROM users u
    LEFT JOIN developers d ON u.developer_id = d.id
    ORDER BY u.created_at DESC
  `).all();
  res.json(users);
});

// POST /api/users — create a new account
// body: { username, password, role, employee_id?, developer_name? }
//
// For 'developer' or 'qa' roles, employee_id is required and is used to
// VALIDATE and link the account to a developer profile:
//   - if a developer with that employee_id already exists, the account
//     links to it (this is how account creation is "validated" against
//     a real employee record, not just a free-text name)
//   - if no developer with that employee_id exists yet, developer_name
//     must also be supplied, and a new developer profile is created and
//     linked in the same step
// For 'admin' or 'manager' roles, employee_id/developer_name are ignored.
router.post('/', async (req, res) => {
  const { username, password, role, employee_id, developer_name } = req.body;

  if (!username || !password || !role) {
    return res.status(400).json({ error: 'username, password, and role are required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'password must be at least 6 characters' });
  }
  if (!VALID_ROLES.includes(role)) {
    return res.status(400).json({ error: `role must be one of: ${VALID_ROLES.join(', ')}` });
  }

  const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existingUser) {
    return res.status(409).json({ error: 'username already taken' });
  }

  let developer_id = null;

  if (role === 'developer' || role === 'qa') {
    if (!employee_id || !employee_id.trim()) {
      return res.status(400).json({ error: 'employee_id is required for Developer/QA accounts' });
    }

    const existingDev = db.prepare('SELECT id FROM developers WHERE employee_id = ?').get(employee_id.trim());

    if (existingDev) {
      developer_id = existingDev.id;
    } else if (developer_name && developer_name.trim()) {
      const created = db.prepare(
          'INSERT INTO developers (name, role, employee_id) VALUES (?, ?, ?)'
      ).run(developer_name.trim(), role, employee_id.trim());
      developer_id = created.lastInsertRowid;
    } else {
      return res.status(400).json({
        error: `No developer found with Employee ID ${employee_id} — provide a name to create a new profile`,
      });
    }
  }

  const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

  const result = db.prepare(
      'INSERT INTO users (username, password_hash, role, developer_id) VALUES (?, ?, ?, ?)'
  ).run(username, password_hash, role, developer_id);

  res.status(201).json({ id: result.lastInsertRowid, username, role, developer_id });
});

// PUT /api/users/:id — update role or developer_id link
// body: { role?, developer_id? }
router.put('/:id', (req, res) => {
  const { role, developer_id } = req.body;
  const { id } = req.params;

  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
  if (!user) {
    return res.status(404).json({ error: 'user not found' });
  }

  if (role !== undefined) {
    if (!VALID_ROLES.includes(role)) {
      return res.status(400).json({ error: `role must be one of: ${VALID_ROLES.join(', ')}` });
    }
    db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, id);
  }

  if (developer_id !== undefined) {
    db.prepare('UPDATE users SET developer_id = ? WHERE id = ?').run(developer_id || null, id);
  }

  const updated = db.prepare(
      'SELECT id, username, role, developer_id FROM users WHERE id = ?'
  ).get(id);
  res.json(updated);
});

// DELETE /api/users/:id — remove an account
router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.status(204).send();
});

module.exports = router;