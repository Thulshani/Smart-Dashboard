// metrics/learningGrowth.js
//
// Learning & Growth Score — measures how much developers are investing in
// their own skills: courses completed, certifications earned, new tools
// adopted. Sourced from a simple self-logged `achievements` table (no
// external integration needed — this one's inherently self-reported).
//
// Per developer:
//   Growth Score = min(100, (courses x 15) + (certifications x 25) + (tools x 10))
//
// The team-wide card shown on the dashboard is the AVERAGE score across
// developers who have logged at least one achievement — matching the same
// "average across active developers" pattern used in Focus Stability, so
// one very active developer doesn't single-handedly max out the team score.

const POINTS = {
  course: 15,
  certification: 25,
  tool: 10,
};

function clampScore(value) {
  return Math.max(0, Math.min(100, value));
}

/**
 * @param {Array} achievements - rows from the achievements table
 *   Each row: { id, developer_id, type: 'course'|'certification'|'tool', title, created_at }
 */
function calculateLearningGrowth(achievements) {
  if (!achievements || achievements.length === 0) {
    return {
      score: null,
      activeDevelopers: 0,
      message: 'No learning activity logged yet',
    };
  }

  const byDeveloper = {};
  achievements.forEach((a) => {
    if (!a.developer_id) return;
    if (!byDeveloper[a.developer_id]) {
      byDeveloper[a.developer_id] = { course: 0, certification: 0, tool: 0 };
    }
    if (POINTS[a.type] !== undefined) {
      byDeveloper[a.developer_id][a.type] += 1;
    }
  });

  const developerIds = Object.keys(byDeveloper);
  if (developerIds.length === 0) {
    return { score: null, activeDevelopers: 0, message: 'No learning activity logged yet' };
  }

  const scores = developerIds.map((id) => {
    const counts = byDeveloper[id];
    return clampScore(
      counts.course * POINTS.course +
      counts.certification * POINTS.certification +
      counts.tool * POINTS.tool
    );
  });

  const avgScore = scores.reduce((sum, s) => sum + s, 0) / scores.length;

  const totals = achievements.reduce(
    (acc, a) => {
      if (POINTS[a.type] !== undefined) acc[a.type] += 1;
      return acc;
    },
    { course: 0, certification: 0, tool: 0 }
  );

  return {
    score: Math.round(avgScore),
    activeDevelopers: developerIds.length,
    totals,
    message: `${totals.course} courses, ${totals.certification} certs, ${totals.tool} tools logged`,
  };
}

module.exports = { calculateLearningGrowth };
