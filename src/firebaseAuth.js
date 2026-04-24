const firebaseConfig = {
    apiKey: "AIzaSyBXyJ0NwwUOLKcySjtidGBTT0ovDAu4kFg",
    authDomain: "book-center-official.firebaseapp.com",
    projectId: "book-center-official",
    storageBucket: "book-center-official.firebasestorage.app",
    messagingSenderId: "643017020575",
    appId: "1:643017020575:web:05c660b81624202e5c3eaa",
    measurementId: "G-ZQKRMEHFY2"
};

const app = firebase.initializeApp(firebaseConfig);

// ── App Check (reCAPTCHA v3) ──────────────────────────────────────────────
// Replace YOUR_RECAPTCHA_SITE_KEY with the key from Firebase Console →
// App Check → Apps → your web app → reCAPTCHA v3 site key.
firebase.appCheck().activate('6LePOMgsAAAAAPmQAYzIA7JMDbevwsiNC0ABMrsh', true);

const auth = firebase.auth();
const db = firebase.firestore();

auth.setPersistence(firebase.auth.Auth.Persistence.SESSION)
    .catch(err => console.error('Persistence error:', err));

// ── Session constants ──────────────────────────────────────────────────
const SESSION_LOGIN_KEY = 'bc_login_time';    // timestamp of last sign-in
const SESSION_MAX_MS    = 24 * 60 * 60 * 1000; // 24-hour absolute limit
const SESSION_IDLE_MS   = 60 * 60 * 1000;    // 1-hour idle timeout
const SESSION_IDLE_KEY  = 'bc_last_active';  // timestamp of last user activity

// ── Session age helpers ───────────────────────────────────────────────

function recordLoginTime() {
    const now = Date.now();
    sessionStorage.setItem(SESSION_LOGIN_KEY, now);
    sessionStorage.setItem(SESSION_IDLE_KEY, now);
}

function touchActivity() {
    sessionStorage.setItem(SESSION_IDLE_KEY, Date.now());
}

// Returns true if the session has exceeded the 24-hour absolute limit
// OR the user has been idle for more than 1 hour.
function isSessionExpired() {
    const loginTime  = parseInt(sessionStorage.getItem(SESSION_LOGIN_KEY) || '0');
    const lastActive = parseInt(sessionStorage.getItem(SESSION_IDLE_KEY)  || '0');
    if (!loginTime) return false; // no timestamp means fresh load, let Firebase decide
    const now = Date.now();
    if (now - loginTime  > SESSION_MAX_MS)  return true;
    if (now - lastActive > SESSION_IDLE_MS) return true;
    return false;
}

function createUserData(uid, email, username) {
    return {
        uid: uid,
        email: email,
        username: username,
        createdAt: new Date().toISOString(),
        preferences: {
            darkMode: false
        },
        
        bookeep: {
            books: [],
            totalWords: 0,
            yearlyWordCount: {},
            totalBooks: 0,
            yearlyPoints: {}
        },
        
        bookhelp: {
            wpmSpeed: null,
            wpmHistory: [],
            recommendations: [],
            lastComprehensionTest: {
                score: 0,
                total: 5,
                percentage: 0,
                date: null
            },
            comprehensionHistory: [],
            totalReadingTime: 0,
            readingTimeByMonth: {},
            goals: {
                wpmGoal: null,
                compGoal: null,
                compStreak: 0
            }
        },
        
        bookstats: {
            completedBooksByMonth: {},
            comprehensionTestsCompleted: 0,
            comprehensionTestResults: [],
            readingTimeByMonth: {},
            wordCountsByMonth: {},
            pointsByMonth: {}
        },
        
        booknotes: {
            collections: []
        }
    };
}

function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validateUsername(username) {
    return /^[a-zA-Z0-9_]{3,20}$/.test(username);
}

function mapAuthError(error) {
    if (error.code === 'auth/email-already-in-use') {
        return "That email is already in use.";
    }
    if (error.code === 'auth/weak-password') {
        return "Password should be at least 6 characters.";
    }
    if (error.code === 'auth/invalid-email') {
        return "Invalid email address.";
    }
    return "Something went wrong. Please try again.";
}

