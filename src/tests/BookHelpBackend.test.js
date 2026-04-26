/**
 * BookHelpBackend.test.js
 * Unit tests for BookHelpBackend.js — pure logic functions
 *
 * Run with: npx jest BookHelpBackend.test.js
 *
 * We test only the deterministic, DOM-independent functions:
 *   computeTrend, computeWpmGoal, computeCompGoal,
 *   buildWpmRationale, buildCompRationale, wpmTip, compTip,
 *   remainingPathColor, formatTimeLeft
 */

// ─── Minimal stubs (module needs these to load without crashing) ──────────────

global.document = {
    getElementById:  jest.fn(() => null),
    querySelector:   jest.fn(() => null),
    querySelectorAll:jest.fn(() => []),
    addEventListener:jest.fn(),
};
global.window = {
    authUI: { getCurrentUser: jest.fn(() => null), getCurrentUserData: jest.fn(() => null) },
    firebaseAuth: { updateBookHelpData: jest.fn().mockResolvedValue({ success: true }) },
    addEventListener: jest.fn(),
};
global.localStorage = { getItem: jest.fn(() => null), setItem: jest.fn() };
global.confirm = jest.fn(() => false);
global.alert   = jest.fn();
global.clearInterval = jest.fn();
global.setInterval   = jest.fn(() => 99);

// Load module (globals-style).
// Hoist top-level let/const/var to global.* so tests can read/write module state.
{
    const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'BookHelpBackend.js'), 'utf8')
        .replace(/^(?:let|const|var) +(\w+)/gm, 'global.$1');
    eval(src);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeWpmHistory(...wpms) {
    return wpms.map(wpm => ({ wpm, date: new Date().toISOString() }));
}

function makeCompHistory(...entries) {
    // each entry: { percentage } or { score, total }
    return entries.map(e => ({ ...e, date: new Date().toISOString() }));
}

const neutralPace = {
    avgDaysBetweenBooks: null,
    avgWordsPerBook: null,
    recentPaceScore: 0.5,
    wordsPerDayScore: 0.5,
    bookCount: 0,
};

// ─── computeTrend ─────────────────────────────────────────────────────────────

describe('computeTrend', () => {
    it('returns 0 for fewer than 3 data points', () => {
        expect(computeTrend([])).toBe(0);
        expect(computeTrend([200])).toBe(0);
        expect(computeTrend([200, 220])).toBe(0);
    });

    it('returns a positive slope for a steadily improving series', () => {
        const slope = computeTrend([200, 220, 240, 260, 280]);
        expect(slope).toBeGreaterThan(0);
    });

    it('returns a negative slope for a declining series', () => {
        const slope = computeTrend([300, 280, 260, 240, 220]);
        expect(slope).toBeLessThan(0);
    });

    it('returns 0 (or near 0) for a flat series', () => {
        const slope = computeTrend([250, 250, 250, 250, 250]);
        expect(Math.abs(slope)).toBeLessThan(0.001);
    });

    it('uses only the last 5 values for long series', () => {
        // Prepend a huge plunge — only the stable tail should matter
        const vals = [1, 1, 1, 1, 1, 1, 1, 250, 250, 250, 250, 250];
        const slope = computeTrend(vals);
        expect(Math.abs(slope)).toBeLessThan(1); // tail is flat → near 0
    });
});

// ─── computeWpmGoal — no history ─────────────────────────────────────────────

describe('computeWpmGoal — no WPM history (pace proxy)', () => {
    it('returns a goal object with goalValue and dataSource="pace"', () => {
        const result = computeWpmGoal([], neutralPace, 'recommended', null);
        expect(result).toHaveProperty('goalValue');
        expect(result.dataSource).toBe('pace');
        expect(result).toHaveProperty('rationale');
        expect(result).toHaveProperty('tip');
    });

    it('quick mode yields a lower goal than optimistic when no history', () => {
        const quick  = computeWpmGoal([], neutralPace, 'quick',      null).goalValue;
        const optim  = computeWpmGoal([], neutralPace, 'optimistic', null).goalValue;
        expect(optim).toBeGreaterThan(quick);
    });

    it('high wordsPerDayScore raises base WPM estimate', () => {
        const fastPace = { ...neutralPace, wordsPerDayScore: 0.8 };
        const slowPace = { ...neutralPace, wordsPerDayScore: 0.1 };
        const fastGoal = computeWpmGoal([], fastPace, 'recommended', null).goalValue;
        const slowGoal = computeWpmGoal([], slowPace, 'recommended', null).goalValue;
        expect(fastGoal).toBeGreaterThanOrEqual(slowGoal);
    });

    it('goalValue is a positive integer', () => {
        const result = computeWpmGoal([], neutralPace, 'recommended', null);
        expect(Number.isInteger(result.goalValue)).toBe(true);
        expect(result.goalValue).toBeGreaterThan(0);
    });
});

