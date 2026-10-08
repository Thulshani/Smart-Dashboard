const { calculateDefectPrevention } = require('./defectPrevention');

describe('calculateDefectPrevention', () => {
    test('returns a null score when no bugs are logged', () => {
        const r = calculateDefectPrevention([]);
        expect(r.score).toBeNull();
        expect(r.totalBugs).toBe(0);
        expect(r.message).toBe('No bugs logged yet');
    });
    test('is the percentage of bugs found in testing', () => {
        const bugs = [1, 1, 1, 0].map((f) => ({ found_in_testing: f }));
        const r = calculateDefectPrevention(bugs);
        expect(r.score).toBe(75);
        expect(r.bugsFoundInTesting).toBe(3);
        expect(r.bugsEscapedToProd).toBe(1);
        expect(r.message).toBe('3/4 caught in testing');
    });
    test('scores 100 when all bugs are caught and 0 when all escape', () => {
        expect(calculateDefectPrevention([{ found_in_testing: 1 }]).score).toBe(100);
        expect(calculateDefectPrevention([{ found_in_testing: 0 }]).score).toBe(0);
    });
    test('rounds to a whole number', () => {
        const bugs = [1, 0, 0].map((f) => ({ found_in_testing: f }));
        expect(calculateDefectPrevention(bugs).score).toBe(33);
    });
});