async function signUp(email, username, password) {

    // 0. Validate inputs
    if (!validateEmail(email)) {
        return { success: false, error: "Please enter a valid email address." };
    }

    if (!validateUsername(username)) {
        return { success: false, error: "Username must be 3–20 characters and contain only letters, numbers, or underscores." };
    }

    const usernameKey = username.toLowerCase().trim();
    const usernameRef = db.collection('usernames').doc(usernameKey);

    try {
        // ── 1. CHECK username FIRST (no writes yet)
        const snap = await usernameRef.get();
        if (snap.exists) {
            return { success: false, error: "That username is already taken." };
        }

        // ── 2. Create auth user
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;

        await user.updateProfile({ displayName: usernameKey });

        // ── 3. Commit both writes ONCE
        const batch = db.batch();

        batch.set(usernameRef, {
            uid: user.uid,
            status: 'active',
            createdAt: new Date().toISOString()
        });

        batch.set(
            db.collection('users').doc(user.uid),
            createUserData(user.uid, email, usernameKey)
        );

        await batch.commit();

        return { success: true, user };

    } catch (error) {
        console.error("Sign up error:", error);

        return {
            success: false,
            error: mapAuthError(error)
        };
    }
}

async function signIn(emailOrUsername, password) {
    try {
        let email = emailOrUsername;
        
        if (!emailOrUsername.includes('@')) {
            // O(1) direct-read via the `usernames` collection (doc ID = lowercase username).
            const usernameSnap = await db.collection('usernames')
                .doc(emailOrUsername.toLowerCase())
                .get();

            if (!usernameSnap.exists) {
                return { success: false, error: 'Username not found' };
            }

            const uid = usernameSnap.data().uid;
            const userDocForEmail = await db.collection('users').doc(uid).get();
            if (!userDocForEmail.exists) {
                return { success: false, error: 'User data not found. Please contact support.' };
            }
            email = userDocForEmail.data().email;
        }
        
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        const userDoc = await db.collection('users').doc(user.uid).get();
        if (!userDoc.exists) {
            await auth.signOut();
            return { success: false, error: "User data not found. Please contact support." };
        }
        
        return { success: true, user: user };
    } catch (error) {
        console.error("Sign in error:", error);
        
        if (auth.currentUser) {
            try {
                await auth.signOut();
            } catch (signOutError) {
                console.error("Error signing out after failed login:", signOutError);
            }
        }
        
        return { success: false, error: error.message };
    }
}

async function signOut() {
    try {
        await auth.signOut();
        return { success: true };
    } catch (error) {
        console.error("Sign out error:", error);
        return { success: false, error: error.message };
    }
}

async function resetPassword(email) {
    try {
        await auth.sendPasswordResetEmail(email);
        return { success: true };
    } catch (error) {
        console.error("Password reset error:", error);
        return { success: false, error: error.message };
    }
}

async function getUserData(uid) {
    try {
        const doc = await db.collection('users').doc(uid).get();
        if (doc.exists) {
            return doc.data();
        }
        return null;
    } catch (error) {
        console.error("Error fetching user data:", error);
        return null;
    }
}

async function updateUserData(uid, data) {
    try {
        await db.collection('users').doc(uid).update(data);
        return { success: true };
    } catch (error) {
        console.error("Error updating user data:", error);
        return { success: false, error: error.message };
    }
}

async function updateBookeepData(uid, books) {
    try {
        const currentYear = new Date().getFullYear();
        
        const totalWords = books.reduce((sum, book) => sum + book.wordCount, 0);
        const totalBooks = books.length;
        
        const yearlyWordCount = {};
        const yearlyPoints = {};
        
        books.forEach(book => {
            const parts = book.dateRead.split('-');
            if (parts.length === 3) {
                const year = parseInt(parts[2]);
                yearlyWordCount[year] = (yearlyWordCount[year] || 0) + book.wordCount;
                yearlyPoints[year] = (yearlyWordCount[year] || 0) / 10000;
            }
        });
        
        await db.collection('users').doc(uid).update({
            'bookeep.books': books,
            'bookeep.totalWords': totalWords,
            'bookeep.yearlyWordCount': yearlyWordCount,
            'bookeep.totalBooks': totalBooks,
            'bookeep.yearlyPoints': yearlyPoints
        });
        
        return { success: true };
    } catch (error) {
        console.error("Error updating Bookeep data:", error);
        return { success: false, error: error.message };
    }
}

