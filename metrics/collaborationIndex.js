// metrics/collaborationIndex.js
//
// Collaboration Index — measures how much developers help each other rather
// than working in isolation: PR reviews done, teammates helped, tasks shared.
// Same self-logged pattern as Learning & Growth (no external integration
// needed — this is inherently about interpersonal activity, not code).
//
// Per developer:
//   Score = min(100, (reviews x 10) + (helps x 15) + (shared tasks x 20))
//
// Team-wide card = AVERAGE score across developers who logged at least one
// entry, same "average across active developers" pattern as Focus Stability
// and Learning & Growth — keeps one very active person from single-handedly
// maxing out the team's score.

const POINTS = {
  review: 10,
  help: 15,
  shared: 20,
};

function clampScore(value) {
  return Math.max(0, Math.min(100, value));
}

/**
 * @param {Array} collaborations - rows from the collaborations table
 *   Each row: { id, developer_id, type: 'review'|'help'|'shared', note, created_at }
 */
function calculateCollaborationIndex(collaborations) {
  if (!collaborations || collaborations.length === 0) {
    return {
      score: null,
      activeDevelopers: 0,
      message: 'No collaboration activity logged yet',
    };
  }

  const byDeveloper = {};
  collaborations.forEach((c) => {
    if (!c.developer_id) return;
    if (!byDeveloper[c.developer_id]) {
      byDeveloper[c.developer_id] = { review: 0, help: 0, shared: 0 };
    }
    if (POINTS[c.type] !== undefined) {
      byDeveloper[c.developer_id][c.type] += 1;
    }
  });

  const developerIds = Object.keys(byDeveloper);
  if (developerIds.length === 0) {
    return { score: null, activeDevelopers: 0, message: 'No collaboration activity logged yet' };
  }

  const scores = developerIds.map((id) => {
    const counts = byDeveloper[id];
    return clampScore(
      counts.review * POINTS.review +
      counts.help * POINTS.help +
      counts.shared * POINTS.shared
    );
  });

  const avgScore = scores.reduce((sum, s) => sum + s, 0) / scores.length;

  const totals = collaborations.reduce(
    (acc, c) => {
      if (POINTS[c.type] !== undefined) acc[c.type] += 1;
      return acc;
    },
    { review: 0, help: 0, shared: 0 }
  );

  return {
    score: Math.round(avgScore),
    activeDevelopers: developerIds.length,
    totals,
    message: `${totals.review} reviews, ${totals.help} helps, ${totals.shared} shared tasks`,
  };
}

module.exports = { calculateCollaborationIndex };
