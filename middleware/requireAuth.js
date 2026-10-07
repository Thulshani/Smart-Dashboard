// middleware/requireAuth.js
// Blocks a route unless the request has a valid logged-in session.
// Also attaches the user's full record (id, username, role, developer_id)
// to req.user, so downstream routes/middleware don't need to re-query.

const db = require('../db');

function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Not logged in' });
  }

  const user = db.prepare(
      'SELECT id, username, role, developer_id FROM users WHERE id = ?'
  ).get(req.session.userId);

  if (!user) {
    // Session points at a user that no longer exists (e.g. deleted by an admin)
    return res.status(401).json({ error: 'Not logged in' });
  }

  req.user = user;
  next();
}

module.exports = requireAuth;