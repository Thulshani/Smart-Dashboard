// middleware/requireRole.js
// Blocks a route unless the logged-in user's role is in the allowed list.
// Must be used AFTER requireAuth, since it reads req.user (set there).
//
// Usage: router.post('/', requireAuth, requireRole('admin'), handler)
//        router.get('/', requireAuth, requireRole('admin', 'manager'), handler)

function requireRole(...allowedRoles) {
  return function (req, res, next) {
    if (!req.user) {
      // Should never happen if requireAuth ran first, but fail safe
      return res.status(401).json({ error: 'Not logged in' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'You do not have permission to do this' });
    }
    next();
  };
}

module.exports = requireRole;
