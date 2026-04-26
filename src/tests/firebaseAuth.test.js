/**
 * firebaseAuth.test.js
 * Unit tests for firebaseAuth.js
 *
 * Run with: npx jest firebaseAuth.test.js
 * (requires jest + @jest/globals, no real Firebase connection needed)
 */

// ─── Environment stubs ────────────────────────────────────────────────────────

global.window = global.window || {};
global.sessionStorage = {
    getItem: jest.fn(() => null),
    setItem: jest.fn(),
    removeItem: jest.fn(),
};
global.localStorage = {
    getItem: jest.fn(() => null),
    setItem: jest.fn(),
    removeItem: jest.fn(),
};

// ─── Mock Firebase SDK ────────────────────────────────────────────────────────

const mockUser = {
    uid: 'uid-abc123',
    email: 'test@example.com',
    displayName: 'TestUser',
    updateProfile: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
};

const mockDocRef = {
    set: jest.fn().mockResolvedValue(undefined),
    update: jest.fn().mockResolvedValue(undefined),
    get: jest.fn(),
    delete: jest.fn().mockResolvedValue(undefined)
};

const mockCollectionRef = {
    doc: jest.fn(() => mockDocRef),
    where: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    get: jest.fn(),
};

const mockAuth = {
    currentUser: null,
    createUserWithEmailAndPassword: jest.fn(),
    signInWithEmailAndPassword: jest.fn(),
    signOut: jest.fn().mockResolvedValue(undefined),
    sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
    onAuthStateChanged: jest.fn(),
};

const mockBatch = {
    set: jest.fn(),
    delete: jest.fn(),
    commit: jest.fn().mockResolvedValue(undefined),
};

const mockTransaction = {
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
};

const mockDb = {
    collection: jest.fn(() => mockCollectionRef),
    batch: jest.fn(() => mockBatch),
    runTransaction: jest.fn(cb => cb(mockTransaction)),
};

mockAuth.Auth = { Persistence: { SESSION: 'session' } };
mockAuth.setPersistence = jest.fn().mockResolvedValue(undefined);

global.firebase = {
    initializeApp: jest.fn(() => ({})),
    auth: Object.assign(jest.fn(() => mockAuth), {
        Auth: { Persistence: { SESSION: 'session' } },
    }),
    firestore: jest.fn(() => mockDb),
    appCheck: jest.fn(() => ({
        getToken: jest.fn(),
        activate: jest.fn(),
    })),
};

// Load the module under test (globals-style, no ES module export)
eval(require('fs').readFileSync(require('path').join(__dirname, '..', 'firebaseAuth.js'), 'utf8')
    .replace("const firebaseConfig = {", "const firebaseConfig = {")
);

// The module assigns to window.firebaseAuth, not global.firebaseAuth
const fa = global.window.firebaseAuth;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resetMocks() {
    jest.clearAllMocks();
    mockAuth.currentUser = null;
    mockAuth.setPersistence = jest.fn().mockResolvedValue(undefined);
    mockDocRef.get.mockResolvedValue({ exists: false });
    mockCollectionRef.get.mockResolvedValue({ empty: false, docs: [{ data: () => ({ email: 'test@example.com' }) }] });
    mockAuth.createUserWithEmailAndPassword.mockResolvedValue({ user: mockUser });
    mockAuth.signInWithEmailAndPassword.mockResolvedValue({ user: mockUser });
    mockBatch.set.mockReset();
    mockBatch.delete.mockReset();
    mockBatch.commit.mockResolvedValue(undefined);
    mockTransaction.get.mockResolvedValue({ exists: false });
    // By default the username doc does NOT exist (so signUp can proceed)
    mockDocRef.get.mockResolvedValue({ exists: false });
    // But signIn needs the user doc to exist after sign-in
    mockDb.collection.mockReturnValue(mockCollectionRef);
}

// ─── createUserData shape ─────────────────────────────────────────────────────

