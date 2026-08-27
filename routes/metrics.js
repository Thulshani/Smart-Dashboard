// routes/metrics.js
// This is where raw data (tasks, bugs, SonarCloud measures) gets turned into
// dashboard numbers. Add one new calculation + one new route entry per
// metric as you build them.

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
const { fetchSonarMeasures } = require('../services/sonarClient');
const { fetchCiRuns } = require('../services/githubClient');

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

// GET /api/metrics/summary — everything the dashboard needs in one call
router.get('/summary', async (req, res) => {
  const tasks = db.prepare('SELECT * FROM tasks').all();
  const bugs = db.prepare('SELECT * FROM bugs').all();
  const achievements = db.prepare('SELECT * FROM achievements').all();
  const collaborations = db.prepare('SELECT * FROM collaborations').all();
  const sonarMeasures = await fetchSonarMeasures();
  const ciRuns = await fetchCiRuns();

  const deliveryReliability = calculateDeliveryReliability(tasks);
  const defectPrevention = calculateDefectPrevention(bugs);
  const qualityImpactResult = calculateQualityImpactScore(sonarMeasures, bugs);
  const technicalDebtExposure = calculateTechnicalDebtExposure(sonarMeasures);
  const focusStability = calculateFocusStability(tasks);
  const learningGrowth = calculateLearningGrowth(achievements);
  const collaborationIndex = calculateCollaborationIndex(collaborations);
  const automationStrengthResult = calculateAutomationStrength(sonarMeasures, ciRuns);

  res.json({
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
  });
});

module.exports = router;