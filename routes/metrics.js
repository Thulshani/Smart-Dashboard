// routes/metrics.js
// This is where raw data (tasks, bugs) gets turned into dashboard numbers.
// Add one new calculation + one new route entry per metric as you build them.

const express = require('express');
const router = express.Router();
const db = require('../db');
const { calculateDeliveryReliability } = require('../metrics/deliveryReliability');
const { calculateDefectPrevention } = require('../metrics/defectPrevention');

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

// GET /api/metrics/summary — everything the dashboard needs in one call
router.get('/summary', (req, res) => {
  const tasks = db.prepare('SELECT * FROM tasks').all();
  const bugs = db.prepare('SELECT * FROM bugs').all();

  const deliveryReliability = calculateDeliveryReliability(tasks);
  const defectPrevention = calculateDefectPrevention(bugs);

  res.json({
    deliveryReliability,
    defectPrevention,
    // qualityImpact, focusStability, etc. get added here as you build them
  });
});

module.exports = router;