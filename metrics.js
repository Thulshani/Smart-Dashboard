// routes/metrics.js
// This is where raw data (tasks, bugs, SonarCloud measures) gets turned into
// dashboard numbers. Add one new calculation + one new route entry per
// metric as you build them.
//
// Time filtering: /summary accepts optional ?from=YYYY-MM-DD&to=YYYY-MM-DD
// query params. Locally-tracked data (tasks, bugs, achievements,
// collaborations, checkins) gets filtered by created_at within that range.
// SonarCloud/GitHub data (coverage, debt, CI stability) are CURRENT
// SNAPSHOTS, not historical records, so they are not affected by the date
// filter — this is a known limitation, not a bug.
//
// Developer filtering: /summary also accepts an optional ?developer_id=
// query param. Each locally-tracked table links to a developer through a
// different column name, so DEVELOPER_COLUMN_BY_TABLE maps table -> column
// for that filter. Tables with no such link (none currently) are left
// unfiltered by developer.

const express = require('express');
const router = express.Router();
const db = require('../db');
const { calculateDeliveryReliability } = require('../metrics/deliveryReliability');
const { calculateDefectPrevention } = require('../metrics/defectPrevention');
const { calculateQualityImpactScore } = require('../metrics/qualityImpact');
const { calculateTechnicalDebtExposure } = require('../metrics/technicalDebtExposure');
const { calculateFocusStability } = require('../metrics/focusStability');
const { calculateLearningGrowth } = require('../metrics/learningGrowth');
const { calculateCollaborationIndex } = require('../metrics/collaborationIndex');
const { calculateAutomationStrength } = require('../metrics/automationStrength');
const { calculateBurnoutRisk } = require('../metrics/burnoutRisk');
const { fetchSonarMeasures } = require('../services/sonarClient');
const { fetchCiRuns, fetchRecentCommits } = require('../services/githubClient');

// Which column links each locally-tracked table back to a developer, so a
// ?developer_id= filter can be applied to it. Tasks use "assignee_id"
// (who it's assigned to); everything else logs "developer_id" directly.
const DEVELOPER_COLUMN_BY_TABLE = {
  tasks: 'assignee_id',
  bugs: 'reported_by',
  achievements: 'developer_id',
  collaborations: 'developer_id',
  wellbeing_checkins: 'developer_id',
};

// Builds a "WHERE created_at >= ? AND created_at <= ?" fragment plus the
// matching params, only including the parts the caller actually asked for.
function dateRangeFilter(req) {
  const { from, to } = req.query;
  let clause = '';
  const params = [];
  if (from) {
    clause += ' AND created_at >= ?';
    params.push(from);
  }
  if (to) {
    clause += ' AND created_at <= ?';
    params.push(`${to} 23:59:59`);
  }
  return { clause, params, active: Boolean(from || to) };
}

// Same as dateRangeFilter, but also applies ?developer_id= against
// whichever column links `table` back to a developer (see
// DEVELOPER_COLUMN_BY_TABLE above). Falls back to date-only filtering for
// tables with no developer link.
function rowFilter(table, req) {
  const range = dateRangeFilter(req);
  let clause = range.clause;
  const params = [...range.params];

  const { developer_id } = req.query;
  const developerColumn = DEVELOPER_COLUMN_BY_TABLE[table];
  if (developer_id && developerColumn) {
    clause += ` AND ${developerColumn} = ?`;
    params.push(developer_id);
  }

  return { clause, params, active: range.active || Boolean(developer_id && developerColumn) };
}

function queryWithRange(table, req) {
  const { clause, params } = rowFilter(table, req);
  return db.prepare(`SELECT * FROM ${table} WHERE 1=1${clause}`).all(...params);
}

// GET /api/metrics/delivery-reliability
router.get('/delivery-reliability', (req, res) => {
  const tasks = db.prepare('SELECT * FROM tasks').all();
  const result = calculateDeliveryReliability(tasks);
  res.json(result);
});

// GET /api/metrics/defect-prevention
router.get('/defect-prevention', (req, res) => {
  const bugs = db.prepare('SELECT * FROM bugs').all();
  const result = calculateDefectPrevention(bugs);
  res.json(result);
});

// GET /api/metrics/quality-impact
router.get('/quality-impact', async (req, res) => {
  const bugs = db.prepare('SELECT * FROM bugs').all();
  const sonarMeasures = await fetchSonarMeasures();
  const result = calculateQualityImpactScore(sonarMeasures, bugs);
  res.json(result);
});

