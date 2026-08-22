// middleware/requireAuth.js
// Blocks a route unless the request has a valid logged-in session.
// Apply this to any route that should only work for signed-in users.

function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Not logged in' });
  }
  next();
}

module.exports = requireAuth;
