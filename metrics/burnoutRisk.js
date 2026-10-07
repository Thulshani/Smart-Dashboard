// metrics/burnoutRisk.js
//
// Smart Burnout Risk Indicator — combines four real/proxy signals into a
// single risk score. UNLIKE every other metric on this dashboard, HIGHER
// means WORSE here (more risk), not better — handle the display side
// accordingly (don't reuse the standard "green=high, red=low" color logic).
//
// Risk = (Overtime Load x 0.25) + (Spillover Rate x 0.25)
//      + (Late-Night Activity x 0.25) + (Self-Reported Load x 0.25)
//
//   Overtime Load       <- time_logs table: hours worked over the active
//                          period vs a standard workload for that many days.
//                          Respects the dashboard's date filter (?from/?to)
//                          when one is set; otherwise defaults to the last
//                          7 days.
//   Spillover Rate      <- tasks table: % of tasks overdue and still not done
//   Late-Night Activity <- GitHub commits: % of recent commits made 10pm-6am.
//                          This one is a live snapshot from the GitHub API
//                          and is NOT affected by the date filter — same
//                          known limitation as Quality Impact / Technical
//                          Debt / Automation Strength.
//   Self-Reported Load  <- self-logged check-ins (1-5 scale), since cognitive
//                          load genuinely cannot be measured from system data
//
// Important: this is meant to protect developers, not rank/punish them.
// Keep any UI framing supportive ("worth checking in") rather than punitive.

// Standard workload is expressed as hours-per-7-day-week so it scales
// cleanly to any period length (a custom date-filter range, not just a
// fixed week): standardHours = periodDays * (STANDARD_WEEK_HOURS / 7).
const STANDARD_WEEK_HOURS = 40;
// Hours-per-week at/above which overtime load is treated as maximal (100%).
const OVERTIME_CEILING_WEEK_HOURS = 80;

function clampScore(value) {
    return Math.max(0, Math.min(100, value));
}

// timeLogs: rows from time_logs with { work_date, hours_worked }, already
// scoped to the active period (either the dashboard's ?from/?to filter, or
// the last 7 days when no filter is set — see getTimeLogsForBurnout() in
// routes/metrics.js).
// periodDays: how many days that window covers, used to scale the standard
// workload proportionally (e.g. a 3-day filter window compares against a
// 3-day standard, not a full 40h week).
function calcOvertimeLoad(timeLogs, periodDays = 7) {
    if (!timeLogs || timeLogs.length === 0) {
        return { score: 0, note: `No time logs recorded in the selected ${periodDays}-day period` };
    }

    const totalHours = timeLogs.reduce((sum, t) => sum + (t.hours_worked || 0), 0);
    const standardHours = periodDays * (STANDARD_WEEK_HOURS / 7);

    if (totalHours <= standardHours) {
        return { score: 0, note: `${totalHours.toFixed(1)}h logged over ${periodDays} day(s) (within standard ${standardHours.toFixed(1)}h for that period)` };
    }

    const ceilingHours = periodDays * (OVERTIME_CEILING_WEEK_HOURS / 7);
    const overtimeRange = ceilingHours - standardHours;
    const score = clampScore(((totalHours - standardHours) / overtimeRange) * 100);
    return {
        score: Math.round(score),
        note: `${totalHours.toFixed(1)}h logged over ${periodDays} day(s) (${(totalHours - standardHours).toFixed(1)}h over standard ${standardHours.toFixed(1)}h for that period)`,
    };
}

function calcSpilloverRate(tasks) {
    const today = new Date().toISOString().slice(0, 10);
    const activeTasks = tasks.filter((t) => t.status !== 'done' && t.due_date);

    if (activeTasks.length === 0) {
        return { score: 0, note: 'No active tasks with due dates to assess' };
    }

    const overdue = activeTasks.filter((t) => t.due_date < today);
    const rate = clampScore((overdue.length / activeTasks.length) * 100);
    return { score: rate, note: `${overdue.length}/${activeTasks.length} active tasks overdue` };
}

function calcLateNightActivity(commits) {
    if (!commits?.available || commits.total === 0) {
        return { score: 0, note: commits?.reason || 'No recent commit data available' };
    }
    const rate = clampScore((commits.lateNightCount / commits.total) * 100);
    return { score: rate, note: `${commits.lateNightCount}/${commits.total} recent commits between 10pm-6am` };
}

function calcSelfReportedLoad(checkins) {
    if (!checkins || checkins.length === 0) {
        return { score: 0, note: 'No wellbeing check-ins logged yet' };
    }
    const avgRating = checkins.reduce((sum, c) => sum + c.load_rating, 0) / checkins.length;
    const score = clampScore(((avgRating - 1) / 4) * 100);
    return { score: Math.round(score), note: `Avg self-reported load: ${avgRating.toFixed(1)}/5 across ${checkins.length} check-ins` };
}

function riskLevel(score) {
    if (score < 40) return 'Low';
    if (score < 70) return 'Monitor';
    return 'Warning';
}

function calculateBurnoutRisk(tasks, commits, checkins, timeLogs, periodDays = 7) {
    const overtime = calcOvertimeLoad(timeLogs, periodDays);
    const spillover = calcSpilloverRate(tasks);
    const lateNight = calcLateNightActivity(commits);
    const selfReported = calcSelfReportedLoad(checkins);

    const score = Math.round(
        overtime.score * 0.25 +
        spillover.score * 0.25 +
        lateNight.score * 0.25 +
        selfReported.score * 0.25
    );

    return {
        score,
        level: riskLevel(score),
        breakdown: { overtime, spillover, lateNight, selfReported },
        message: `${riskLevel(score)} risk — ${score}%`,
    };
}

module.exports = { calculateBurnoutRisk };