// GET /api/metrics/technical-debt-exposure
router.get('/technical-debt-exposure', async (req, res) => {
  const sonarMeasures = await fetchSonarMeasures();
  const result = calculateTechnicalDebtExposure(sonarMeasures);
  res.json(result);
});

// GET /api/metrics/focus-stability
router.get('/focus-stability', (req, res) => {
  const tasks = db.prepare('SELECT * FROM tasks').all();
  const result = calculateFocusStability(tasks);
  res.json(result);
});

// GET /api/metrics/learning-growth
router.get('/learning-growth', (req, res) => {
  const achievements = db.prepare('SELECT * FROM achievements').all();
  const result = calculateLearningGrowth(achievements);
  res.json(result);
});

// GET /api/metrics/collaboration-index
router.get('/collaboration-index', (req, res) => {
  const collaborations = db.prepare('SELECT * FROM collaborations').all();
  const result = calculateCollaborationIndex(collaborations);
  res.json(result);
});

// GET /api/metrics/automation-strength
router.get('/automation-strength', async (req, res) => {
  const sonarMeasures = await fetchSonarMeasures();
  const ciRuns = await fetchCiRuns();
  const result = calculateAutomationStrength(sonarMeasures, ciRuns);
  res.json(result);
});

// GET /api/metrics/burnout-risk
router.get('/burnout-risk', async (req, res) => {
  const tasks = db.prepare('SELECT * FROM tasks').all();
  const commits = await fetchRecentCommits();
  const checkins = db.prepare('SELECT * FROM wellbeing_checkins').all();
  const result = calculateBurnoutRisk(tasks, commits, checkins);
  res.json(result);
});

// GET /api/metrics/summary?from=YYYY-MM-DD&to=YYYY-MM-DD&developer_id=ID
// Everything the dashboard needs in one call. If from/to are provided,
// locally-tracked data is filtered to that window. If developer_id is
// provided, each locally-tracked table is additionally filtered down to
// that developer's rows (see DEVELOPER_COLUMN_BY_TABLE for how each table
// links to a developer). See note at top of file re: SonarCloud/GitHub
// snapshot data not being filterable either way.
router.get('/summary', async (req, res) => {
  const range = rowFilter('bugs', req); // any table works here — just need `.active`

  const tasks = queryWithRange('tasks', req);
  const bugs = queryWithRange('bugs', req);
  const achievements = queryWithRange('achievements', req);
  const collaborations = queryWithRange('collaborations', req);
  const checkins = queryWithRange('wellbeing_checkins', req);

  const sonarMeasures = await fetchSonarMeasures();
  const ciRuns = await fetchCiRuns();
  const commits = await fetchRecentCommits();

  const deliveryReliability = calculateDeliveryReliability(tasks);
  const defectPrevention = calculateDefectPrevention(bugs);
  const qualityImpactResult = calculateQualityImpactScore(sonarMeasures, bugs);
  const technicalDebtExposure = calculateTechnicalDebtExposure(sonarMeasures);
  const focusStability = calculateFocusStability(tasks);
  const learningGrowth = calculateLearningGrowth(achievements);
  const collaborationIndex = calculateCollaborationIndex(collaborations);
  const automationStrengthResult = calculateAutomationStrength(sonarMeasures, ciRuns);
  const burnoutRiskResult = calculateBurnoutRisk(tasks, commits, checkins);

  res.json({
    __DEBUG_MARKER__: 'this-is-the-file-you-are-editing-v1',
    dateRangeApplied: range.active,
    deliveryReliability,
    defectPrevention,
    qualityImpact: {
      score: qualityImpactResult.score,
      message: qualityImpactResult.message,
      breakdown: qualityImpactResult.breakdown,
    },
    technicalDebtExposure: {
      score: technicalDebtExposure.score,
      message: technicalDebtExposure.message,
      level: technicalDebtExposure.level,
    },
    focusStability,
    learningGrowth,
    collaborationIndex,
    automationStrength: {
      score: automationStrengthResult.score,
      message: automationStrengthResult.message,
      breakdown: automationStrengthResult.breakdown,
    },
    burnoutRisk: {
      score: burnoutRiskResult.score,
      level: burnoutRiskResult.level,
      message: burnoutRiskResult.message,
      breakdown: burnoutRiskResult.breakdown,
    },
  });
});

module.exports = router;