/**
 * BookNotesBackend.test.js
 * Unit tests for BookNotesBackend.js
 *
 * Run with: npx jest BookNotesBackend.test.js
 */

// ─── Stubs ────────────────────────────────────────────────────────────────────

global.window = {
    authUI: {
        getCurrentUser: jest.fn(() => null),
        getCurrentUserData: jest.fn(() => null),
    },
    firebaseAuth: {
        updateBookNotesData: jest.fn().mockResolvedValue({ success: true }),
    },
};

const elements = {};

function makeEl(id = '') {
    return {
        id,
        innerHTML: '',
        textContent: '',
        value: '',
        style: {},
        dataset: {},
        className: '',
        remove: jest.fn(),
        addEventListener: jest.fn(),
        focus: jest.fn(),
        querySelector: jest.fn(() => null),
    };
}

global.document = {
    getElementById: jest.fn(id => elements[id] || null),
    createElement: jest.fn(tag => {
        // Simulate real DOM: setting textContent escapes HTML chars in innerHTML
        const el = {
            id: '',
            className: '',
            style: {},
            dataset: {},
            remove: jest.fn(),
            addEventListener: jest.fn(),
            focus: jest.fn(),
            querySelector: jest.fn(() => null),
            appendChild: jest.fn(),
            _text: '',
            get innerHTML() { return this._text; },
            set innerHTML(v) { this._text = v; },
            get textContent() { return this._text; },
            set textContent(v) {
                this._text = String(v)
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;');
            },
        };
        return el;
    }),
    querySelector: jest.fn(() => null),
    querySelectorAll: jest.fn(() => []),
    body: {
        appendChild: jest.fn(el => { elements[el.id] = el; }),
        removeChild: jest.fn(),
    },
    addEventListener: jest.fn(),
};

global.localStorage = {
    getItem: jest.fn(() => null),
    setItem: jest.fn(),
    removeItem: jest.fn(),
};

global.alert  = jest.fn();
global.confirm = jest.fn(() => true);

// Load module
// Hoist top-level let/const/var to globals so tests can read/write module state
{
    const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'BookNotesBackend.js'), 'utf8')
        .replace(/^(?:let|const|var) +(\w+)/gm, 'global.$1');
    eval(src);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeCollection(overrides = {}) {
    return {
        id: bnGenId(),
        title: 'Test Collection',
        color: '#f9e04b',
        createdAt: new Date().toISOString(),
        notes: [],
        ...overrides,
    };
}

function makeNote(overrides = {}) {
    return {
        id: bnGenId(),
        title: 'Test Note',
        color: '#a8e6cf',
        pageNumber: '42',
        text: 'Some note text here.',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...overrides,
    };
}

// ─── bnGenId ──────────────────────────────────────────────────────────────────

describe('bnGenId', () => {
    it('generates unique IDs', () => {
        const ids = new Set(Array.from({ length: 100 }, () => bnGenId()));
        expect(ids.size).toBe(100);
    });

    it('returns a non-empty string', () => {
        const id = bnGenId();
        expect(typeof id).toBe('string');
        expect(id.length).toBeGreaterThan(0);
    });
});

// ─── escBN ────────────────────────────────────────────────────────────────────

describe('escBN', () => {
    it('escapes < and > to prevent XSS', () => {
        // escBN uses a real DOM div — mock it
        const fakeDiv = {
            textContent: '',
            get innerHTML() { return this.textContent.replace(/</g, '&lt;').replace(/>/g, '&gt;'); },
        };
        document.createElement.mockReturnValueOnce(fakeDiv);
        const result = escBN('<script>alert(1)</script>');
        expect(result).not.toContain('<script>');
    });

    it('returns empty string for null/undefined input', () => {
        const fakeDiv = { textContent: '', innerHTML: '' };
        document.createElement.mockReturnValueOnce(fakeDiv);
        expect(escBN(null)).toBe('');
    });
});

// ─── escAttr ──────────────────────────────────────────────────────────────────

