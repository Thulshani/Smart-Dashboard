// metrics/defectPrevention.js
// Defect Prevention Ratio = bugs found in testing / total bugs
// High % = strong QA process (bugs caught before release, not escaped to prod)

function calculateDefectPrevention(bugs) {
    const totalBugs = bugs.length;

    if (totalBugs === 0) {
        return {
            bugsFoundInTesting: 0,
            bugsEscapedToProd: 0,
            totalBugs: 0,
            preventionRatio: null,
            preventionRatioPercent: null,
            message: 'No bugs logged yet',
        };
    }

    const bugsFoundInTesting = bugs.filter(b => b.found_in_testing === 1).length;
    const bugsEscapedToProd = totalBugs - bugsFoundInTesting;
    const ratio = bugsFoundInTesting / totalBugs;

    return {
        bugsFoundInTesting,
        bugsEscapedToProd,
        totalBugs,
        preventionRatio: Math.round(ratio * 1000) / 1000, // e.g. 0.95
        preventionRatioPercent: Math.round(ratio * 100),   // e.g. 95
    };
}

module.exports = { calculateDefectPrevention };