describe('createUserData', () => {
    it('returns an object with the correct top-level keys', () => {
        const data = createUserData('uid-1', 'a@b.com', 'alice');
        expect(data).toHaveProperty('uid', 'uid-1');
        expect(data).toHaveProperty('email', 'a@b.com');
        expect(data).toHaveProperty('username', 'alice');
        expect(data).toHaveProperty('createdAt');
        expect(data).toHaveProperty('preferences');
        expect(data).toHaveProperty('bookeep');
        expect(data).toHaveProperty('bookhelp');
        expect(data).toHaveProperty('bookstats');
        expect(data).toHaveProperty('booknotes');
    });

    it('initialises bookeep with empty books array and zero counts', () => {
        const { bookeep } = createUserData('u', 'e', 'n');
        expect(bookeep.books).toEqual([]);
        expect(bookeep.totalWords).toBe(0);
        expect(bookeep.totalBooks).toBe(0);
    });

    it('initialises bookhelp.lastComprehensionTest with score 0', () => {
        const { bookhelp } = createUserData('u', 'e', 'n');
        expect(bookhelp.lastComprehensionTest.score).toBe(0);
        expect(bookhelp.lastComprehensionTest.percentage).toBe(0);
    });

    it('initialises booknotes with empty collections array', () => {
        const { booknotes } = createUserData('u', 'e', 'n');
        expect(booknotes.collections).toEqual([]);
    });
});

// ─── signUp ───────────────────────────────────────────────────────────────────

describe('signUp', () => {
    beforeEach(resetMocks);

    it('returns success:true and user on happy path', async () => {
        const result = await fa.signUp('new@example.com', 'newuser', 'password123');

        expect(result.success).toBe(true);
        expect(result.user).toBe(mockUser);
        expect(mockAuth.createUserWithEmailAndPassword).toHaveBeenCalled();
        expect(mockBatch.commit).toHaveBeenCalled();
    });

    it('validates email before doing anything', async () => {
        const result = await fa.signUp('bad-email', 'user', 'pw');

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/valid email/i);
        expect(mockAuth.createUserWithEmailAndPassword).not.toHaveBeenCalled();
    });

    it('validates username format', async () => {
        const result = await fa.signUp('a@b.com', '!!', 'pw');

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/Username must/);
    });

    it('fails if username already exists', async () => {
        // The actual code does usernameRef.get() — mock the doc as existing
        mockDocRef.get.mockResolvedValueOnce({ exists: true });

        const result = await fa.signUp('a@b.com', 'taken', 'pw');

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/already taken/i);
    });

    it('sets username to lowercase in updateProfile', async () => {
        await fa.signUp('a@b.com', 'MyName', 'pw');

        expect(mockUser.updateProfile).toHaveBeenCalledWith({
            displayName: 'myname',
        });
    });

    it('writes user + username via batch', async () => {
        await fa.signUp('a@b.com', 'user123', 'pw');

        expect(mockBatch.set).toHaveBeenCalledTimes(2);
        expect(mockBatch.commit).toHaveBeenCalled();
    });

    it('returns success:false when batch commit fails', async () => {
        mockBatch.commit.mockRejectedValueOnce(new Error('fail'));

        const result = await fa.signUp('a@b.com', 'user123', 'pw');

        expect(result.success).toBe(false);
    });

    it('maps Firebase auth errors to friendly messages', async () => {
        mockAuth.createUserWithEmailAndPassword.mockRejectedValueOnce({
            code: 'auth/email-already-in-use',
        });

        const result = await fa.signUp('dup@example.com', 'user', 'pw');

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/already in use/i);
    });
});

// ─── signIn ───────────────────────────────────────────────────────────────────

describe('signIn', () => {
    beforeEach(() => {
        resetMocks();
        // signIn with email: the user doc must exist after signInWithEmailAndPassword
        mockDocRef.get.mockResolvedValue({ exists: true, data: () => ({ email: 'test@example.com' }) });
    });

    it('signs in with email directly when @ is present', async () => {
        const result = await fa.signIn('test@example.com', 'pw');
        expect(result.success).toBe(true);
        expect(mockAuth.signInWithEmailAndPassword).toHaveBeenCalledWith('test@example.com', 'pw');
    });

    it('looks up email by username when no @ present', async () => {
        // username doc returns uid, then user doc returns email
        mockDocRef.get
            .mockResolvedValueOnce({ exists: true, data: () => ({ uid: mockUser.uid }) })  // usernames/testuser
            .mockResolvedValueOnce({ exists: true, data: () => ({ email: 'test@example.com' }) }) // users/uid (email lookup)
            .mockResolvedValueOnce({ exists: true, data: () => ({ uid: mockUser.uid }) }); // users/uid (after signIn)
        const result = await fa.signIn('TestUser', 'pw');
        expect(result.success).toBe(true);
        expect(mockCollectionRef.doc).toHaveBeenCalledWith('testuser');
    });

    it('returns success:false when username not found', async () => {
        mockDocRef.get.mockResolvedValueOnce({ exists: false });
        const result = await fa.signIn('ghost', 'pw');
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/Username not found/);
    });

    it('returns success:false and signs out when user doc missing in Firestore', async () => {
        mockDocRef.get.mockResolvedValueOnce({ exists: false });
        const result = await fa.signIn('test@example.com', 'pw');
        expect(result.success).toBe(false);
        expect(mockAuth.signOut).toHaveBeenCalled();
    });

    it('returns success:false on bad credentials', async () => {
        mockAuth.signInWithEmailAndPassword.mockRejectedValueOnce(new Error('wrong-password'));
        mockAuth.currentUser = mockUser;
        const result = await fa.signIn('test@example.com', 'badpw');
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/wrong-password/);
    });
});

