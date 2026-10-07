// routes/metrics.js
// This is where raw data (tasks, bugs, SonarCloud measures) gets turned into
// dashboard numbers. Add one new calculation + one new route entry per
// metric as you build them.
//
// Time filtering: /summary accepts optional ?from=YYYY-MM-DD&to=YYYY-MM-DD
// query params. Locally-tracked data (tasks, bugs, achievements,
// collaborations, checkins, time_logs) gets filtered by created_at (or
// work_date for time_logs) within that range. GitHub commit data (used by
// Burnout Risk's late-night-activity signal) also respects this range via
// since/until on the GitHub API.
//
// SonarCloud and GitHub Actions only ever expose the CURRENT state of the
// codebase/pipeline — there's no historical snapshot store behind them.
// Rather than silently show today's live numbers for an unrelated historical
// query, dateRangeExcludesToday()/getSonarMeasuresForRequest()/
// getCiRunsForRequest() below detect when the selected range doesn't include
// today and substitute the same graceful "unavailable" result these services
// already return when not configured, so Quality Impact, Technical Debt
// Exposure, and Automation Strength correctly read as "no data" for a purely
// historical filter instead of showing a misleading current value.
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
  time_logs: 'developer_id',
};

// Builds a "WHERE created_at >= ? AND created_at <= ?" fragment plus the
// matching params, only including the parts the caller actually asked for.
// dateColumn lets callers (e.g. time_logs, which uses work_date instead of
// created_at) point the range at a different column.
function dateRangeFilter(req, dateColumn = 'created_at') {
  const { from, to } = req.query;
  let clause = '';
  const params = [];
  if (from) {
    clause += ` AND ${dateColumn} >= ?`;
    params.push(from);
  }
  if (to) {
    clause += ` AND ${dateColumn} <= ?`;
    params.push(dateColumn === 'created_at' ? `${to} 23:59:59` : to);
  }
  return { clause, params, active: Boolean(from || to) };
}

