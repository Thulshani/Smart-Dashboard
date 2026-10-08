const { calculateLearningGrowth } = require('./learningGrowth');

describe('calculateLearningGrowth', () => {
    test('returns a null score when there is no activity', () => {
        expect(calculateLearningGrowth([]).score).toBeNull();
        expect(calculateLearningGrowth(undefined).message).toBe('No learning activity logged yet');
    });
    test('ignores rows without a developer_id', () => {
        const r = calculateLearningGrowth([{ type: 'course' }]);
        expect(r.score).toBeNull();
        expect(r.activeDevelopers).toBe(0);
    });
    test('scores 0 for a developer whose only rows have an unknown type', () => {
        const r = calculateLearningGrowth([{ developer_id: 1, type: 'other' }]);
        expect(r.score).toBe(0);
    });
    test('awards 15 per course, 25 per certification and 10 per tool, averaged per developer', () => {
        const rows = [
            { developer_id: 1, type: 'course' },
            { developer_id: 1, type: 'certification' },
            { developer_id: 2, type: 'tool' },
        ];
        // dev 1 = 40, dev 2 = 10, average 25
        const r = calculateLearningGrowth(rows);
        expect(r.score).toBe(25);
        expect(r.activeDevelopers).toBe(2);
        expect(r.totals).toEqual({ course: 1, certification: 1, tool: 1 });
        expect(r.message).toBe('1 courses, 1 certs, 1 tools logged');
    });
    test('caps one developer at 100', () => {
        const rows = Array.from({ length: 5 }, () => ({ developer_id: 1, type: 'certification' }));
        expect(calculateLearningGrowth(rows).score).toBe(100);
    });
});
