// metrics/focusStability.js
//
// Focus Stability Index — measures how often developers are pulled between
// multiple tasks at once, as a proxy for interruptions/context-switching.
//
// No new table needed: it's derived entirely from the existing `tasks`
// table by counting how many tasks each developer currently has "in
// progress" simultaneously. A developer working on 1 task at a time has
// 0 switches; someone juggling 3 has 2 "switches".
//
// Focus Stability = 100 - (avg task switches across active developers x 5)
//
// This is a team-wide snapshot metric (same style as your other cards),
// not a per-developer one — it reflects how much context-switching is
// happening across the team right now.

function clampScore(value) {
  return Math.max(0, Math.min(100, value));
}

/**
 * @param {Array} tasks - rows from the tasks table
 */
function calculateFocusStability(tasks) {
  const inProgress = tasks.filter((t) => t.status === 'in_progress' && t.assignee_id);

  if (inProgress.length === 0) {
    return {
      score: null,
      avgTaskSwitches: 0,
      activeDevelopers: 0,
      message: 'No in-progress tasks yet',
    };
  }

  // Count in-progress tasks per developer
  const countsByAssignee = {};
  inProgress.forEach((t) => {
    countsByAssignee[t.assignee_id] = (countsByAssignee[t.assignee_id] || 0) + 1;
  });

  const assigneeIds = Object.keys(countsByAssignee);
  const switchesPerDeveloper = assigneeIds.map((id) => Math.max(0, countsByAssignee[id] - 1));
  const totalSwitches = switchesPerDeveloper.reduce((sum, s) => sum + s, 0);
  const avgTaskSwitches = totalSwitches / assigneeIds.length;

  const score = Math.round(clampScore(100 - avgTaskSwitches * 5));

  return {
    score,
    avgTaskSwitches: Math.round(avgTaskSwitches * 10) / 10,
    activeDevelopers: assigneeIds.length,
    message: `${Math.round(avgTaskSwitches * 10) / 10} avg concurrent tasks/dev`,
  };
}

module.exports = { calculateFocusStability };
