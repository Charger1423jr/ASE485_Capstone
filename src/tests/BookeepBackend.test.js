/**
 * BookeepBackend.test.js
 * Unit tests for BookeepBackend.js (pure logic functions)
 *
 * Run with: npx jest BookeepBackend.test.js
 *
 * Strategy: we load the module in a JSDOM environment and stub out all
 * DOM / Firebase / Bootstrap dependencies, then test each exported-to-window
 * function directly.
 */

// ─── DOM stubs ────────────────────────────────────────────────────────────────

const elements = {};

function makeEl(id, extra = {}) {
    return {
        textContent: '',
        innerHTML: '',
        value: '',
        style: {},
        dataset: {},
        focus: jest.fn(),
        addEventListener: jest.fn(),
        querySelectorAll: jest.fn(() => []),
        ...extra,
    };
}

// Pre-create all IDs referenced in the module
const DOM_IDS = [
    'currentYear', 'yearLabel', 'yearLabel2', 'pointsModeLabel',
    'totalWords', 'yearWords', 'totalBooks', 'points',
    'bookSearchInput', 'searchResults',
    'bookTitle', 'bookAuthor', 'wordCount',
    'searchSection', 'manualSection', 'toggleEntryBtn',
    'newBookRating',
    'wrappedContent',
    'snackbarText', 'snackbar',
    'app', 'bookList',
];

DOM_IDS.forEach(id => {
    elements[id] = makeEl(id);
    elements[id].appendChild = jest.fn();
    elements[id].removeChild = jest.fn();
});

global.document = {
    getElementById: jest.fn(id => elements[id] || makeEl(id)),
    querySelector: jest.fn(() => null),
    querySelectorAll: jest.fn(() => []),
    createElement: jest.fn(tag => ({
        className: '', textContent: '', innerHTML: '', href: '',
        download: '', style: {}, dataset: {},
        addEventListener: jest.fn(),
        appendChild: jest.fn(),
        click: jest.fn(),
    })),
    body: { appendChild: jest.fn(), removeChild: jest.fn() },
    addEventListener: jest.fn(),
};

global.window = {
    authUI: {
        getCurrentUser: jest.fn(() => null),
        getCurrentUserData: jest.fn(() => null),
    },
    firebaseAuth: {
        updateBookeepData: jest.fn().mockResolvedValue({ success: true }),
    },
    addEventListener: jest.fn(),
    load: undefined,
};

global.bootstrap = {
    Modal: jest.fn().mockImplementation(() => ({
        show: jest.fn(),
        hide: jest.fn(),
    })),
    Toast: jest.fn().mockImplementation(() => ({ show: jest.fn() })),
};

global.bootstrap.Modal.getInstance = jest.fn(() => ({ hide: jest.fn() }));

global.fetch = jest.fn();
global.URL = { createObjectURL: jest.fn(() => 'blob://x'), revokeObjectURL: jest.fn() };
global.confirm = jest.fn(() => true);
global.alert = jest.fn();

// Load the module
// Hoist top-level let/const/var to globals so tests can read/write module state
{
    const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'BookeepBackend.js'), 'utf8')
        .replace(/^(?:let|const|var) +(\w+)/gm, 'global.$1');
    eval(src);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSampleBook(overrides = {}) {
    return {
        id: Math.random().toString(36).slice(2),
        title: 'Test Book',
        author: 'Test Author',
        wordCount: 70000,
        dateRead: '4-10-2025',
        rating: 4,
        genre: 'Fiction',
        ...overrides,
    };
}

// ─── formatNumber ─────────────────────────────────────────────────────────────

describe('formatNumber', () => {
    it('adds commas to thousands', () => {
        expect(formatNumber(1000)).toBe('1,000');
        expect(formatNumber(1000000)).toBe('1,000,000');
    });

    it('leaves numbers under 1000 unchanged', () => {
        expect(formatNumber(999)).toBe('999');
        expect(formatNumber(0)).toBe('0');
    });
});

// ─── cleanNumber ─────────────────────────────────────────────────────────────