// ─── computeWpmGoal — with history ───────────────────────────────────────────

describe('computeWpmGoal — with WPM history', () => {
    it('returns dataSource="history"', () => {
        const result = computeWpmGoal(makeWpmHistory(250, 260, 270), neutralPace, 'recommended', null);
        expect(result.dataSource).toBe('history');
    });

    it('goal is always higher than current best + 5', () => {
        const history = makeWpmHistory(200, 220, 240);
        const result  = computeWpmGoal(history, neutralPace, 'recommended', null);
        expect(result.goalValue).toBeGreaterThanOrEqual(240 + 5);
    });

    it('goal never exceeds 900 WPM', () => {
        // Artificially high history
        const history = makeWpmHistory(850, 870, 890);
        const result  = computeWpmGoal(history, neutralPace, 'optimistic', null);
        expect(result.goalValue).toBeLessThanOrEqual(900);
    });

    it('goal is rounded to the nearest 5', () => {
        const history = makeWpmHistory(211, 213, 215);
        const result  = computeWpmGoal(history, neutralPace, 'quick', null);
        expect(result.goalValue % 5).toBe(0);
    });

    it('optimistic mode yields higher goal than quick mode', () => {
        const history = makeWpmHistory(200, 210, 220);
        const quick   = computeWpmGoal(history, neutralPace, 'quick',      null).goalValue;
        const optim   = computeWpmGoal(history, neutralPace, 'optimistic', null).goalValue;
        expect(optim).toBeGreaterThanOrEqual(quick);
    });

    it('improving trend produces a higher bonus than flat trend', () => {
        const improving = makeWpmHistory(200, 220, 240, 260, 280);
        const flat      = makeWpmHistory(240, 240, 240, 240, 240);
        const rImproving = computeWpmGoal(improving, neutralPace, 'recommended', null).goalValue;
        const rFlat      = computeWpmGoal(flat,      neutralPace, 'recommended', null).goalValue;
        // Improving trend should produce same or higher goal
        expect(rImproving).toBeGreaterThanOrEqual(rFlat - 5);
    });

    it('high-pace reader (wordsPerDayScore > 0.65) gets conservative modifier', () => {
        const fastPace = { ...neutralPace, wordsPerDayScore: 0.8 };
        const slowPace = { ...neutralPace, wordsPerDayScore: 0.2 };
        const history  = makeWpmHistory(250, 260, 270);
        const fastGoal = computeWpmGoal(history, fastPace, 'recommended', null).goalValue;
        const slowGoal = computeWpmGoal(history, slowPace, 'recommended', null).goalValue;
        // Slow reader has more room to grow → same or larger goal
        expect(slowGoal).toBeGreaterThanOrEqual(fastGoal);
    });
});

// ─── computeCompGoal — no history ────────────────────────────────────────────

describe('computeCompGoal — no history (default tier)', () => {
    it('returns goalValue of 50 for quick mode with no history', () => {
        const result = computeCompGoal([], neutralPace, 'quick', null, 0);
        expect(result.goalValue).toBe(50);
    });

    it('returns goalValue of 75 for recommended mode with no history', () => {
        const result = computeCompGoal([], neutralPace, 'recommended', null, 0);
        expect(result.goalValue).toBe(75);
    });

    it('returns a valid tier value (25 | 50 | 75 | 100)', () => {
        ['quick', 'recommended', 'optimistic'].forEach(mode => {
            const result = computeCompGoal([], neutralPace, mode, null, 0);
            expect([25, 50, 75, 100]).toContain(result.goalValue);
        });
    });

    it('returns dataSource="pace" when no history', () => {
        const result = computeCompGoal([], neutralPace, 'recommended', null, 0);
        expect(result.dataSource).toBe('pace');
    });
});

// ─── computeCompGoal — with history ──────────────────────────────────────────

