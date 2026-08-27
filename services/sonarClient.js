// services/sonarClient.js
//
// Talks to the SonarCloud Web API and returns a small, clean measures object.
// Cached in memory for CACHE_MS so the dashboard's 15s polling loop doesn't
// hit SonarCloud on every single request — Sonar data only changes when a
// new CI run finishes, so a few minutes of staleness is fine.

const SONAR_BASE = 'https://sonarcloud.io/api/measures/component';
const METRIC_KEYS = [
  'coverage',
  'sqale_debt_ratio',
  'sqale_index',
  'code_smells',
  'duplicated_lines_density',
  'reliability_rating',
  'bugs',
  'tests',
  'test_success_density',
  'ncloc',
].join(',');

const CACHE_MS = 5 * 60 * 1000; // 5 minutes
let cache = { data: null, fetchedAt: 0 };

// SonarQube's A-E letter ratings come back as numbers 1.0-5.0 (1 = A, 5 = E)
function ratingToScore(ratingValue) {
  if (ratingValue === undefined || ratingValue === null) return null;
  const map = { 1: 100, 2: 80, 3: 60, 4: 40, 5: 20 };
  return map[Math.round(Number(ratingValue))] ?? null;
}

function toNumber(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

async function fetchSonarMeasures() {
  const now = Date.now();
  if (cache.data && now - cache.fetchedAt < CACHE_MS) {
    return cache.data;
  }

  const token = process.env.SONAR_TOKEN;
  const projectKey = process.env.SONAR_PROJECT_KEY;

  if (!token || !projectKey) {
    return {
      available: false,
      reason: 'SONAR_TOKEN or SONAR_PROJECT_KEY not set in environment',
      coverage: null,
      debtRatio: null,
      codeSmells: null,
      duplicatedLinesDensity: null,
      reliabilityScore: null,
      bugs: null,
    };
  }

  const url = `${SONAR_BASE}?component=${encodeURIComponent(projectKey)}&metricKeys=${METRIC_KEYS}`;

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      return {
        available: false,
        reason: `SonarCloud API returned ${res.status}`,
        coverage: null,
        debtRatio: null,
        codeSmells: null,
        duplicatedLinesDensity: null,
        reliabilityScore: null,
        bugs: null,
      };
    }

    const body = await res.json();
    const measures = {};
    (body?.component?.measures || []).forEach((m) => {
      measures[m.metric] = m.value;
    });

    const result = {
      available: true,
      coverage: toNumber(measures.coverage), // null if no test suite yet
      debtRatio: toNumber(measures.sqale_debt_ratio),
      debtMinutes: toNumber(measures.sqale_index),
      codeSmells: toNumber(measures.code_smells),
      duplicatedLinesDensity: toNumber(measures.duplicated_lines_density),
      reliabilityScore: ratingToScore(measures.reliability_rating),
      bugs: toNumber(measures.bugs),
      tests: toNumber(measures.tests),
      testSuccessDensity: toNumber(measures.test_success_density),
      linesOfCode: toNumber(measures.ncloc),
      fetchedAt: new Date().toISOString(),
    };

    cache = { data: result, fetchedAt: now };
    return result;
  } catch (err) {
    return {
      available: false,
      reason: `SonarCloud fetch failed: ${err.message}`,
      coverage: null,
      debtRatio: null,
      codeSmells: null,
      duplicatedLinesDensity: null,
      reliabilityScore: null,
      bugs: null,
    };
  }
}

module.exports = { fetchSonarMeasures };