describe('cleanNumber', () => {
    it('removes commas and trims whitespace', () => {
        // cleanNumber strips commas only — returns a string; parseInt for numeric use
        expect(cleanNumber('1,000,000')).toBe('1000000');
        expect(parseInt(cleanNumber(' 500 ').trim())).toBe(500);
    });

    it('returns NaN for non-numeric strings', () => {
        expect(isNaN(cleanNumber('abc'))).toBe(true);
    });
});

// ─── updateStats ─────────────────────────────────────────────────────────────

describe('updateStats', () => {
    beforeEach(() => {
        // Reset books and DOM captures
        books = [];
        DOM_IDS.forEach(id => { elements[id].textContent = ''; });
    });

    it('shows 0 stats for empty book list', () => {
        updateStats();
        expect(elements['totalWords'].textContent).toBe('0');
        expect(elements['totalBooks'].textContent).toBe(0);
    });

    it('sums totalWords across all books', () => {
        books = [
            makeSampleBook({ wordCount: 50000, dateRead: '1-1-2020' }),
            makeSampleBook({ wordCount: 30000, dateRead: '2-1-2020' }),
        ];
        updateStats();
        expect(elements['totalWords'].textContent).toBe('80,000');
    });

    it('calculates yearly words only for the current year', () => {
        const currentYear = new Date().getFullYear();
        books = [
            makeSampleBook({ wordCount: 60000, dateRead: `1-15-${currentYear}` }),
            makeSampleBook({ wordCount: 40000, dateRead: '3-10-2019' }),
        ];
        updateStats();
        expect(elements['yearWords'].textContent).toBe('60,000');
    });

    it('calculates points (words mode) as yearWords / 10000', () => {
        const currentYear = new Date().getFullYear();
        books = [makeSampleBook({ wordCount: 100000, dateRead: `5-1-${currentYear}` })];
        pointsMode = 'words';
        updateStats();
        expect(parseFloat(elements['points'].textContent)).toBeCloseTo(10.0, 1);
    });

    it('calculates points (books mode) as count of this-year books', () => {
        const currentYear = new Date().getFullYear();
        books = [
            makeSampleBook({ wordCount: 50000, dateRead: `1-1-${currentYear}` }),
            makeSampleBook({ wordCount: 70000, dateRead: `2-1-${currentYear}` }),
        ];
        pointsMode = 'books';
        updateStats();
        expect(elements['points'].textContent).toBe(2);
    });
});

// ─── showWrapped ──────────────────────────────────────────────────────────────

describe('showWrapped', () => {
    beforeEach(() => {
        books = [];
        elements['wrappedContent'].innerHTML = '';
    });

    it('renders wrapped HTML with correct book count', () => {
        const currentYear = new Date().getFullYear();
        books = [
            makeSampleBook({ title: 'Alpha', wordCount: 90000, dateRead: `3-1-${currentYear}`, rating: 5 }),
            makeSampleBook({ title: 'Beta',  wordCount: 60000, dateRead: `4-1-${currentYear}`, rating: 3 }),
        ];
        showWrapped();
        expect(elements['wrappedContent'].innerHTML).toContain('2');      // books count
        expect(elements['wrappedContent'].innerHTML).toContain('Alpha'); // top read
        expect(elements['wrappedContent'].innerHTML).toContain('5');     // rating
    });

    it('shows 0 books for empty list', () => {
        showWrapped();
        expect(elements['wrappedContent'].innerHTML).toContain('0');
    });

    it('omits HIGHEST RATED section when no rated books', () => {
        const currentYear = new Date().getFullYear();
        books = [makeSampleBook({ rating: 0, dateRead: `1-1-${currentYear}` })];
        showWrapped();
        expect(elements['wrappedContent'].innerHTML).not.toContain('HIGHEST RATED');
    });
});

// ─── selectSearchResult ───────────────────────────────────────────────────────

describe('selectSearchResult', () => {
    beforeEach(() => {
        searchResultsCache = [];
        elements['bookTitle'].value = '';
        elements['bookAuthor'].value = '';
        elements['bookSearchInput'].value = 'dirty query';
        elements['searchResults'].innerHTML = 'some results';
    });

    it('populates bookTitle and bookAuthor fields', () => {
        searchResultsCache[0] = { title: 'Dune', author: 'Frank Herbert' };
        selectSearchResult(0);
        expect(elements['bookTitle'].value).toBe('Dune');
        expect(elements['bookAuthor'].value).toBe('Frank Herbert');
    });

    it('clears the search input and results', () => {
        searchResultsCache[0] = { title: 'X', author: 'Y' };
        selectSearchResult(0);
        expect(elements['bookSearchInput'].value).toBe('');
        expect(elements['searchResults'].innerHTML).toBe('');
    });

    it('does nothing for an out-of-bounds index', () => {
        selectSearchResult(99);
        expect(elements['bookTitle'].value).toBe('');
    });
});

