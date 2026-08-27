// services/githubClient.js
//
// Pulls recent CI/CD run results from the GitHub Actions API.
// No token needed for a public repo — GitHub's public API allows
// unauthenticated reads (rate-limited to 60 requests/hour, which is
// plenty given the 5-minute cache below).
//
// If GITHUB_OWNER / GITHUB_REPO aren't set, this degrades gracefully
// the same way sonarClient.js does — returns "unavailable" rather than
// throwing, so the dashboard never crashes over a missing env var.

const CACHE_MS = 5 * 60 * 1000; // 5 minutes
let cache = { data: null, fetchedAt: 0 };

async function fetchCiRuns() {
  const now = Date.now();
  if (cache.data && now - cache.fetchedAt < CACHE_MS) {
    return cache.data;
  }

  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;

  if (!owner || !repo) {
    return {
      available: false,
      reason: 'GITHUB_OWNER or GITHUB_REPO not set in environment',
      successRate: null,
      totalRuns: 0,
    };
  }

  const url = `https://api.github.com/repos/${owner}/${repo}/actions/runs?per_page=20`;

  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/vnd.github+json' },
    });

    if (!res.ok) {
      return {
        available: false,
        reason: `GitHub API returned ${res.status}`,
        successRate: null,
        totalRuns: 0,
      };
    }

    const body = await res.json();
    const runs = (body.workflow_runs || []).filter((r) => r.status === 'completed');

    if (runs.length === 0) {
      const result = { available: true, successRate: null, totalRuns: 0 };
      cache = { data: result, fetchedAt: now };
      return result;
    }

    const successCount = runs.filter((r) => r.conclusion === 'success').length;
    const successRate = Math.round((successCount / runs.length) * 100);

    const result = {
      available: true,
      successRate,
      totalRuns: runs.length,
      fetchedAt: new Date().toISOString(),
    };

    cache = { data: result, fetchedAt: now };
    return result;
  } catch (err) {
    return {
      available: false,
      reason: `GitHub fetch failed: ${err.message}`,
      successRate: null,
      totalRuns: 0,
    };
  }
}

module.exports = { fetchCiRuns };