// ─── signOut ──────────────────────────────────────────────────────────────────

describe('signOut', () => {
    it('returns success:true on happy path', async () => {
        const result = await fa.signOut();
        expect(result.success).toBe(true);
    });

    it('returns success:false if auth.signOut throws', async () => {
        mockAuth.signOut.mockRejectedValueOnce(new Error('network error'));
        const result = await fa.signOut();
        expect(result.success).toBe(false);
    });
});

// ─── resetPassword ────────────────────────────────────────────────────────────

describe('resetPassword', () => {
    it('returns success:true on happy path', async () => {
        const result = await fa.resetPassword('a@b.com');
        expect(result.success).toBe(true);
        expect(mockAuth.sendPasswordResetEmail).toHaveBeenCalledWith('a@b.com');
    });

    it('returns success:false on error', async () => {
        mockAuth.sendPasswordResetEmail.mockRejectedValueOnce(new Error('user-not-found'));
        const result = await fa.resetPassword('nobody@b.com');
        expect(result.success).toBe(false);
    });
});

// ─── getUserData ──────────────────────────────────────────────────────────────

describe('getUserData', () => {
    beforeEach(resetMocks);

    it('returns document data when doc exists', async () => {
        mockDocRef.get.mockResolvedValueOnce({ exists: true, data: () => ({ uid: 'uid-abc123' }) });
        const data = await fa.getUserData('uid-abc123');
        expect(data).toEqual({ uid: 'uid-abc123' });
    });

    it('returns null when doc does not exist', async () => {
        mockDocRef.get.mockResolvedValueOnce({ exists: false });
        const data = await fa.getUserData('uid-missing');
        expect(data).toBeNull();
    });

    it('returns null on Firestore error', async () => {
        mockDocRef.get.mockRejectedValueOnce(new Error('permission-denied'));
        const data = await fa.getUserData('uid-x');
        expect(data).toBeNull();
    });
});

// ─── updateBookeepData ────────────────────────────────────────────────────────

describe('updateBookeepData', () => {
    beforeEach(resetMocks);

    const sampleBooks = [
        { id: '1', title: 'Book A', wordCount: 50000, dateRead: '3-15-2024' },
        { id: '2', title: 'Book B', wordCount: 80000, dateRead: '6-20-2024' },
        { id: '3', title: 'Book C', wordCount: 70000, dateRead: '1-5-2025' },
    ];

    it('calculates totalWords correctly', async () => {
        await fa.updateBookeepData('uid-1', sampleBooks);
        const updateArg = mockDocRef.update.mock.calls[0][0];
        expect(updateArg['bookeep.totalWords']).toBe(200000);
    });

    it('calculates totalBooks correctly', async () => {
        await fa.updateBookeepData('uid-1', sampleBooks);
        const updateArg = mockDocRef.update.mock.calls[0][0];
        expect(updateArg['bookeep.totalBooks']).toBe(3);
    });

    it('groups yearlyWordCount by year from M-D-YYYY date format', async () => {
        await fa.updateBookeepData('uid-1', sampleBooks);
        const updateArg = mockDocRef.update.mock.calls[0][0];
        expect(updateArg['bookeep.yearlyWordCount'][2024]).toBe(130000);
        expect(updateArg['bookeep.yearlyWordCount'][2025]).toBe(70000);
    });

    it('handles empty books array gracefully', async () => {
        await fa.updateBookeepData('uid-1', []);
        const updateArg = mockDocRef.update.mock.calls[0][0];
        expect(updateArg['bookeep.totalWords']).toBe(0);
        expect(updateArg['bookeep.totalBooks']).toBe(0);
    });

    it('returns success:false on Firestore error', async () => {
        mockDocRef.update.mockRejectedValueOnce(new Error('write failed'));
        const result = await fa.updateBookeepData('uid-1', sampleBooks);
        expect(result.success).toBe(false);
    });
});

