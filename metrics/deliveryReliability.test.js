// metrics/deliveryReliability.test.js
const { calculateDeliveryReliability } = require('./deliveryReliability');

describe('calculateDeliveryReliability', () => {
    test('returns null score with a message when there are no completed tasks', () => {
        const result = calculateDeliveryReliability([]);
        expect(result.score).toBeNull();
        expect(result.message).toBe('No completed tasks with due dates yet');
    });

    test('calculates 100% when every task finished on or before its due date', () => {
        const tasks = [
            { status: 'done', due_date: '2026-08-20', completed_date: '2026-08-19' },
            { status: 'done', due_date: '2026-08-20', completed_date: '2026-08-20' },
        ];
        const result = calculateDeliveryReliability(tasks);
        expect(result.score).toBe(100);
        expect(result.onTime).toBe(2);
        expect(result.total).toBe(2);
    });

    test('calculates a partial score when some tasks are late', () => {
        const tasks = [
            { status: 'done', due_date: '2026-08-20', completed_date: '2026-08-19' }, // on time
            { status: 'done', due_date: '2026-08-20', completed_date: '2026-08-22' }, // late
        ];
        const result = calculateDeliveryReliability(tasks);
        expect(result.score).toBe(50);
        expect(result.onTime).toBe(1);
        expect(result.total).toBe(2);
    });

    test('ignores tasks that are not done yet', () => {
        const tasks = [
            { status: 'todo', due_date: '2026-08-20', completed_date: null },
            { status: 'done', due_date: '2026-08-20', completed_date: '2026-08-19' },
        ];
        const result = calculateDeliveryReliability(tasks);
        expect(result.total).toBe(1); // only the done task counts
    });
});