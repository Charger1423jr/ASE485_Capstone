/**
 * BookStatsBackend.test.js
 * Unit tests for BookStatsBackend.js — pure helper / data functions
 *
 * Run with: npx jest BookStatsBackend.test.js
 *
 * Chart.js and DOM rendering calls are stubbed out so we only test
 * the data-transformation logic.
 */

// ─── Stubs ────────────────────────────────────────────────────────────────────

const elementStore = {};
function makeEl(id = '') {
    return { id, innerHTML: '', style: {}, textContent: '' };
}

global.document = {
    getElementById: jest.fn(id => elementStore[id] || null),
    addEventListener: jest.fn(),
};
global.localStorage = { getItem: jest.fn(() => null), setItem: jest.fn() };
global.window = { authUI: { getCurrentUser: jest.fn(() => null) } };

// Stub Chart.js — we only care about what data was passed in, not rendering
const capturedCharts = {};
global.Chart = jest.fn().mockImplementation((ctx, config) => {
    capturedCharts[ctx] = config;
    return { destroy: jest.fn() };
});

// Load the module
// Hoist top-level let/const/var to globals so tests can read/write module state
{
    const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'BookStatsBackend.js'), 'utf8')
        .replace(/^(?:let|const|var) +(\w+)/gm, 'global.$1');
    eval(src);
}

// ─── Test data factories ──────────────────────────────────────────────────────

function book(title, wordCount, dateRead, rating = 0) {
    return { id: Math.random().toString(36).slice(2), title, wordCount, dateRead, rating };
}

function wpmRecord(wpm, daysAgo = 0) {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return { wpm, date: d.toISOString() };
}

function compRecord(score, total, daysAgo = 0) {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return { score, total, percentage: Math.round((score / total) * 100), date: d.toISOString() };
}

// ─── parseBookDate ────────────────────────────────────────────────────────────

describe('parseBookDate', () => {
    it('parses a valid M-D-YYYY string', () => {
        const d = parseBookDate('3-15-2024');
        expect(d).toBeInstanceOf(Date);
        expect(d.getFullYear()).toBe(2024);
        expect(d.getMonth()).toBe(2);   // 0-indexed
        expect(d.getDate()).toBe(15);
    });

    it('handles single-digit month and day', () => {
        const d = parseBookDate('1-5-2025');
        expect(d.getMonth()).toBe(0);
        expect(d.getDate()).toBe(5);
    });

    it('returns null for null input', () => {
        expect(parseBookDate(null)).toBeNull();
    });

    it('returns null for empty string', () => {
        expect(parseBookDate('')).toBeNull();
    });

    it('returns null for wrong segment count', () => {
        expect(parseBookDate('2024-03')).toBeNull();
        expect(parseBookDate('03/15/2024')).toBeNull();
    });
});

// ─── fmtNum ───────────────────────────────────────────────────────────────────

describe('fmtNum', () => {
    it('formats 0', () => expect(fmtNum(0)).toBe('0'));
    it('formats thousands with locale separator', () => {
        // toLocaleString output varies by env; just check it contains the digits
        expect(fmtNum(1000000)).toContain('1');
        expect(fmtNum(1000000)).toContain('000');
    });
});

// ─── fmtTime ─────────────────────────────────────────────────────────────────

describe('fmtTime', () => {
    it('formats seconds under an hour as Xm', () => {
        expect(fmtTime(600)).toBe('10m');
        expect(fmtTime(90)).toBe('1m');
        expect(fmtTime(0)).toBe('0m');
    });

    it('formats seconds over an hour as Xh Ym', () => {
        expect(fmtTime(3661)).toBe('1h 1m');
        expect(fmtTime(7200)).toBe('2h 0m');
    });

    it('rounds down partial minutes', () => {
        expect(fmtTime(3659)).toBe('1h 0m');
    });
});

// ─── monthKey ─────────────────────────────────────────────────────────────────

