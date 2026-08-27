// metrics/automationStrength.js
//
// Automation Strength Score — how solid the team's testing/CI automation
// is, combining:
//
//   Test Density      (proxy for "% automated test cases") <- SonarCloud
//                        tests count relative to lines of code
//   CI/CD Stability                                          <- GitHub
//                        Actions: % of recent workflow runs that passed
//   Test Reliability  (proxy for "flaky test rate", inverted) <- SonarCloud
//                        test_success_density from the last analysis
//
// Honest limitation: true flaky-test detection needs tracking the SAME
// test across many runs over time to see it flip pass/fail — that needs
// a dedicated test-history store, which isn't built yet. Test Reliability
// here is a same-run proxy, not true flakiness, and is labeled as such.

const WEIGHTS = { testDensity: 0.40, ciStability: 0.35, testReliability: 0.25 };

function clampScore(value) {
  return Math.max(0, Math.min(100, value));
}

function calcTestDensity(sonarMeasures) {
  if (!sonarMeasures?.available || sonarMeasures.tests === null || !sonarMeasures.linesOfCode) {
    return { score: 0, note: 'No test count or lines-of-code data from SonarCloud yet' };
  }
  // Target: 10 tests per 1,000 lines of code = 100. Adjust TARGET_PER_KLOC
  // as your codebase and testing conventions mature.
  const TARGET_PER_KLOC = 10;
  const testsPerKloc = (sonarMeasures.tests / sonarMeasures.linesOfCode) * 1000;
  return { score: clampScore((testsPerKloc / TARGET_PER_KLOC) * 100), note: null };
}

function calcCiStability(ciRuns) {
  if (!ciRuns?.available || ciRuns.successRate === null) {
    return { score: 0, note: ciRuns?.reason || 'No completed CI runs yet' };
  }
  return { score: clampScore(ciRuns.successRate), note: null };
}

function calcTestReliability(sonarMeasures) {
  if (!sonarMeasures?.available || sonarMeasures.testSuccessDensity === null) {
    return { score: 0, note: 'No test execution data from SonarCloud yet (proxy for flaky rate)' };
  }
  return { score: clampScore(sonarMeasures.testSuccessDensity), note: 'Proxy: last-run pass rate, not true flakiness tracking' };
}

/**
 * @param {object} sonarMeasures - result of services/sonarClient.fetchSonarMeasures()
 * @param {object} ciRuns - result of services/githubClient.fetchCiRuns()
 */
function calculateAutomationStrength(sonarMeasures, ciRuns) {
  const testDensity = calcTestDensity(sonarMeasures);
  const ciStability = calcCiStability(ciRuns);
  const testReliability = calcTestReliability(sonarMeasures);

  const score =
    WEIGHTS.testDensity * testDensity.score +
    WEIGHTS.ciStability * ciStability.score +
    WEIGHTS.testReliability * testReliability.score;

  return {
    score: Math.round(score),
    breakdown: { testDensity, ciStability, testReliability },
    message: `CI: ${ciRuns?.successRate ?? '—'}% pass rate over ${ciRuns?.totalRuns ?? 0} runs`,
  };
}

module.exports = { calculateAutomationStrength };
