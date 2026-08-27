// metrics/qualityImpact.js
//
// Quality Impact Score (QIS) — real data version.
//
// QIS = (0.25 * TCA) + (0.30 * BFP) + (0.25 * RC) + (0.20 * CIR)
//
//   TCA (Test Coverage Added)   <- SonarCloud "coverage" measure
//                                  Returns 0 by design if no test suite
//                                  exists yet — see project write-up.
//   BFP (Bugs Fixed Permanently) <- local bugs table (found_in_testing ratio),
//                                  a proxy until bug-reopen tracking is added
//   RC  (Refactoring Contribution) <- SonarCloud debt ratio, inverted
//   CIR (Code Improvement Rate)  <- SonarCloud reliability rating, converted
//
// This keeps the same weighting model documented in the methodology chapter;
// only the data sources for TCA/RC/CIR changed from placeholder inputs to
// real SonarCloud measures.

const WEIGHTS = { tca: 0.25, bfp: 0.30, rc: 0.25, cir: 0.20 };

function clampScore(value) {
  return Math.max(0, Math.min(100, value));
}

function calcTCA(sonarMeasures) {
  if (!sonarMeasures?.available || sonarMeasures.coverage === null) {
    return { score: 0, note: 'No test coverage data yet — add automated tests to populate this' };
  }
  return { score: clampScore(sonarMeasures.coverage), note: null };
}

function calcBFP(bugs) {
  const total = bugs.length;
  if (total === 0) {
    return { score: 0, note: 'No bugs logged yet' };
  }
  const caughtInTesting = bugs.filter((b) => b.found_in_testing === 1).length;
  return {
    score: clampScore((caughtInTesting / total) * 100),
    note: 'Proxy: bugs caught in testing ratio (reopen tracking not yet implemented)',
  };
}

function calcRC(sonarMeasures) {
  if (!sonarMeasures?.available || sonarMeasures.debtRatio === null) {
    return { score: 0, note: 'No SonarCloud debt data available' };
  }
  // Lower debt ratio = more/better refactoring maintained. 25%+ debt -> 0.
  const score = clampScore(100 - sonarMeasures.debtRatio * 4);
  return { score, note: null };
}

function calcCIR(sonarMeasures) {
  if (!sonarMeasures?.available || sonarMeasures.reliabilityScore === null) {
    return { score: 0, note: 'No SonarCloud reliability rating available' };
  }
  return { score: clampScore(sonarMeasures.reliabilityScore), note: null };
}

/**
 * @param {object} sonarMeasures - result of services/sonarClient.fetchSonarMeasures()
 * @param {Array}  bugs - rows from the bugs table
 */
function calculateQualityImpactScore(sonarMeasures, bugs) {
  const tca = calcTCA(sonarMeasures);
  const bfp = calcBFP(bugs);
  const rc = calcRC(sonarMeasures);
  const cir = calcCIR(sonarMeasures);

  const qis =
    WEIGHTS.tca * tca.score +
    WEIGHTS.bfp * bfp.score +
    WEIGHTS.rc * rc.score +
    WEIGHTS.cir * cir.score;

  return {
    score: Math.round(qis * 10) / 10,
    breakdown: {
      testCoverageAdded: tca,
      bugsFixedPermanently: bfp,
      refactoringContribution: rc,
      codeImprovementRate: cir,
    },
    message: sonarMeasures?.available
      ? `QIS ${Math.round(qis)}/100`
      : 'Partial score — SonarCloud not connected yet',
  };
}

module.exports = { calculateQualityImpactScore };
