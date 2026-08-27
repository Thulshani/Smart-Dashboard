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
const { fetchSonarMeasures } = require('../services/sonarClient');

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

// GET /api/metrics/summary — everything the dashboard needs in one call
router.get('/summary', async (req, res) => {
  const tasks = db.prepare('SELECT * FROM tasks').all();
  const bugs = db.prepare('SELECT * FROM bugs').all();
  const sonarMeasures = await fetchSonarMeasures();

  const deliveryReliability = calculateDeliveryReliability(tasks);
  const defectPrevention = calculateDefectPrevention(bugs);
  const qualityImpactResult = calculateQualityImpactScore(sonarMeasures, bugs);
  const technicalDebtExposure = calculateTechnicalDebtExposure(sonarMeasures);

  res.json({
    deliveryReliability,
    defectPrevention,
    // Flatten qualityImpact's { score, breakdown, message } shape to match
    // the { score, message } shape app.js already expects from other cards.
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
    // focusStability, etc. get added here as you build them
  });
});

module.exports = router;