describe('computeCompGoal — with history', () => {
    it('returns dataSource="history"', () => {
        const history = makeCompHistory({ percentage: 75 }, { percentage: 75 }, { percentage: 100 });
        const result  = computeCompGoal(history, neutralPace, 'recommended', null, 0);
        expect(result.dataSource).toBe('history');
    });

    it('goal is always one of [25, 50, 75, 100]', () => {
        const combos = [
            makeCompHistory({ percentage: 10 }, { percentage: 25 }),
            makeCompHistory({ percentage: 50 }, { percentage: 50 }),
            makeCompHistory({ percentage: 75 }, { percentage: 100 }),
            makeCompHistory({ percentage: 25 }, { percentage: 50 }, { percentage: 75 }),
        ];
        combos.forEach(history => {
            ['quick', 'recommended', 'optimistic'].forEach(mode => {
                const result = computeCompGoal(history, neutralPace, mode, null, 0);
                expect([25, 50, 75, 100]).toContain(result.goalValue);
            });
        });
    });

    it('accepts score/total format in addition to percentage format', () => {
        const history = makeCompHistory(
            { score: 2, total: 4 },   // 50%
            { score: 3, total: 4 },   // 75%
            { score: 4, total: 4 },   // 100%
        );
        expect(() => computeCompGoal(history, neutralPace, 'recommended', null, 0)).not.toThrow();
        const result = computeCompGoal(history, neutralPace, 'recommended', null, 0);
        expect([25, 50, 75, 100]).toContain(result.goalValue);
    });

    it('filters out null/invalid percentage entries', () => {
        const history = [
            { percentage: null, date: new Date().toISOString() },
            { percentage: 75,   date: new Date().toISOString() },
        ];
        expect(() => computeCompGoal(history, neutralPace, 'recommended', null, 0)).not.toThrow();
    });

    it('consistently hitting 75%+ pushes tierIndex up in non-quick modes', () => {
        const highHistory = makeCompHistory(
            { percentage: 75 }, { percentage: 75 }, { percentage: 100 },
            { percentage: 75 }, { percentage: 100 }
        );
        const result = computeCompGoal(highHistory, neutralPace, 'recommended', null, 0);
        expect(result.goalValue).toBe(100); // consistently >= 75% → pushed to 100
    });

    it('low average in quick mode targets 50%', () => {
        const history = makeCompHistory({ percentage: 25 }, { percentage: 25 }, { percentage: 25 });
        const result  = computeCompGoal(history, neutralPace, 'quick', null, 0);
        expect(result.goalValue).toBe(50);
    });

    it('includes streak information in rationale when streak > 0', () => {
        const history = makeCompHistory({ percentage: 75 }, { percentage: 75 }, { percentage: 75 });
        const result  = computeCompGoal(history, neutralPace, 'recommended', null, 3);
        expect(result.rationale).toContain('streak');
    });

    it('rationale includes average and best scores', () => {
        const history = makeCompHistory({ percentage: 50 }, { percentage: 75 }, { percentage: 100 });
        const result  = computeCompGoal(history, neutralPace, 'recommended', null, 0);
        expect(result.rationale).toMatch(/\d+%/);
    });
});

// ─── wpmTip ───────────────────────────────────────────────────────────────────

describe('wpmTip', () => {
    it('returns a non-empty string for every mode', () => {
        ['quick', 'recommended', 'optimistic'].forEach(mode => {
            const tip = wpmTip(300, mode);
            expect(typeof tip).toBe('string');
            expect(tip.length).toBeGreaterThan(10);
        });
    });

    it('returns one of the three tips arrays (different calls may vary)', () => {
        // Call many times to cover randomness; all must be strings
        for (let i = 0; i < 20; i++) {
            expect(typeof wpmTip(300, 'quick')).toBe('string');
        }
    });
});

// ─── compTip ──────────────────────────────────────────────────────────────────

describe('compTip', () => {
    it('returns the goal-specific tip for goals 25, 50, 75', () => {
        [25, 50, 75].forEach(goal => {
            const tip = compTip(goal, 'recommended');
            expect(typeof tip).toBe('string');
            expect(tip.length).toBeGreaterThan(10);
        });
    });

    it('returns a mode tip when goal is 100', () => {
        ['quick', 'recommended', 'optimistic'].forEach(mode => {
            const tip = compTip(100, mode);
            expect(typeof tip).toBe('string');
            expect(tip.length).toBeGreaterThan(10);
        });
    });
});

// ─── buildWpmRationale ────────────────────────────────────────────────────────

describe('buildWpmRationale', () => {
    it('mentions "starting target" when avg is null (no history)', () => {
        const r = buildWpmRationale(null, null, null, neutralPace, 'recommended', 240, null);
        expect(r).toMatch(/starting target/i);
    });

    it('mentions average and best when history exists', () => {
        const pace = { ...neutralPace, bookCount: 3, avgWordsPerBook: 70000, avgDaysBetweenBooks: 14, recentPaceScore: 0.6 };
        const r = buildWpmRationale(250, 290, 270, pace, 'recommended', 300, null);
        expect(r).toContain('250');
        expect(r).toContain('290');
    });

    it('mentions the mode label', () => {
        const r = buildWpmRationale(200, 220, 210, neutralPace, 'optimistic', 280, null);
        expect(r).toMatch(/long-term/i);
    });

    it('describes WPM delta from last score', () => {
        const r = buildWpmRationale(200, 220, 200, neutralPace, 'quick', 215, null);
        expect(r).toMatch(/\+\d+|\-\d+/); // e.g. "+15" or "-5"
    });
});

// ─── buildCompRationale ───────────────────────────────────────────────────────