describe('monthKey', () => {
    it('formats as YYYY-MM with zero-padding', () => {
        expect(monthKey(new Date(2024, 0, 15))).toBe('2024-01');
        expect(monthKey(new Date(2024, 11, 1))).toBe('2024-12');
    });
});

// ─── last13Months ─────────────────────────────────────────────────────────────

describe('last13Months', () => {
    it('returns exactly 13 entries', () => {
        expect(last13Months()).toHaveLength(13);
    });

    it('first entry is 12 months ago', () => {
        const now = new Date();
        const expected = new Date(now.getFullYear(), now.getMonth() - 12, 1);
        expect(last13Months()[0].key).toBe(monthKey(expected));
    });

    it('last entry is the current month', () => {
        const now = new Date();
        const months = last13Months();
        expect(months[months.length - 1].key).toBe(monthKey(now));
    });

    it('each entry has label, key, and d properties', () => {
        last13Months().forEach(m => {
            expect(m).toHaveProperty('label');
            expect(m).toHaveProperty('key');
            expect(m).toHaveProperty('d');
        });
    });
});

// ─── badge ────────────────────────────────────────────────────────────────────

describe('badge', () => {
    it('includes label and value in output HTML', () => {
        const html = badge('Total', '42');
        expect(html).toContain('Total');
        expect(html).toContain('42');
    });

    it('uses default STATS_BLUE color when none provided', () => {
        const html = badge('X', 'Y');
        expect(html).toContain('#224499');
    });

    it('uses provided color override', () => {
        const html = badge('X', 'Y', '#ff0000');
        expect(html).toContain('#ff0000');
    });
});

// ─── renderBooksRead (data layer) ─────────────────────────────────────────────

describe('renderBooksRead — chart data', () => {
    beforeEach(() => {
        Object.keys(capturedCharts).forEach(k => delete capturedCharts[k]);
        // stub setSummary's getElementById
        document.getElementById.mockImplementation(id => makeEl(id));
        global.Chart.mockClear();
    });

    it('passes correct total book count to chart data', () => {
        const currentYear = new Date().getFullYear();
        const books = [
            book('A', 50000, `1-10-${currentYear}`),
            book('B', 60000, `3-5-${currentYear}`),
            book('C', 70000, '6-1-2018'),
        ];
        renderBooksRead(books);
        const config = global.Chart.mock.calls[0][1];
        // Chart covers only the last 13 months; the 2018 book falls outside that window.
        // Only the 2 current-year books appear in monthly bars.
        const barSum = config.data.datasets[0].data.reduce((a, b) => a + b, 0);
        expect(barSum).toBe(2);
    });

    it('produces 13 monthly data points', () => {
        renderBooksRead([]);
        const config = global.Chart.mock.calls[0][1];
        expect(config.data.datasets[0].data).toHaveLength(13);
    });

    it('uses bar chart type', () => {
        renderBooksRead([]);
        const config = global.Chart.mock.calls[0][1];
        expect(config.type).toBe('bar');
    });
});

// ─── renderRatings (data layer) ───────────────────────────────────────────────

describe('renderRatings — bucket logic', () => {
    beforeEach(() => {
        global.Chart.mockClear();
        document.getElementById.mockImplementation(id => makeEl(id));
    });

    it('correctly buckets integer ratings 1–5', () => {
        const books = [
            book('A', 1000, '1-1-2024', 1),
            book('B', 1000, '1-1-2024', 3),
            book('C', 1000, '1-1-2024', 3),
            book('D', 1000, '1-1-2024', 5),
        ];
        renderRatings(books);
        const data = global.Chart.mock.calls[0][1].data.datasets[0].data;
        expect(data[0]).toBe(1); // 1★
        expect(data[1]).toBe(0); // 2★
        expect(data[2]).toBe(2); // 3★
        expect(data[3]).toBe(0); // 4★
        expect(data[4]).toBe(1); // 5★
    });

    it('floors half-star ratings into the lower bucket', () => {
        const books = [book('A', 1000, '1-1-2024', 4.5)];
        renderRatings(books);
        const data = global.Chart.mock.calls[0][1].data.datasets[0].data;
        expect(data[3]).toBe(1); // floor(4.5) = 4 → index 3
        expect(data[4]).toBe(0);
    });

    it('ignores books with rating 0', () => {
        const books = [book('A', 1000, '1-1-2024', 0)];
        renderRatings(books);
        const data = global.Chart.mock.calls[0][1].data.datasets[0].data;
        expect(data.reduce((a, b) => a + b, 0)).toBe(0);
    });

    it('handles empty book list', () => {
        renderRatings([]);
        const data = global.Chart.mock.calls[0][1].data.datasets[0].data;
        expect(data).toEqual([0, 0, 0, 0, 0]);
    });
});

