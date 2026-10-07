// metrics/qualityImpact.test.js
//
// Focused on the TCA (Test Coverage Added) input, since that's the piece
// sourced directly from SonarCloud's "coverage" measure — i.e. this is
// where a real test suite's coverage % flows into the Quality Impact Score.
// Also covers how TCA combines with BFP/RC/CIR into the final weighted QIS.

const { calculateQualityImpactScore } = require('./qualityImpact');

// Helper: a fully "available" SonarCloud response with everything needed
// for RC/CIR fixed at neutral values, so tests can vary just `coverage`
// without the other three sub-scores moving the overall QIS unpredictably.
function sonarMeasures(overrides = {}) {
  return {
    available: true,
    coverage: null,
    debtRatio: 0,          // -> RC = 100 (no debt)
    reliabilityScore: 100, // -> CIR = 100 (best rating)
    ...overrides,
  };
}

describe('calculateQualityImpactScore — Test Coverage Added (TCA)', () => {
  test('SonarCloud not connected at all -> TCA scores 0, with an explanatory note', () => {
    const result = calculateQualityImpactScore({ available: false, reason: 'SONAR_TOKEN not set' }, []);
    expect(result.breakdown.testCoverageAdded.score).toBe(0);
    expect(result.breakdown.testCoverageAdded.note).toMatch(/no test coverage data/i);
  });

  test('SonarCloud connected but coverage is null (no test suite exists yet) -> TCA scores 0', () => {
    const measures = sonarMeasures({ coverage: null });
    const result = calculateQualityImpactScore(measures, []);
    expect(result.breakdown.testCoverageAdded.score).toBe(0);
  });

  test('coverage = 0% (test suite exists but covers nothing) -> TCA scores 0', () => {
    const measures = sonarMeasures({ coverage: 0 });
    const result = calculateQualityImpactScore(measures, []);
    expect(result.breakdown.testCoverageAdded.score).toBe(0);
  });

  test('coverage = 45.5% -> TCA score matches coverage exactly', () => {
    const measures = sonarMeasures({ coverage: 45.5 });
    const result = calculateQualityImpactScore(measures, []);
    expect(result.breakdown.testCoverageAdded.score).toBe(45.5);
  });

  test('coverage = 100% -> TCA scores 100 (full marks)', () => {
    const measures = sonarMeasures({ coverage: 100 });
    const result = calculateQualityImpactScore(measures, []);
    expect(result.breakdown.testCoverageAdded.score).toBe(100);
  });

  test('coverage above 100 (unexpected SonarCloud value) is clamped to 100', () => {
    const measures = sonarMeasures({ coverage: 142 });
    const result = calculateQualityImpactScore(measures, []);
    expect(result.breakdown.testCoverageAdded.score).toBe(100);
  });

  test('negative coverage (unexpected value) is clamped to 0', () => {
    const measures = sonarMeasures({ coverage: -10 });
    const result = calculateQualityImpactScore(measures, []);
    expect(result.breakdown.testCoverageAdded.score).toBe(0);
  });
});

describe('calculateQualityImpactScore — overall QIS using real TCA weight (25%)', () => {
  test('raising coverage from 0% to 80% raises the overall QIS by exactly 0.25 * 80 = 20 points', () => {
    const noBugs = [];
    const lowCoverage = calculateQualityImpactScore(sonarMeasures({ coverage: 0 }), noBugs);
    const highCoverage = calculateQualityImpactScore(sonarMeasures({ coverage: 80 }), noBugs);

    // BFP for an empty bugs array scores 0 either way (see calcBFP), so the
    // only thing moving between these two calls is TCA.
    expect(highCoverage.score - lowCoverage.score).toBeCloseTo(0.25 * 80, 5);
  });

  test('full marks across all four sub-scores -> QIS = 100', () => {
    const measures = sonarMeasures({ coverage: 100, debtRatio: 0, reliabilityScore: 100 });
    const allCaughtBugs = [
      { found_in_testing: 1 },
      { found_in_testing: 1 },
      { found_in_testing: 1 },
    ];
    const result = calculateQualityImpactScore(measures, allCaughtBugs);
    expect(result.score).toBe(100);
    expect(result.message).toBe('QIS 100/100');
  });

  test('SonarCloud unavailable -> message reflects partial score, even if some bugs data exists', () => {
    const bugs = [{ found_in_testing: 1 }, { found_in_testing: 0 }];
    const result = calculateQualityImpactScore({ available: false, reason: 'not configured' }, bugs);
    expect(result.message).toBe('Partial score — SonarCloud not connected yet');
    // TCA/RC/CIR all 0 when unavailable; only BFP (50% here) contributes.
    expect(result.score).toBeCloseTo(0.30 * 50, 5);
  });
});