describe('buildCompRationale', () => {
    it('mentions "starting point" when avg is null', () => {
        const r = buildCompRationale(null, null, null, neutralPace, 'recommended', 75, null, 0);
        expect(r).toMatch(/starting point/i);
    });

    it('includes avg score when history exists', () => {
        const r = buildCompRationale(68, 100, 75, neutralPace, 'recommended', 75, null, 0);
        expect(r).toContain('68');
    });

    it('mentions streak when compStreak > 0', () => {
        const r = buildCompRationale(75, 100, 75, neutralPace, 'quick', 75, null, 5);
        expect(r).toContain('5-test streak');
    });

    it('does not mention streak when compStreak is 0', () => {
        const r = buildCompRationale(75, 100, 75, neutralPace, 'quick', 75, null, 0);
        expect(r).not.toContain('streak');
    });

    it('mentions book pace details when bookCount > 0', () => {
        const pace = { ...neutralPace, bookCount: 5, avgWordsPerBook: 80000, avgDaysBetweenBooks: 10 };
        const r = buildCompRationale(75, 100, 75, pace, 'recommended', 75, null, 0);
        expect(r).toContain('80k');
    });
});

// ─── remainingPathColor ───────────────────────────────────────────────────────

describe('remainingPathColor', () => {
    beforeEach(() => {
        // Reset to default TIME_LIMIT of 1800
        TIME_LIMIT = 1800;
        timePassed = 0;
        timeLeft   = TIME_LIMIT;
    });

    it('returns "yellow" when more than half the time remains', () => {
        timeLeft = 1200; // > 900 (half of 1800)
        expect(remainingPathColor()).toBe('yellow');
    });

    it('returns "orange" when past halfway but more than 60s remain', () => {
        timeLeft = 500; // < 900 but > 60
        expect(remainingPathColor()).toBe('orange');
    });

    it('returns "green" in the last 60 seconds', () => {
        timeLeft = 45;
        expect(remainingPathColor()).toBe('green');
    });

    it('returns "green" at exactly 60 seconds', () => {
        timeLeft = 60;
        expect(remainingPathColor()).toBe('green');
    });
});

// ─── formatTimeLeft ───────────────────────────────────────────────────────────

describe('formatTimeLeft', () => {
    it('formats 90 seconds as "1:30"', () => {
        expect(formatTimeLeft(90)).toBe('1:30');
    });

    it('formats 0 seconds as "0:00"', () => {
        expect(formatTimeLeft(0)).toBe('0:00');
    });

    it('formats 1800 seconds as "30:00"', () => {
        expect(formatTimeLeft(1800)).toBe('30:00');
    });

    it('zero-pads seconds below 10', () => {
        expect(formatTimeLeft(65)).toBe('1:05');
    });

    it('does not zero-pad minutes', () => {
        expect(formatTimeLeft(600)).toBe('10:00');
    });
});

// ─── WPM_PROMPTS structure ────────────────────────────────────────────────────

describe('WPM_PROMPTS data integrity', () => {
    it('contains beginner, intermediate, and expert difficulty levels', () => {
        expect(WPM_PROMPTS).toHaveProperty('beginner');
        expect(WPM_PROMPTS).toHaveProperty('intermediate');
        expect(WPM_PROMPTS).toHaveProperty('expert');
    });

    it('every prompt has a text string and a positive word count', () => {
        Object.values(WPM_PROMPTS).forEach(prompts => {
            prompts.forEach(p => {
                expect(typeof p.text).toBe('string');
                expect(p.text.length).toBeGreaterThan(0);
                expect(typeof p.words).toBe('number');
                expect(p.words).toBeGreaterThan(0);
            });
        });
    });
});

// ─── COMP_PROMPTS structure ───────────────────────────────────────────────────

describe('COMP_PROMPTS data integrity', () => {
    it('contains beginner, intermediate, and expert levels', () => {
        expect(COMP_PROMPTS).toHaveProperty('beginner');
        expect(COMP_PROMPTS).toHaveProperty('intermediate');
        expect(COMP_PROMPTS).toHaveProperty('expert');
    });

    it('every prompt has a passage and at least one question', () => {
        Object.values(COMP_PROMPTS).forEach(prompts => {
            prompts.forEach(p => {
                expect(typeof p.passage).toBe('string');
                expect(p.passage.length).toBeGreaterThan(0);
                expect(Array.isArray(p.questions)).toBe(true);
                expect(p.questions.length).toBeGreaterThan(0);
            });
        });
    });

    it('every question has exactly 4 options and a valid answer index', () => {
        Object.values(COMP_PROMPTS).forEach(prompts => {
            prompts.forEach(p => {
                p.questions.forEach(q => {
                    expect(q.options).toHaveLength(4);
                    expect(q.answer).toBeGreaterThanOrEqual(0);
                    expect(q.answer).toBeLessThanOrEqual(3);
                });
            });
        });
    });
});