async function updateBookHelpData(uid, data) {
    try {
        const updateData = {};
        if (data.wpmSpeed !== undefined) updateData['bookhelp.wpmSpeed'] = data.wpmSpeed;
        if (data.wpmHistory) updateData['bookhelp.wpmHistory'] = data.wpmHistory;
        if (data.recommendations) updateData['bookhelp.recommendations'] = data.recommendations;
        if (data.lastComprehensionTest) updateData['bookhelp.lastComprehensionTest'] = data.lastComprehensionTest;
        if (data.comprehensionHistory) updateData['bookhelp.comprehensionHistory'] = data.comprehensionHistory;
        if (data.totalReadingTime !== undefined) updateData['bookhelp.totalReadingTime'] = data.totalReadingTime;
        if (data.readingTimeByMonth) updateData['bookhelp.readingTimeByMonth'] = data.readingTimeByMonth;
        if (data.goals !== undefined) updateData['bookhelp.goals'] = data.goals;
        
        await db.collection('users').doc(uid).update(updateData);
        return { success: true };
    } catch (error) {
        console.error("Error updating BookHelp data:", error);
        return { success: false, error: error.message };
    }
}

async function updateBookStatsData(uid, data) {
    try {
        const updateData = {};
        if (data.completedBooksByMonth) updateData['bookstats.completedBooksByMonth'] = data.completedBooksByMonth;
        if (data.comprehensionTestsCompleted !== undefined) updateData['bookstats.comprehensionTestsCompleted'] = data.comprehensionTestsCompleted;
        if (data.comprehensionTestResults) updateData['bookstats.comprehensionTestResults'] = data.comprehensionTestResults;
        if (data.readingTimeByMonth) updateData['bookstats.readingTimeByMonth'] = data.readingTimeByMonth;
        if (data.wordCountsByMonth) updateData['bookstats.wordCountsByMonth'] = data.wordCountsByMonth;
        if (data.pointsByMonth) updateData['bookstats.pointsByMonth'] = data.pointsByMonth;
        
        await db.collection('users').doc(uid).update(updateData);
        return { success: true };
    } catch (error) {
        console.error("Error updating BookStats data:", error);
        return { success: false, error: error.message };
    }
}

async function updateBookNotesData(uid, collections) {
    try {
        await db.collection('users').doc(uid).update({
            'booknotes.collections': collections
        });
        return { success: true };
    } catch (error) {
        console.error("Error updating BookNotes data:", error);
        return { success: false, error: error.message };
    }
}

async function updateUserPreferences(uid, preferences) {
    try {
        await db.collection('users').doc(uid).update({
            'preferences': preferences
        });
        return { success: true };
    } catch (error) {
        console.error("Error updating preferences:", error);
        return { success: false, error: error.message };
    }
}

async function migrateLocalStorageToFirebase(uid) {
    try {
        const bookeepData = localStorage.getItem('bookeep_books');
        if (bookeepData) {
            const books = JSON.parse(bookeepData);
            await updateBookeepData(uid, books);
        }
        
        return { success: true };
    } catch (error) {
        console.error("Migration error:", error);
        return { success: false, error: error.message };
    }
}

function onAuthStateChanged(callback) {
    auth.onAuthStateChanged(callback);
}

function getCurrentUser() {
    return auth.currentUser;
}

async function deleteAccount(uid, username) {
    try {
        const user = auth.currentUser;
        if (!user) return { success: false, error: 'No user is signed in.' };

        // Delete Firestore documents in a batch
        const batch = db.batch();
        batch.delete(db.collection('users').doc(uid));
        if (username) {
            batch.delete(db.collection('usernames').doc(username.toLowerCase().trim()));
        }
        await batch.commit();

        // Delete the Firebase Auth account last
        await user.delete();

        return { success: true };
    } catch (error) {
        console.error('Error deleting account:', error);
        // auth/requires-recent-login means the user needs to re-authenticate first
        if (error.code === 'auth/requires-recent-login') {
            return { success: false, error: 'For security, please log out and log back in before deleting your account.' };
        }
        return { success: false, error: error.message };
    }
}

window.firebaseAuth = {
    signUp,
    signIn,
    signOut,
    resetPassword,
    getUserData,
    updateUserData,
    updateBookeepData,
    updateBookHelpData,
    updateBookStatsData,
    updateBookNotesData,
    updateUserPreferences,
    deleteAccount,
    migrateLocalStorageToFirebase,
    onAuthStateChanged,
    getCurrentUser,
    recordLoginTime,
    touchActivity,
    isSessionExpired
};