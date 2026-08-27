// server.js
// Entry point. Run with: npm start
// Server starts on http://localhost:3001

require('dotenv').config(); // loads SONAR_TOKEN, SONAR_PROJECT_KEY from .env

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
const requireAuth = require('./middleware/requireAuth');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: true,
  credentials: true, // required so the session cookie is sent/accepted
}));
app.use(express.json());

app.use(session({
  secret: 'dev-only-secret-change-this-before-real-deployment',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
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

// Serve the dashboard frontend (public/index.html, styles.css, app.js, login.html)
app.use(express.static('public'));

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  if (!process.env.SONAR_TOKEN) {
    console.log('Note: SONAR_TOKEN not set — Quality Impact / Technical Debt Exposure will show partial data. See .env.example.');
  }
});