// Same as dateRangeFilter, but also applies ?developer_id= against
// whichever column links `table` back to a developer (see
// DEVELOPER_COLUMN_BY_TABLE above). Falls back to date-only filtering for
// tables with no developer link.
function rowFilter(table, req, dateColumn = 'created_at') {
  const range = dateRangeFilter(req, dateColumn);
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

function queryWithRange(table, req, dateColumn = 'created_at') {
  const { clause, params } = rowFilter(table, req, dateColumn);
  return db.prepare(`SELECT * FROM ${table} WHERE 1=1${clause}`).all(...params);
}

function toDateOnly(d) {
  return d.toISOString().slice(0, 10);
}

// SonarCloud and GitHub Actions only ever report the CURRENT state of the
// codebase/pipeline — there's no historical snapshot store to query. That
// current state is only a fair answer when the selected date range actually
// includes today; for a purely historical range (like a test filter of
// 2000-02-22 to 2000-02-25), showing today's live numbers would be
// misleading. This returns true when the active ?from/?to range excludes
// today, so callers can substitute an "unavailable" result instead.
function dateRangeExcludesToday(req) {
  const { from, to } = req.query;
  if (!from && !to) return false; // no filter set -> always show the live snapshot
  const today = toDateOnly(new Date());
  if (from && today < from) return true;
  if (to && today > to) return true;
  return false;
}

const SONAR_UNAVAILABLE_HISTORICAL = {
  available: false,
  reason: 'No snapshot data for this historical date range — SonarCloud only reports the current code state',
  coverage: null,
  debtRatio: null,
  codeSmells: null,
  duplicatedLinesDensity: null,
  reliabilityScore: null,
  bugs: null,
};

const CI_UNAVAILABLE_HISTORICAL = {
  available: false,
  reason: 'No snapshot data for this historical date range — CI run history reflects current runs only',
  successRate: null,
  totalRuns: 0,
};

// Wraps fetchSonarMeasures()/fetchCiRuns() so a purely historical date
// filter gets the same graceful "unavailable" shape those services already
// return when not configured, instead of today's real snapshot.
async function getSonarMeasuresForRequest(req) {
  if (dateRangeExcludesToday(req)) return SONAR_UNAVAILABLE_HISTORICAL;
  return fetchSonarMeasures();
}

async function getCiRunsForRequest(req) {
  if (dateRangeExcludesToday(req)) return CI_UNAVAILABLE_HISTORICAL;
  return fetchCiRuns();
}

// time_logs + the number of days they're scoped to, for the burnout
// overtime signal. When the dashboard has a ?from/?to filter set, this uses
// that exact range (so a historical window with no logged hours correctly
// scores 0 instead of reflecting today's activity). With no filter, it
// defaults to the last 7 days ending today, matching a standard work week.
function getTimeLogsForBurnout(req) {
  const { from, to } = req.query;
  let startDate, endDate;

  if (from || to) {
    endDate = to || toDateOnly(new Date());
    startDate = from || endDate;
  } else {
    endDate = toDateOnly(new Date());
    startDate = toDateOnly(new Date(Date.now() - 6 * 24 * 60 * 60 * 1000)); // last 7 days inclusive
  }

  const periodDays = Math.max(
      1,
      Math.round((new Date(endDate) - new Date(startDate)) / (24 * 60 * 60 * 1000)) + 1
  );

  let clause = ' AND work_date >= ? AND work_date <= ?';
  const params = [startDate, endDate];

  const { developer_id } = req.query;
  if (developer_id) {
    clause += ' AND developer_id = ?';
    params.push(developer_id);
  }

  const timeLogs = db.prepare(`SELECT * FROM time_logs WHERE 1=1${clause}`).all(...params);
  return { timeLogs, periodDays };
}

// GET /api/metrics/delivery-reliability
router.get('/delivery-reliability', (req, res) => {
  const tasks = db.prepare('SELECT * FROM tasks').all();
  const result = calculateDeliveryReliability(tasks);
  res.json(result);
});

// GET /api/metrics/defect-prevention
router.get('/defect-prevention', (req, res) => {
  const bugs = queryWithRange('bugs', req);
  const result = calculateDefectPrevention(bugs);
  res.json(result);
});

// GET /api/metrics/quality-impact
router.get('/quality-impact', async (req, res) => {
  const bugs = queryWithRange('bugs', req);
  const sonarMeasures = await getSonarMeasuresForRequest(req);
  const result = calculateQualityImpactScore(sonarMeasures, bugs);
  res.json(result);
});

// GET /api/metrics/technical-debt-exposure
router.get('/technical-debt-exposure', async (req, res) => {
  const sonarMeasures = await getSonarMeasuresForRequest(req);
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
  const sonarMeasures = await getSonarMeasuresForRequest(req);
  const ciRuns = await getCiRunsForRequest(req);
  const result = calculateAutomationStrength(sonarMeasures, ciRuns);
  res.json(result);
});

// GET /api/metrics/burnout-risk
router.get('/burnout-risk', async (req, res) => {
  const tasks = db.prepare('SELECT * FROM tasks').all();
  const commits = await fetchRecentCommits(req.query.from, req.query.to);
  const checkins = db.prepare('SELECT * FROM wellbeing_checkins').all();
  const { timeLogs, periodDays } = getTimeLogsForBurnout(req);
  const result = calculateBurnoutRisk(tasks, commits, checkins, timeLogs, periodDays);
  res.json(result);
});

// GET /api/metrics/summary?from=YYYY-MM-DD&to=YYYY-MM-DD&developer_id=ID
// Everything the dashboard needs in one call. If from/to are provided,
// locally-tracked data is filtered to that window. If developer_id is
// provided, each locally-tracked table is additionally filtered down to
// that developer's rows (see DEVELOPER_COLUMN_BY_TABLE for how each table
// links to a developer). See note at top of file re: SonarCloud/GitHub
// snapshot data not being filterable either way. Burnout's overtime signal
// now follows the same from/to window (see getTimeLogsForBurnout); its
// late-night-commit signal stays a live snapshot like the other GitHub/Sonar
// metrics.
router.get('/summary', async (req, res) => {
  const range = rowFilter('bugs', req); // any table works here — just need `.active`

  const tasks = queryWithRange('tasks', req);
  const bugs = queryWithRange('bugs', req);
  const achievements = queryWithRange('achievements', req);
  const collaborations = queryWithRange('collaborations', req);
  const checkins = queryWithRange('wellbeing_checkins', req);
  const { timeLogs: recentTimeLogs, periodDays } = getTimeLogsForBurnout(req);

  const sonarMeasures = await getSonarMeasuresForRequest(req);
  const ciRuns = await getCiRunsForRequest(req);
  const commits = await fetchRecentCommits(req.query.from, req.query.to);

  const deliveryReliability = calculateDeliveryReliability(tasks);
  const defectPrevention = calculateDefectPrevention(bugs);
  const qualityImpactResult = calculateQualityImpactScore(sonarMeasures, bugs);
  const technicalDebtExposure = calculateTechnicalDebtExposure(sonarMeasures);
  const focusStability = calculateFocusStability(tasks);
  const learningGrowth = calculateLearningGrowth(achievements);
  const collaborationIndex = calculateCollaborationIndex(collaborations);
  const automationStrengthResult = calculateAutomationStrength(sonarMeasures, ciRuns);
  const burnoutRiskResult = calculateBurnoutRisk(tasks, commits, checkins, recentTimeLogs, periodDays);

  res.json({
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