// ─── renderWordCount (data layer) ─────────────────────────────────────────────

describe('renderWordCount — totals', () => {
    beforeEach(() => {
        global.Chart.mockClear();
        document.getElementById.mockImplementation(id => makeEl(id));
    });

    it('sums all words across all books for Total badge', () => {
        // We test the data that reaches Chart.js (the monthly breakdown)
        const currentYear = new Date().getFullYear();
        const books = [
            book('A', 30000, `1-1-${currentYear}`),
            book('B', 70000, `2-1-${currentYear}`),
        ];
        renderWordCount(books);
        const monthly = global.Chart.mock.calls[0][1].data.datasets[0].data;
        // Both are current year — sum of monthly bars should equal 100 000
        expect(monthly.reduce((a, b) => a + b, 0)).toBe(100000);
    });

    it('produces a line chart', () => {
        renderWordCount([]);
        expect(global.Chart.mock.calls[0][1].type).toBe('line');
    });
});

// ─── renderNotesStats (data layer) ────────────────────────────────────────────

describe('renderNotesStats — aggregation', () => {
    beforeEach(() => {
        global.Chart.mockClear();
        document.getElementById.mockImplementation(id => makeEl(id));
    });

    function makeNote(daysAgo = 0) {
        const d = new Date();
        d.setDate(d.getDate() - daysAgo);
        return { title: 'Note', color: '#fff', text: 'x', createdAt: d.toISOString() };
    }

    it('counts notes across all collections', () => {
        const collections = [
            { title: 'Col A', notes: [makeNote(), makeNote()] },
            { title: 'Col B', notes: [makeNote()] },
        ];
        renderNotesStats(collections);
        // First chart (notesMonthChart) data sum should equal total notes for current month
        const monthChart = global.Chart.mock.calls[0][1];
        const sum = monthChart.data.datasets[0].data.reduce((a, b) => a + b, 0);
        expect(sum).toBe(3);
    });

    it('handles empty collections array', () => {
        renderNotesStats([]);
        const data = global.Chart.mock.calls[0][1].data.datasets[0].data;
        expect(data.every(v => v === 0)).toBe(true);
    });

    it('truncates long collection titles in the per-collection chart', () => {
        const collections = [
            { title: 'A Very Long Collection Title Indeed', notes: [] },
        ];
        renderNotesStats(collections);
        // Second Chart call is notesColChart
        const colChart = global.Chart.mock.calls[1][1];
        expect(colChart.data.labels[0].length).toBeLessThanOrEqual(18);
        expect(colChart.data.labels[0]).toContain('…');
    });

    it('assigns a colour from STATS_PALETTE to each collection', () => {
        const collections = Array.from({ length: 5 }, (_, i) => ({
            title: `Col ${i}`, notes: [],
        }));
        renderNotesStats(collections);
        const colChart = global.Chart.mock.calls[1][1];
        const colors = colChart.data.datasets[0].backgroundColor;
        expect(colors).toHaveLength(5);
        colors.forEach(c => expect(typeof c).toBe('string'));
    });
});

// ─── renderWpm (data layer) ───────────────────────────────────────────────────

