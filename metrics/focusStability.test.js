const { calculateFocusStability } = require('./focusStability');

const inProgress = (assignee) => ({ status: 'in_progress', assignee_id: assignee });

describe('calculateFocusStability', () => {
    test('returns a null score when no tasks are in progress', () => {
        const r = calculateFocusStability([{ status: 'done', assignee_id: 1 }]);
        expect(r.score).toBeNull();
        expect(r.message).toBe('No in-progress tasks yet');
    });
    test('ignores in-progress tasks with no assignee', () => {
        expect(calculateFocusStability([{ status: 'in_progress' }]).score).toBeNull();
    });
    test('one task per developer means no switching (100)', () => {
        const r = calculateFocusStability([inProgress(1), inProgress(2)]);
        expect(r.score).toBe(100);
        expect(r.avgTaskSwitches).toBe(0);
        expect(r.activeDevelopers).toBe(2);
    });
    test('each extra concurrent task costs 5 points', () => {
        const r = calculateFocusStability([inProgress(1), inProgress(1), inProgress(1)]);
        expect(r.avgTaskSwitches).toBe(2);
        expect(r.score).toBe(90);
    });
    test('averages switches across developers', () => {
        // dev 1 has 3 tasks (2 switches), dev 2 has 1 (0): average 1
        const r = calculateFocusStability([inProgress(1), inProgress(1), inProgress(1), inProgress(2)]);
        expect(r.avgTaskSwitches).toBe(1);
        expect(r.score).toBe(95);
        expect(r.message).toBe('1 avg concurrent tasks/dev');
    });
    test('rounds the average to one decimal place', () => {
        const tasks = [inProgress(1), inProgress(1), inProgress(2), inProgress(3)];
        const r = calculateFocusStability(tasks);
        expect(r.avgTaskSwitches).toBe(0.3);
        expect(r.score).toBe(98);
    });
    test('the score never goes below 0', () => {
        const tasks = Array.from({ length: 30 }, () => inProgress(1));
        expect(calculateFocusStability(tasks).score).toBe(0);
    });
});
