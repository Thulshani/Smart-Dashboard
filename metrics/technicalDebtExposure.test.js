const { calculateTechnicalDebtExposure } = require('./technicalDebtExposure');

const sonar = (over = {}) => ({ available: true, debtRatio: 2, duplicatedLinesDensity: 10, ...over });

describe('calculateTechnicalDebtExposure', () => {
    test('returns a null score and Unknown level when SonarCloud data is missing', () => {
        const r = calculateTechnicalDebtExposure(null);
        expect(r.score).toBeNull();
        expect(r.level).toBe('Unknown');
        expect(r.message).toBe('SonarCloud data not available');
    });
    test('passes through the reason when SonarCloud is unavailable', () => {
        const r = calculateTechnicalDebtExposure({ available: false, reason: 'API returned 401' });
        expect(r.message).toBe('API returned 401');
    });
    test('score is 100 minus (0.8 x debt ratio + 0.2 x duplication)', () => {
        // 100 - (1.6 + 2) = 96.4 -> 96
        const r = calculateTechnicalDebtExposure(sonar());
        expect(r.score).toBe(96);
        expect(r.message).toBe('Low exposure — 2% debt ratio');
    });
    test('levels: Low below 5, Medium below 20, High from 20', () => {
        expect(calculateTechnicalDebtExposure(sonar({ debtRatio: 4.9 })).level).toBe('Low');
        expect(calculateTechnicalDebtExposure(sonar({ debtRatio: 10 })).level).toBe('Medium');
        expect(calculateTechnicalDebtExposure(sonar({ debtRatio: 20 })).level).toBe('High');
    });
    test('missing debt and duplication values are treated as 0', () => {
        const r = calculateTechnicalDebtExposure({ available: true, debtRatio: null, duplicatedLinesDensity: null });
        expect(r.score).toBe(100);
        expect(r.duplicatedLinesDensity).toBe(0);
    });
    test('passes through debt minutes and code smells when present, else null', () => {
        const full = calculateTechnicalDebtExposure(sonar({ debtMinutes: 120, codeSmells: 7 }));
        expect(full.debtMinutes).toBe(120);
        expect(full.codeSmells).toBe(7);
        const bare = calculateTechnicalDebtExposure(sonar());
        expect(bare.debtMinutes).toBeNull();
        expect(bare.codeSmells).toBeNull();
    });
    test('the score never goes below 0', () => {
        expect(calculateTechnicalDebtExposure(sonar({ debtRatio: 200 })).score).toBe(0);
    });
});
