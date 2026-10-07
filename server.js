// server.js
// Entry point. Run with: npm start
// Server starts on http://localhost:3001

require('dotenv').config(); // loads SONAR_TOKEN, SONAR_PROJECT_KEY, SESSION_SECRET from .env

const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const session = require('express-session');

const authRoutes = require('./routes/auth');
const taskRoutes = require('./routes/tasks');
const developerRoutes = require('./routes/developers');
const metricsRoutes = require('./routes/metrics');
const bugRoutes = require('./routes/bugs');
const achievementRoutes = require('./routes/achievements');
const collaborationRoutes = require('./routes/collaborations');
const checkinRoutes = require('./routes/checkins');
const timeLogRoutes = require('./routes/timeLogs');
const recommendationRoutes = require('./routes/recommendations');
const userManagementRoutes = require('./routes/users');
const requireAuth = require('./middleware/requireAuth');
const requireRole = require('./middleware/requireRole');

const app = express();
const PORT = process.env.PORT || 3001;

// Session secret comes from the environment, never from source code.
// If it isn't set, a random one is generated for this run (sessions will
// reset whenever the server restarts). Set SESSION_SECRET in .env to keep
// sessions across restarts.
const sessionSecret = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

// Serve the dashboard frontend (public/index.html, styles.css, app.js, login.html).
// Declared BEFORE the session middleware so static files (CSS, JS, images)
// don't trigger session handling on every request.
app.use(express.static('public'));

app.use(cors({
  origin: true,
  credentials: true, // required so the session cookie is sent/accepted
}));
app.use(express.json());

app.use(session({
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 8, // 8 hour session
  },
}));

// Auth routes are public (you need to be able to log in before you're logged in)
app.use('/api/auth', authRoutes);

// Everything else requires a logged-in session
app.use('/api/tasks', requireAuth, taskRoutes);
app.use('/api/developers', requireAuth, developerRoutes);
app.use('/api/metrics', requireAuth, metricsRoutes);
app.use('/api/bugs', requireAuth, bugRoutes);
app.use('/api/achievements', requireAuth, achievementRoutes);
app.use('/api/collaborations', requireAuth, collaborationRoutes);
app.use('/api/checkins', requireAuth, checkinRoutes);
app.use('/api/time-logs', requireAuth, timeLogRoutes);
app.use('/api/recommendations', requireAuth, recommendationRoutes);

// Admin-only: account management (create/edit/delete user logins)
app.use('/api/users', requireAuth, requireRole('admin'), userManagementRoutes);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  if (!process.env.SESSION_SECRET) {
    console.log('Note: SESSION_SECRET not set — using a temporary random secret. Logins will reset when the server restarts. See .env.example.');
  }
  if (!process.env.SONAR_TOKEN) {
    console.log('Note: SONAR_TOKEN not set — Quality Impact / Technical Debt Exposure will show partial data. See .env.example.');
  }
});