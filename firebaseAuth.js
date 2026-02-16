const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

let app, auth, db;

function initializeFirebase() {
    try {
        app = firebase.initializeApp(firebaseConfig);
        auth = firebase.auth();
        db = firebase.firestore();
        console.log("Firebase initialized successfully");
    } catch (error) {
        console.error("Firebase initialization error:", error);
    }
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
            recommendations: [],
            lastComprehensionTest: {
                score: 0,
                total: 5,
                percentage: 0,
                date: null
            },
            totalReadingTime: 0,
            readingTimeByMonth: {}
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
            folders: []
        }
    };
}

async function signUp(email, username, password) {
    try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        await user.updateProfile({
            displayName: username
        });
        
        const userData = createUserData(user.uid, email, username);
        await db.collection('users').doc(user.uid).set(userData);
        
        return { success: true, user: user };
    } catch (error) {
        console.error("Sign up error:", error);
        
        if (auth.currentUser) {
            try {
                await auth.currentUser.delete();
                console.log("Rolled back user creation due to error");
            } catch (deleteError) {
                console.error("Failed to rollback user creation:", deleteError);
            }
        }
        
        return { success: false, error: error.message };
    }
}

async function signIn(emailOrUsername, password) {
    try {
        let email = emailOrUsername;
        
        if (!emailOrUsername.includes('@')) {
            const querySnapshot = await db.collection('users')
                .where('username', '==', emailOrUsername)
                .limit(1)
                .get();
            
            if (querySnapshot.empty) {
                return { success: false, error: "Username not found" };
            }
            
            email = querySnapshot.docs[0].data().email;
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
        if (data.recommendations) updateData['bookhelp.recommendations'] = data.recommendations;
        if (data.lastComprehensionTest) updateData['bookhelp.lastComprehensionTest'] = data.lastComprehensionTest;
        if (data.totalReadingTime !== undefined) updateData['bookhelp.totalReadingTime'] = data.totalReadingTime;
        if (data.readingTimeByMonth) updateData['bookhelp.readingTimeByMonth'] = data.readingTimeByMonth;
        
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

async function updateBookNotesData(uid, folders) {
    try {
        await db.collection('users').doc(uid).update({
            'booknotes.folders': folders
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

window.firebaseAuth = {
    initializeFirebase,
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
    migrateLocalStorageToFirebase,
    onAuthStateChanged,
    getCurrentUser
};