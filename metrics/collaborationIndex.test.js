const { calculateCollaborationIndex } = require('./collaborationIndex');

describe('calculateCollaborationIndex', () => {
    test('returns a null score when there is no activity', () => {
        expect(calculateCollaborationIndex([]).score).toBeNull();
        expect(calculateCollaborationIndex(null).message).toBe('No collaboration activity logged yet');
    });
    test('ignores rows without a developer_id', () => {
        const r = calculateCollaborationIndex([{ type: 'review' }]);
        expect(r.score).toBeNull();
        expect(r.activeDevelopers).toBe(0);
    });
    test('scores 0 for a developer whose only rows have an unknown type', () => {
        const r = calculateCollaborationIndex([{ developer_id: 1, type: 'other' }]);
        expect(r.score).toBe(0);
        expect(r.activeDevelopers).toBe(1);
    });
    test('awards 10 per review, 15 per help and 20 per shared task, averaged per developer', () => {
        const rows = [
            { developer_id: 1, type: 'review' },
            { developer_id: 1, type: 'review' },
            { developer_id: 1, type: 'help' },
            { developer_id: 2, type: 'shared' },
        ];
        // dev 1 = 35, dev 2 = 20, average 27.5 rounds to 28
        const r = calculateCollaborationIndex(rows);
        expect(r.score).toBe(28);
        expect(r.activeDevelopers).toBe(2);
        expect(r.totals).toEqual({ review: 2, help: 1, shared: 1 });
        expect(r.message).toBe('2 reviews, 1 helps, 1 shared tasks');
    });
    test('caps one developer at 100', () => {
        const rows = Array.from({ length: 6 }, () => ({ developer_id: 1, type: 'shared' }));
        expect(calculateCollaborationIndex(rows).score).toBe(100);
    });
});
