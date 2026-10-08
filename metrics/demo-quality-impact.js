// demo-quality-impact.js  -  run with:  node demo-quality-impact.js
const { calculateQualityImpactScore } = require('./metrics/qualityImpact');

function show(title, sonar, bugs) {
  const r = calculateQualityImpactScore(sonar, bugs);
  const b = r.breakdown;
  console.log('\n=== ' + title + ' ===');
  console.log('TCA  (x0.25) test coverage        :', b.testCoverageAdded.score);
  console.log('BFP  (x0.30) bugs caught in test  :', b.bugsFixedPermanently.score);
  console.log('RC   (x0.25) refactoring (debt)   :', b.refactoringContribution.score);
  console.log('CIR  (x0.20) code improvement     :', b.codeImprovementRate.score);
  console.log('QIS  score                        :', r.score, ' ->', r.message);
}

const bugs = [
  { found_in_testing: 1 }, { found_in_testing: 1 },
  { found_in_testing: 1 }, { found_in_testing: 0 },
];

show('1. Bugs only, SonarCloud not connected', null, bugs);
show('2. SonarCloud connected, no test suite yet',
  { available: true, coverage: null, debtRatio: 5, reliabilityScore: 60 }, bugs);
show('3. Full data (coverage 80%, debt 5%, reliability 60)',
  { available: true, coverage: 80, debtRatio: 5, reliabilityScore: 60 }, bugs);