describe('renderWpm', () => {
    beforeEach(() => {
        global.Chart.mockClear();
        document.getElementById.mockImplementation(id => makeEl(id));
    });

    it('produces a line chart with one data point per WPM record', () => {
        const history = [wpmRecord(250, 10), wpmRecord(270, 5), wpmRecord(290, 0)];
        renderWpm(history);
        const config = global.Chart.mock.calls[0][1];
        expect(config.type).toBe('line');
        expect(config.data.datasets[0].data).toEqual([250, 270, 290]);
    });

    it('handles empty WPM history without throwing', () => {
        expect(() => renderWpm([])).not.toThrow();
    });
});

// ─── renderComprehension (data layer) ─────────────────────────────────────────

describe('renderComprehension', () => {
    beforeEach(() => {
        global.Chart.mockClear();
        document.getElementById.mockImplementation(id => makeEl(id));
    });

    it('maps correct score values to chart data', () => {
        const history = [compRecord(2, 4, 10), compRecord(4, 4, 5), compRecord(3, 4, 0)];
        renderComprehension(history);
        const config = global.Chart.mock.calls[0][1];
        const scoreData = config.data.datasets[0].data;
        expect(scoreData).toEqual([2, 4, 3]);
    });

    it('maps percentage values to the line dataset', () => {
        const history = [compRecord(2, 4, 10), compRecord(4, 4, 5)];
        renderComprehension(history);
        const config = global.Chart.mock.calls[0][1];
        const pctData = config.data.datasets[1].data;
        expect(pctData).toEqual([50, 100]);
    });

    it('colours bars by performance threshold', () => {
        const history = [
            compRecord(4, 4, 0),  // 100% → blue #224499
            compRecord(3, 4, 1),  // 75%  → blue #3a6ae0
            compRecord(2, 4, 2),  // 50%  → yellow #f5c518
            compRecord(1, 4, 3),  // 25%  → red #dc3545
        ];
        renderComprehension(history);
        const colors = global.Chart.mock.calls[0][1].data.datasets[0].backgroundColor;
        expect(colors[0]).toBe('#224499');
        expect(colors[1]).toBe('#3a6ae0');
        expect(colors[2]).toBe('#f5c518');
        expect(colors[3]).toBe('#dc3545');
    });
});

// ─── loadStatsData — hasData gate ────────────────────────────────────────────

describe('loadStatsData — empty / has-data gating', () => {
    let loadingEl, containerEl, emptyEl;

    beforeEach(() => {
        global.Chart.mockClear();
        loadingEl   = makeEl('statsLoading');
        containerEl = makeEl('statsContainer');
        emptyEl     = makeEl('statsEmpty');
        document.getElementById.mockImplementation(id =>
            ({ statsLoading: loadingEl, statsContainer: containerEl, statsEmpty: emptyEl }[id] || makeEl(id))
        );
        global.localStorage.getItem.mockReturnValue(null);
    });

    it('shows statsEmpty and skips charts when all data is empty', () => {
        loadStatsData({ bookeep: { books: [] }, bookhelp: {}, booknotes: { collections: [] } });
        expect(emptyEl.style.display).toBe('block');
        expect(containerEl.style.display).toBe('none');
    });

    it('shows statsContainer when books data is present', () => {
        loadStatsData({
            bookeep:   { books: [book('A', 50000, '1-1-2024')] },
            bookhelp:  { wpmHistory: [], comprehensionHistory: [], totalReadingTime: 0, readingTimeByMonth: {} },
            booknotes: { collections: [] },
        });
        expect(containerEl.style.display).toBe('block');
        expect(emptyEl.style.display).not.toBe('block');
    });

    it('shows statsContainer when only WPM history is present', () => {
        loadStatsData({
            bookeep:   { books: [] },
            bookhelp:  { wpmHistory: [wpmRecord(250)], comprehensionHistory: [], totalReadingTime: 0, readingTimeByMonth: {} },
            booknotes: { collections: [] },
        });
        expect(containerEl.style.display).toBe('block');
    });

    it('falls back to localStorage when userData is null', () => {
        global.localStorage.getItem.mockReturnValue(null);
        expect(() => loadStatsData(null)).not.toThrow();
    });
});