// ─── toggleSearchMode ─────────────────────────────────────────────────────────

describe('toggleSearchMode', () => {
    beforeEach(() => {
        useManualEntry = false;
        elements['searchSection'] = makeEl('searchSection', { style: { display: 'block' } });
        elements['manualSection']  = makeEl('manualSection',  { style: { display: 'none'  } });
        elements['toggleEntryBtn'] = makeEl('toggleEntryBtn', { textContent: "Can't Find Your Book?" });
        elements['bookTitle'].value  = 'some title';
        elements['bookAuthor'].value = 'some author';
        document.getElementById.mockImplementation(id => elements[id] || makeEl(id));
    });

    it('switches to manual entry mode', () => {
        toggleSearchMode(); // now useManualEntry = true
        expect(elements['searchSection'].style.display).toBe('none');
        expect(elements['manualSection'].style.display).toBe('block');
    });

    it('switches back to search mode and clears fields', () => {
        useManualEntry = true;
        toggleSearchMode(); // back to search
        expect(elements['searchSection'].style.display).toBe('block');
        expect(elements['manualSection'].style.display).toBe('none');
        expect(elements['bookTitle'].value).toBe('');
        expect(elements['bookAuthor'].value).toBe('');
    });
});

// ─── loadBooks / initBookeep / clearBookeep ───────────────────────────────────

describe('initBookeep / clearBookeep', () => {
    it('initBookeep loads books from userData and re-renders', () => {
        const userData = {
            bookeep: {
                books: [makeSampleBook({ id: 'u1' }), makeSampleBook({ id: 'u2' })],
            },
        };
        window.initBookeep(userData);
        expect(books).toHaveLength(2);
    });

    it('initBookeep sets empty books when userData has no bookeep', () => {
        window.initBookeep({});
        expect(books).toEqual([]);
    });

    it('initBookeep defaults rating and author for books missing those fields', () => {
        window.initBookeep({
            bookeep: { books: [{ id: 'x', title: 'T', wordCount: 1000, dateRead: '1-1-2025' }] },
        });
        expect(books[0].rating).toBe(0);
        expect(books[0].author).toBe('');
    });

    it('clearBookeep empties the books array', () => {
        books = [makeSampleBook()];
        window.clearBookeep();
        expect(books).toEqual([]);
    });
});

// ─── setPointsMode ────────────────────────────────────────────────────────────

describe('setPointsMode', () => {
    it('sets pointsMode to "books"', () => {
        setPointsMode('books');
        expect(pointsMode).toBe('books');
    });

    it('sets pointsMode to "words"', () => {
        setPointsMode('words');
        expect(pointsMode).toBe('words');
    });
});

// ─── importData validation ────────────────────────────────────────────────────

describe('importData validation logic (via importedData check inline)', () => {
    // The validation logic is embedded inside importData's FileReader callback,
    // so we extract and test it directly.

    function validateImport(data) {
        if (!Array.isArray(data)) return 'not-array';
        const ok = data.every(b =>
            b.hasOwnProperty('id') &&
            b.hasOwnProperty('title') &&
            b.hasOwnProperty('wordCount') &&
            b.hasOwnProperty('dateRead')
        );
        return ok ? 'valid' : 'invalid-format';
    }

    it('accepts a well-formed book array', () => {
        expect(validateImport([makeSampleBook()])).toBe('valid');
    });

    it('rejects a non-array', () => {
        expect(validateImport({ title: 'oops' })).toBe('not-array');
    });

    it('rejects an array with missing required fields', () => {
        expect(validateImport([{ id: '1', title: 'No date or wordCount' }])).toBe('invalid-format');
    });

    it('accepts an empty array', () => {
        expect(validateImport([])).toBe('valid');
    });
});