describe('escAttr', () => {
    it('escapes double-quotes', () => {
        expect(escAttr('say "hello"')).toBe('say &quot;hello&quot;');
    });

    it('escapes single-quotes', () => {
        expect(escAttr("it's")).toBe("it&#39;s");
    });

    it('returns empty string for null/undefined', () => {
        expect(escAttr(null)).toBe('');
        expect(escAttr(undefined)).toBe('');
    });
});

// ─── truncBN ─────────────────────────────────────────────────────────────────

describe('truncBN', () => {
    it('truncates to specified length and appends ellipsis', () => {
        const result = truncBN('abcdefghij', 5);
        expect(result).toBe('abcde…');
    });

    it('does not truncate strings at or below the limit', () => {
        expect(truncBN('hello', 10)).toBe('hello');
        expect(truncBN('hello', 5)).toBe('hello');
    });

    it('returns empty string for null input', () => {
        expect(truncBN(null, 10)).toBe('');
    });
});

// ─── bnLoad ───────────────────────────────────────────────────────────────────

describe('bnLoad', () => {
    beforeEach(() => {
        bnCollections = [];
        global.localStorage.getItem.mockReset();
    });

    it('loads collections from userData when provided', () => {
        const userData = { booknotes: { collections: [makeCollection({ title: 'From Firebase' })] } };
        bnLoad(userData);
        expect(bnCollections).toHaveLength(1);
        expect(bnCollections[0].title).toBe('From Firebase');
    });

    it('falls back to localStorage when no userData', () => {
        const stored = [makeCollection({ title: 'From LS' })];
        global.localStorage.getItem.mockReturnValueOnce(JSON.stringify(stored));
        bnLoad(null);
        expect(bnCollections).toHaveLength(1);
        expect(bnCollections[0].title).toBe('From LS');
    });

    it('sets empty array when both userData and localStorage are empty', () => {
        global.localStorage.getItem.mockReturnValueOnce(null);
        bnLoad(null);
        expect(bnCollections).toEqual([]);
    });
});

// ─── bnSave (guest path) ──────────────────────────────────────────────────────

describe('bnSave (guest/localStorage path)', () => {
    beforeEach(() => {
        window.authUI.getCurrentUser.mockReturnValue(null);
        global.localStorage.setItem.mockReset();
    });

    it('saves to localStorage when no user is logged in', async () => {
        bnCollections = [makeCollection()];
        await bnSave();
        expect(global.localStorage.setItem).toHaveBeenCalledWith(
            'booknotes_collections',
            JSON.stringify(bnCollections)
        );
    });
});

// ─── bnSave (logged-in path) ──────────────────────────────────────────────────

describe('bnSave (Firebase path)', () => {
    beforeEach(() => {
        window.authUI.getCurrentUser.mockReturnValue({ uid: 'uid-test' });
        window.authUI.getCurrentUserData.mockReturnValue({ booknotes: {} });
        window.firebaseAuth.updateBookNotesData.mockResolvedValue({ success: true });
    });

    it('calls updateBookNotesData with uid and collections', async () => {
        bnCollections = [makeCollection()];
        await bnSave();
        expect(window.firebaseAuth.updateBookNotesData)
            .toHaveBeenCalledWith('uid-test', bnCollections);
    });

    it('updates the local userData cache', async () => {
        const userData = { booknotes: {} };
        window.authUI.getCurrentUserData.mockReturnValue(userData);
        bnCollections = [makeCollection({ title: 'Updated' })];
        await bnSave();
        expect(userData.booknotes.collections).toEqual(bnCollections);
    });
});

// ─── initBookNotes ────────────────────────────────────────────────────────────

describe('initBookNotes', () => {
    it('loads userData and calls bnRenderGrid without throwing', () => {
        const mainEl = makeEl('bnMain');
        elements['bnMain'] = mainEl;
        document.getElementById.mockImplementation(id => elements[id] || null);

        const userData = { booknotes: { collections: [makeCollection()] } };
        expect(() => window.initBookNotes(userData)).not.toThrow();
        expect(bnCollections).toHaveLength(1);
    });
});

// ─── bnRenderGrid ─────────────────────────────────────────────────────────────

