// metrics/deliveryReliability.js
//
// Delivery Reliability Score = on-time tasks / total completed tasks
//
// Kept as a pure function (data in, number out) so it's easy to unit test
// and easy to reuse once you add more metrics — none of them should reach
// into the database directly, they should just take arrays of rows.

function calculateDeliveryReliability(tasks) {
  const completedTasks = tasks.filter(t => t.status === 'done' && t.completed_date && t.due_date);

  if (completedTasks.length === 0) {
    return { score: null, onTime: 0, total: 0, message: 'No completed tasks with due dates yet' };
  }

  const onTimeTasks = completedTasks.filter(t => t.completed_date <= t.due_date);

  const score = Math.round((onTimeTasks.length / completedTasks.length) * 100);

  return {
    score,          // e.g. 90
    onTime: onTimeTasks.length,
    total: completedTasks.length,
  };
}

module.exports = { calculateDeliveryReliability };