// ─── updateBookHelpData ───────────────────────────────────────────────────────

describe('updateBookHelpData', () => {
    beforeEach(resetMocks);

    it('only writes fields that are present in the payload', async () => {
        await fa.updateBookHelpData('uid-1', { wpmSpeed: 320 });
        const updateArg = mockDocRef.update.mock.calls[0][0];
        // Firestore update uses literal dot-notation keys, not nested objects
        expect(updateArg['bookhelp.wpmSpeed']).toBe(320);
        expect(Object.keys(updateArg)).toHaveLength(1);
    });

    it('writes goals when provided', async () => {
        const goals = { wpmGoal: 400, compGoal: 80, compStreak: 5 };
        await fa.updateBookHelpData('uid-1', { goals });
        const updateArg = mockDocRef.update.mock.calls[0][0];
        expect(updateArg['bookhelp.goals']).toEqual(goals);
    });

    it('returns success:false on error', async () => {
        mockDocRef.update.mockRejectedValueOnce(new Error('err'));
        const result = await fa.updateBookHelpData('uid-1', { wpmSpeed: 300 });
        expect(result.success).toBe(false);
    });
});

// ─── updateBookStatsData ──────────────────────────────────────────────────────

describe('updateBookStatsData', () => {
    beforeEach(resetMocks);

    it('writes comprehensionTestsCompleted when value is 0 (falsy edge case)', async () => {
        await fa.updateBookStatsData('uid-1', { comprehensionTestsCompleted: 0 });
        // Note: the implementation uses `!== undefined` check, so 0 should be written
        const updateArg = mockDocRef.update.mock.calls[0][0];
        // Firestore update uses literal dot-notation keys
        expect(updateArg['bookstats.comprehensionTestsCompleted']).toBe(0);
    });

    it('does not write keys absent from payload', async () => {
        await fa.updateBookStatsData('uid-1', { wordCountsByMonth: { '2024-01': 5000 } });
        const updateArg = mockDocRef.update.mock.calls[0][0];
        expect(Object.keys(updateArg)).toEqual(['bookstats.wordCountsByMonth']);
    });
});

// ─── updateBookNotesData ──────────────────────────────────────────────────────

describe('updateBookNotesData', () => {
    beforeEach(resetMocks);

    it('writes collections to the correct Firestore path', async () => {
        const collections = [{ id: 'col1', title: 'Gatsby Notes', notes: [] }];
        await fa.updateBookNotesData('uid-1', collections);
        const updateArg = mockDocRef.update.mock.calls[0][0];
        expect(updateArg['booknotes.collections']).toEqual(collections);
    });
});

// ─── migrateLocalStorageToFirebase ────────────────────────────────────────────

describe('migrateLocalStorageToFirebase', () => {
    beforeEach(() => {
        resetMocks();
        global.localStorage = {
            getItem: jest.fn(),
            setItem: jest.fn(),
            removeItem: jest.fn(),
        };
    });

    it('migrates books from localStorage when data exists', async () => {
        const storedBooks = [{ id: '1', title: 'Migrated Book', wordCount: 30000, dateRead: '1-1-2024' }];
        global.localStorage.getItem.mockReturnValueOnce(JSON.stringify(storedBooks));
        const result = await fa.migrateLocalStorageToFirebase('uid-1');
        expect(result.success).toBe(true);
        expect(mockDocRef.update).toHaveBeenCalled();
    });

    it('succeeds silently when no localStorage data exists', async () => {
        global.localStorage.getItem.mockReturnValueOnce(null);
        const result = await fa.migrateLocalStorageToFirebase('uid-1');
        expect(result.success).toBe(true);
        expect(mockDocRef.update).not.toHaveBeenCalled();
    });
});