// metrics/technicalDebtExposure.js
//
// Technical Debt Exposure Score — how much risky/complex/unrefactored code
// a developer is working with, sourced from SonarCloud's static analysis.
//
// Uses:
//   - sqale_debt_ratio (Debt Ratio %) — SonarCloud's own normalized 0-100 debt scale
//   - duplicated_lines_density — % of code that's duplicated
//   - code_smells — count of maintainability issues
//
// Exposure is reported both as a 0-100 score (higher = healthier, lower debt)
// and as a Low/Medium/High label, matching the original core-idea format.

function levelFromDebtRatio(debtRatio) {
  if (debtRatio === null) return 'Unknown';
  if (debtRatio < 5) return 'Low';
  if (debtRatio < 20) return 'Medium';
  return 'High';
}

function calculateTechnicalDebtExposure(sonarMeasures) {
  if (!sonarMeasures || !sonarMeasures.available) {
    return {
      score: null,
      level: 'Unknown',
      debtRatio: null,
      duplicatedLinesDensity: null,
      codeSmells: null,
      message: sonarMeasures?.reason || 'SonarCloud data not available',
    };
  }

  const debtRatio = sonarMeasures.debtRatio ?? 0;
  const duplication = sonarMeasures.duplicatedLinesDensity ?? 0;

  // Debt ratio is already 0-100 (lower = better), so invert it for the score.
  // Duplication is weighted in lightly since it's a secondary debt signal.
  const rawScore = 100 - (debtRatio * 0.8 + duplication * 0.2);
  const score = Math.round(Math.max(0, Math.min(100, rawScore)));

  return {
    score,
    level: levelFromDebtRatio(debtRatio),
    debtRatio,
    debtMinutes: sonarMeasures.debtMinutes ?? null,
    duplicatedLinesDensity: duplication,
    codeSmells: sonarMeasures.codeSmells ?? null,
    message: `${levelFromDebtRatio(debtRatio)} exposure — ${debtRatio}% debt ratio`,
  };
}

module.exports = { calculateTechnicalDebtExposure };