describe('bnRenderGrid', () => {
    let mainEl;
    beforeEach(() => {
        mainEl = makeEl('bnMain');
        elements['bnMain'] = mainEl;
        document.getElementById.mockImplementation(id => elements[id] || null);
        bnCollections = [];
        bnActiveColIdx = 5; // should be reset to null
    });

    it('resets bnActiveColIdx to null', () => {
        bnRenderGrid();
        expect(bnActiveColIdx).toBeNull();
    });

    it('renders empty state message when no collections', () => {
        bnRenderGrid();
        expect(mainEl.innerHTML).toContain('No collections yet');
    });

    it('renders a card for each collection', () => {
        bnCollections = [
            makeCollection({ title: 'Gatsby' }),
            makeCollection({ title: 'Dune' }),
        ];
        bnRenderGrid();
        expect(mainEl.innerHTML).toContain('Gatsby');
        expect(mainEl.innerHTML).toContain('Dune');
    });

    it('renders note count correctly (singular/plural)', () => {
        bnCollections = [
            makeCollection({ notes: [makeNote()] }),
            makeCollection({ notes: [makeNote(), makeNote()] }),
        ];
        bnRenderGrid();
        expect(mainEl.innerHTML).toContain('1 note');
        expect(mainEl.innerHTML).toContain('2 notes');
    });
});

// ─── bnOpenCollection / bnRenderNotes ─────────────────────────────────────────

describe('bnOpenCollection / bnRenderNotes', () => {
    let mainEl;
    beforeEach(() => {
        mainEl = makeEl('bnMain');
        elements['bnMain'] = mainEl;
        document.getElementById.mockImplementation(id => elements[id] || null);
        bnCollections = [
            makeCollection({ title: 'Novels', notes: [makeNote({ title: 'Ch1 Note' })] }),
        ];
    });

    it('sets bnActiveColIdx and renders notes', () => {
        bnOpenCollection(0);
        expect(bnActiveColIdx).toBe(0);
        expect(mainEl.innerHTML).toContain('Novels');
        expect(mainEl.innerHTML).toContain('Ch1 Note');
    });

    it('renders empty state when collection has no notes', () => {
        bnCollections[0].notes = [];
        bnOpenCollection(0);
        expect(mainEl.innerHTML).toContain('No notes yet');
    });

    it('renders page number when present', () => {
        bnCollections[0].notes[0].pageNumber = '77';
        bnOpenCollection(0);
        expect(mainEl.innerHTML).toContain('p. 77');
    });

    it('omits page number element when absent', () => {
        bnCollections[0].notes[0].pageNumber = '';
        bnOpenCollection(0);
        expect(mainEl.innerHTML).not.toContain('p. ');
    });
});

// ─── bnDeleteNote ─────────────────────────────────────────────────────────────

describe('bnDeleteNote', () => {
    let mainEl;
    beforeEach(() => {
        mainEl = makeEl('bnMain');
        elements['bnMain'] = mainEl;
        document.getElementById.mockImplementation(id => elements[id] || null);
        bnCollections = [makeCollection({ notes: [makeNote({ id: 'n1' }), makeNote({ id: 'n2' })] })];
        bnActiveColIdx = 0;
        window.authUI.getCurrentUser.mockReturnValue(null);
        global.confirm.mockReturnValue(true);
    });

    it('removes the note at the given index', async () => {
        await bnDeleteNote(0);
        expect(bnCollections[0].notes).toHaveLength(1);
        expect(bnCollections[0].notes[0].id).toBe('n2');
    });

    it('does NOT delete when user cancels confirm', async () => {
        global.confirm.mockReturnValueOnce(false);
        await bnDeleteNote(0);
        expect(bnCollections[0].notes).toHaveLength(2);
    });
});

// ─── bnRemoveOverlay ─────────────────────────────────────────────────────────

describe('bnRemoveOverlay', () => {
    it('calls remove() on the overlay element when it exists', () => {
        const overlay = makeEl('bnOverlay');
        elements['bnOverlay'] = overlay;
        document.getElementById.mockImplementation(id => elements[id] || null);
        bnRemoveOverlay();
        expect(overlay.remove).toHaveBeenCalled();
    });

    it('does not throw when overlay does not exist', () => {
        document.getElementById.mockReturnValueOnce(null);
        expect(() => bnRemoveOverlay()).not.toThrow();
    });
});