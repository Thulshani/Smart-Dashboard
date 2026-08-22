/**
 * Quality Impact Score (QIS)
 * ---------------------------------------------------------
 * Smart Developer & QA Performance Analytics Dashboard
 * Quality & Impact Metrics quadrant
 *
 * QIS = (0.25 * TCA) + (0.30 * BFP) + (0.25 * RC) + (0.20 * CIR)
 *
 *  TCA - Test Coverage Added
 *  BFP - Bugs Fixed Permanently
 *  RC  - Refactoring Contribution
 *  CIR - Code Improvement Rate
 *
 * Each sub-metric is normalized to a 0-100 scale before weighting,
 * so QIS is always a score out of 100.
 * ---------------------------------------------------------
 */

const WEIGHTS = {
  tca: 0.25,
  bfp: 0.30,
  rc: 0.25,
  cir: 0.20,
};

/** Clamp a number between 0 and 100. */
function clampScore(value) {
  return Math.max(0, Math.min(100, value));
}

/**
 * Test Coverage Added
 * @param {number} coveragePointsAdded - % coverage points gained this period
 * @param {number} sprintTarget - target % coverage points for the period
 */
function calcTCA(coveragePointsAdded, sprintTarget) {
  if (sprintTarget <= 0) return 0;
  return clampScore((coveragePointsAdded / sprintTarget) * 100);
}

/**
 * Bugs Fixed Permanently
 * @param {number} bugsStayedClosed - fixed bugs that did not reopen/regress
 * @param {number} totalBugsFixed - total bugs fixed in the period
 */
function calcBFP(bugsStayedClosed, totalBugsFixed) {
  if (totalBugsFixed <= 0) return 0;
  return clampScore((bugsStayedClosed / totalBugsFixed) * 100);
}

/**
 * Refactoring Contribution
 * @param {number} debtHoursReduced - technical-debt hours reduced (SonarQube etc.)
 * @param {number} sprintTarget - target debt-hours reduction for the period
 */
function calcRC(debtHoursReduced, sprintTarget) {
  if (sprintTarget <= 0) return 0;
  return clampScore((debtHoursReduced / sprintTarget) * 100);
}

/**
 * Code Improvement Rate
 * @param {number} approvedCleanly - commits/PRs approved without major revisions
 * @param {number} totalReviewed - total commits/PRs reviewed
 */
function calcCIR(approvedCleanly, totalReviewed) {
  if (totalReviewed <= 0) return 0;
  return clampScore((approvedCleanly / totalReviewed) * 100);
}

/**
 * Compute the full Quality Impact Score.
 * @param {Object} input
 * @param {number} input.coveragePointsAdded
 * @param {number} input.coverageSprintTarget
 * @param {number} input.bugsStayedClosed
 * @param {number} input.totalBugsFixed
 * @param {number} input.debtHoursReduced
 * @param {number} input.debtSprintTarget
 * @param {number} input.approvedCleanly
 * @param {number} input.totalReviewed
 * @returns {{ tca:number, bfp:number, rc:number, cir:number, qis:number }}
 */
function calculateQualityImpactScore(input) {
  const tca = calcTCA(input.coveragePointsAdded, input.coverageSprintTarget);
  const bfp = calcBFP(input.bugsStayedClosed, input.totalBugsFixed);
  const rc = calcRC(input.debtHoursReduced, input.debtSprintTarget);
  const cir = calcCIR(input.approvedCleanly, input.totalReviewed);

  const qis =
    WEIGHTS.tca * tca +
    WEIGHTS.bfp * bfp +
    WEIGHTS.rc * rc +
    WEIGHTS.cir * cir;

  return {
    tca: Math.round(tca * 10) / 10,
    bfp: Math.round(bfp * 10) / 10,
    rc: Math.round(rc * 10) / 10,
    cir: Math.round(cir * 10) / 10,
    qis: Math.round(qis * 10) / 10,
  };
}

// ---------------------------------------------------------
// Demo / worked example (matches the ~85/100 target)
// ---------------------------------------------------------
if (require.main === module) {
  const example = calculateQualityImpactScore({
    coveragePointsAdded: 4.5,
    coverageSprintTarget: 5,
    bugsStayedClosed: 19,
    totalBugsFixed: 20,
    debtHoursReduced: 7,
    debtSprintTarget: 10,
    approvedCleanly: 16,
    totalReviewed: 20,
  });

  console.log("Quality Impact Score breakdown:");
  console.log(`  Test Coverage Added (TCA): ${example.tca}`);
  console.log(`  Bugs Fixed Permanently (BFP): ${example.bfp}`);
  console.log(`  Refactoring Contribution (RC): ${example.rc}`);
  console.log(`  Code Improvement Rate (CIR): ${example.cir}`);
  console.log(`  --> Quality Impact Score: ${example.qis}/100`);
}

module.exports = {
  calculateQualityImpactScore,
  calcTCA,
  calcBFP,
  calcRC,
  calcCIR,
  WEIGHTS,
};
