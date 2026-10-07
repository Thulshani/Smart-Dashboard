// services/githubClient.js
//
// Pulls recent CI/CD run results and commit activity from the GitHub API.
// No token needed for a public repo — GitHub's public API allows
// unauthenticated reads (rate-limited to 60 requests/hour, which is
// plenty given the 5-minute cache below).
//
// If GITHUB_OWNER / GITHUB_REPO aren't set, this degrades gracefully
// the same way sonarClient.js does — returns "unavailable" rather than
// throwing, so the dashboard never crashes over a missing env var.

const CACHE_MS = 5 * 60 * 1000; // 5 minutes
let ciCache = { data: null, fetchedAt: 0 };

async function fetchCiRuns() {
  const now = Date.now();
  if (ciCache.data && now - ciCache.fetchedAt < CACHE_MS) {
    return ciCache.data;
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
      ciCache = { data: result, fetchedAt: now };
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

    ciCache = { data: result, fetchedAt: now };
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

// --- Recent commits (for Burnout Risk's late-night activity signal) ---
//
// Now supports an optional date range, using GitHub's native `since`/`until`
// query params on the commits API — so this genuinely respects the
// dashboard's date filter instead of always returning the last 30 commits.
//
// Cached per date-range combination (a plain object keyed by "from|to"),
// since different ranges are genuinely different queries and shouldn't
// share a single cache slot.

const commitsCache = {}; // { "from|to": { data, fetchedAt } }

function toGithubDateTime(dateStr, endOfDay) {
  if (!dateStr) return null;
  return endOfDay ? `${dateStr}T23:59:59Z` : `${dateStr}T00:00:00Z`;
}

async function fetchRecentCommits(from, to) {
  const cacheKey = `${from || ''}|${to || ''}`;
  const now = Date.now();
  const cached = commitsCache[cacheKey];
  if (cached && now - cached.fetchedAt < CACHE_MS) {
    return cached.data;
  }

  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;

  if (!owner || !repo) {
    return { available: false, reason: 'GITHUB_OWNER or GITHUB_REPO not set', total: 0, lateNightCount: 0 };
  }

  const params = new URLSearchParams({ per_page: '100' });
  const since = toGithubDateTime(from, false);
  const until = toGithubDateTime(to, true);
  if (since) params.set('since', since);
  if (until) params.set('until', until);
  // No range given: fall back to the most recent 30, same as before
  if (!since && !until) params.set('per_page', '30');

  const url = `https://api.github.com/repos/${owner}/${repo}/commits?${params.toString()}`;

  try {
    const res = await fetch(url, { headers: { Accept: 'application/vnd.github+json' } });
    if (!res.ok) {
      return { available: false, reason: `GitHub API returned ${res.status}`, total: 0, lateNightCount: 0 };
    }

    const commits = await res.json();
    let lateNightCount = 0;

    commits.forEach((c) => {
      const dateStr = c.commit?.author?.date || c.commit?.committer?.date;
      if (!dateStr) return;
      const hour = new Date(dateStr).getUTCHours();
      // 10pm-6am UTC as a simple, documented threshold. Adjust if your
      // team is concentrated in a specific timezone.
      if (hour >= 22 || hour < 6) lateNightCount += 1;
    });

    const result = { available: true, total: commits.length, lateNightCount };
    commitsCache[cacheKey] = { data: result, fetchedAt: now };
    return result;
  } catch (err) {
    return { available: false, reason: `GitHub fetch failed: ${err.message}`, total: 0, lateNightCount: 0 };
  }
}

module.exports = { fetchCiRuns, fetchRecentCommits };