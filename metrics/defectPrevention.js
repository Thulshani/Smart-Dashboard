// metrics/defectPrevention.js
// Defect Prevention Ratio = bugs found in testing / total bugs
// High % = strong QA process (bugs caught before release, not escaped to prod)

function calculateDefectPrevention(bugs) {
    const totalBugs = bugs.length;

    if (totalBugs === 0) {
        return {
            score: null,
            bugsFoundInTesting: 0,
            bugsEscapedToProd: 0,
            totalBugs: 0,
            message: 'No bugs logged yet',
        };
    }

    const bugsFoundInTesting = bugs.filter(b => b.found_in_testing === 1).length;
    const bugsEscapedToProd = totalBugs - bugsFoundInTesting;
    const ratio = bugsFoundInTesting / totalBugs;
    const score = Math.round(ratio * 100);

    return {
        score,
        bugsFoundInTesting,
        bugsEscapedToProd,
        totalBugs,
        message: `${bugsFoundInTesting}/${totalBugs} caught in testing`,
    };
}

module.exports = { calculateDefectPrevention };