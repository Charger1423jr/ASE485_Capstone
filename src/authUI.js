let currentUser = null;
let currentUserData = null;

// ── Alert helper ─────────────────────────────────────────────────────────────
// modals.js (loaded before this file) defines window.showAlert with a custom
// modal. If it is not present we fall back to the native browser alert.
function showAlert(message) {
    alert(message);
}

function showPageLoadingOverlay() {
    const overlay = document.createElement('div');
    overlay.id = 'pageLoadingOverlay';
    overlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: #d3e9ff; z-index: 9999;
        display: flex; align-items: center; justify-content: center;
        flex-direction: column; gap: 16px;
    `;
    overlay.innerHTML = `
        <div style="border: 5px solid #e0e0e0; border-top: 5px solid #224499;
            border-radius: 50%; width: 56px; height: 56px;
            animation: authSpin 0.9s linear infinite;"></div>
        <div style="font-family: Garamond, serif; font-size: 20px; color: #224499; font-weight: 600;">
            Loading…
        </div>
        <style>@keyframes authSpin { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }</style>
    `;
    document.body.appendChild(overlay);
}

function hidePageLoadingOverlay() {
    const overlay = document.getElementById('pageLoadingOverlay');
    if (overlay) {
        overlay.style.transition = 'opacity 0.3s ease';
        overlay.style.opacity = '0';
        setTimeout(() => overlay.remove(), 350);
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    showPageLoadingOverlay();

    if (typeof window.firebaseAuth !== 'undefined') {

        window.firebaseAuth.onAuthStateChanged(async (user) => {
            currentUser = user;

            if (user) {
                // Check if the existing session has expired (24 h absolute / 1 h idle)
                if (window.firebaseAuth.isSessionExpired()) {
                    console.log('Session expired — signing out automatically.');
                    await window.firebaseAuth.signOut();
                    // The sign-out will trigger onAuthStateChanged again with user = null
                    return;
                }

                currentUserData = null; // clear stale data before async fetch
                currentUserData = await window.firebaseAuth.getUserData(user.uid);
                handleUserSignedIn(user);

                if (currentUserData && currentUserData.preferences && currentUserData.preferences.darkMode) {
                    document.body.classList.add('dark-mode');
                }

                loadPageSpecificData();
                startSessionWatchdog();
            } else {
                currentUserData = null;
                stopSessionWatchdog();
                if (typeof window.clearBookeep === 'function') window.clearBookeep();
                if (typeof window.clearBookCenter === 'function') window.clearBookCenter();
                handleUserSignedOut();
            }

            hidePageLoadingOverlay();
        });

        // Track user activity to reset the idle timer
        ['click', 'keydown', 'scroll', 'mousemove', 'touchstart'].forEach(evt => {
            document.addEventListener(evt, () => {
                if (currentUser) window.firebaseAuth.touchActivity();
            }, { passive: true });
        });
    } else {
        hidePageLoadingOverlay();
    }
});

function requireAuth(event, targetPage) {
    const user = window.authUI.getCurrentUser();

    if (!user) {
        event.preventDefault();

        alert("You must be logged in to access this page.");
        window.location.href = "./BookCenter.html";

        return false;
    }

    return true;
}

window.requireAuth = requireAuth;

function handleUserSignedIn(user) {
    const currentPage = getCurrentPage();
    showUserMenu(user);
    if (currentPage === 'BookCenter') {
        hideLoginButton();
    }
}

function handleUserSignedOut() {
    const currentPage = getCurrentPage();
    document.body.classList.remove('dark-mode');

    if (currentPage !== 'BookCenter') {
        showAlert('You are not logged in. Please log in to access this page.');
        window.location.href = './BookCenter.html';
    } else {
        showLoginButton();
    }
}

function getCurrentPage() {
    const path = window.location.pathname;
    const page = path.split('/').pop().split('.')[0];
    return page || 'BookCenter';
}

function showUserMenu(user) {
    let navbarButtons = document.getElementById('navbarButtons');

    if (!navbarButtons) {
        const navbar = document.querySelector('.navbar .container-fluid');
        if (navbar) {
            navbarButtons = document.createElement('div');
            navbarButtons.id = 'navbarButtons';
            navbar.appendChild(navbarButtons);
        } else {
            console.error('Could not find navbar container');
            return;
        }
    }

    const existingLogin = document.getElementById('loginButtonContainer');
    if (existingLogin) existingLogin.remove();

    const existingMenu = document.getElementById('userMenuContainer');
    if (existingMenu) existingMenu.remove();

    const menuHTML = `
        <div class="user-menu-container" id="userMenuContainer">
            <button class="user-menu-button" id="userMenuButton">
                <span>👤</span>
                <span>${user.displayName || user.email}</span>
                <span>▼</span>
            </button>
            <div class="user-menu-dropdown" id="userMenuDropdown">
                <div class="user-menu-item" onclick="openUserOptions()">User Options</div>
                <div class="user-menu-item" onclick="handleLogout()">Logout</div>
            </div>
        </div>
    `;

    navbarButtons.insertAdjacentHTML('beforeend', menuHTML);

    document.getElementById('userMenuButton').addEventListener('click', (e) => {
        e.stopPropagation();
        const dropdown = document.getElementById('userMenuDropdown');
        dropdown.classList.toggle('show');
    });

    document.addEventListener('click', () => {
        const dropdown = document.getElementById('userMenuDropdown');
        if (dropdown) dropdown.classList.remove('show');
    });
}

function showLoginButton() {
    let navbarButtons = document.getElementById('navbarButtons');

    if (!navbarButtons) {
        const navbar = document.querySelector('.navbar .container-fluid');
        if (navbar) {
            navbarButtons = document.createElement('div');
            navbarButtons.id = 'navbarButtons';
            navbar.appendChild(navbarButtons);
        } else {
            console.error('Could not find navbar container');
            return;
        }
    }

    const existingMenu = document.getElementById('userMenuContainer');
    if (existingMenu) existingMenu.remove();

    if (document.getElementById('loginButtonContainer')) return;

    const buttonHTML = `
        <div id="loginButtonContainer">
            <button class="btn btn-light" onclick="openAuthModal('login')">Login</button>
        </div>
    `;

    navbarButtons.insertAdjacentHTML('beforeend', buttonHTML);
}

function hideLoginButton() {
    const loginButton = document.getElementById('loginButtonContainer');
    if (loginButton) loginButton.remove();
}

function openAuthModal(tab = 'login') {
    const existingModal = document.getElementById('authModalOverlay');
    if (existingModal) existingModal.remove();

    const modalHTML = `
        <div class="auth-modal-overlay" id="authModalOverlay">
            <div class="auth-modal" id="authModalBox">
            <div class="auth-modal-header" style="position: relative;">
    <h2 class="auth-modal-title">BookCenter Account</h2>
        <button onclick="closeAuthModal()" 
                style="
                    position:absolute;
                    right:10px;
                    top:10px;
                    background:none;
                    border:none;
                    font-size:22px;
                    cursor:pointer;
                ">
                    ✕
                    </button>
                </div>
                <div class="auth-tabs">
                    <button class="auth-tab ${tab === 'login' ? 'active' : ''}" id="loginTab" onclick="switchAuthTab('login')">Login</button>
                    <button class="auth-tab ${tab === 'signup' ? 'active' : ''}" id="signupTab" onclick="switchAuthTab('signup')">Sign Up</button>
                </div>
                <div class="auth-modal-body">
                    <div class="auth-error" id="authError"></div>
                    <div class="auth-success" id="authSuccess"></div>

                    <!-- Login Form -->
                    <div class="auth-form ${tab === 'login' ? 'active' : ''}" id="loginForm">
                        <div class="auth-form-group">
                            <label class="auth-form-label">Email</label>
                            <input type="text" class="auth-form-input" id="loginUsername" placeholder="Enter email">
                        </div>
                        <div class="auth-form-group">
                            <label class="auth-form-label">Password</label>
                            <input type="password" class="auth-form-input" id="loginPassword" placeholder="Enter password">
                        </div>
                        <button class="auth-btn auth-btn-primary" onclick="handleLogin()">Login</button>
                        <button class="auth-btn auth-btn-secondary" onclick="handleForgotPassword()">Forgot Username/Password?</button>
                    </div>

                    <!-- Signup Form -->
                    <div class="auth-form ${tab === 'signup' ? 'active' : ''}" id="signupForm">
                        <div class="auth-form-group">
                            <label class="auth-form-label">Email</label>
                            <input type="email" class="auth-form-input" id="signupEmail" placeholder="Enter email">
                        </div>
                        <div class="auth-form-group">
                            <label class="auth-form-label">Username</label>
                            <input type="text" class="auth-form-input" id="signupUsername" placeholder="Enter username">
                        </div>
                        <div class="auth-form-group">
                            <label class="auth-form-label">Password</label>
                            <input type="password" class="auth-form-input" id="signupPassword" placeholder="Enter password">
                        </div>
                        <div class="auth-form-group">
                            <label class="auth-form-label">Verify Password</label>
                            <input type="password" class="auth-form-input" id="signupPasswordVerify" placeholder="Re-enter password">
                        </div>
                        <div class="auth-form-checkbox">
    <input type="checkbox" id="signupConfirm">

    <label>
        I agree to the
        <a href="#" onclick="openPolicyModal('terms'); return false;">Terms of Service</a>
        and
        <a href="#" onclick="openPolicyModal('privacy'); return false;">Privacy Policy</a>
    </label>
</div>
                        <button class="auth-btn auth-btn-primary" onclick="handleSignup()">Create Account</button>
                    </div>

                    <div class="auth-loading" id="authLoading">
                        <div class="spinner"></div>
                        <p style="margin-top: 10px;">Processing...</p>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    setTimeout(() => {
        document.getElementById('authModalOverlay').classList.add('show');
    }, 10);

}

function openPolicyModal(type) {
    const existing = document.getElementById('policyModal');
    if (existing) existing.remove();

    const content = type === 'terms' ? TERMS_TEXT : PRIVACY_TEXT;

    const modal = document.createElement('div');
    modal.id = 'policyModal';
    modal.style.cssText = `
        position: fixed;
        top: 0; left: 0;
        width: 100%; height: 100%;
        background: rgba(0,0,0,0.6);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
    `;

    modal.innerHTML = `
        <div style="
            width: 70%;
            max-width: 800px;
            height: 80%;
            background: white;
            border-radius: 10px;
            padding: 20px;
            overflow-y: auto;
            position: relative;
        ">
            <button onclick="document.getElementById('policyModal').remove()"
                style="
                    position:absolute;
                    right:15px;
                    top:10px;
                    font-size:22px;
                    background:none;
                    border:none;
                    cursor:pointer;
                ">✕</button>

            <div style="white-space: pre-wrap; font-family: Arial;">
                ${content}
            </div>
        </div>
    `;

    document.body.appendChild(modal);
}

function switchAuthTab(tab) {
    document.getElementById('loginTab').classList.toggle('active', tab === 'login');
    document.getElementById('signupTab').classList.toggle('active', tab === 'signup');
    document.getElementById('loginForm').classList.toggle('active', tab === 'login');
    document.getElementById('signupForm').classList.toggle('active', tab === 'signup');

    hideAuthError();
    hideAuthSuccess();
}

function closeAuthModal() {
    const modal = document.getElementById('authModalOverlay');
    if (modal) {
        modal.classList.remove('show');
        setTimeout(() => modal.remove(), 300);
    }
}

function showAuthError(message) {
    const errorEl = document.getElementById('authError');
    if (errorEl) {
        errorEl.textContent = message;
        errorEl.classList.add('show');
    }
}

function hideAuthError() {
    const errorEl = document.getElementById('authError');
    if (errorEl) errorEl.classList.remove('show');
}

function showAuthSuccess(message) {
    const successEl = document.getElementById('authSuccess');
    if (successEl) {
        successEl.textContent = message;
        successEl.classList.add('show');
    }
}

function hideAuthSuccess() {
    const successEl = document.getElementById('authSuccess');
    if (successEl) successEl.classList.remove('show');
}

function showAuthLoading() {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('signupForm').style.display = 'none';
    document.getElementById('authLoading').classList.add('show');
}

function hideAuthLoading() {
    document.getElementById('authLoading').classList.remove('show');
    const activeTab = document.querySelector('.auth-tab.active').id === 'loginTab' ? 'login' : 'signup';
    if (activeTab === 'login') {
        document.getElementById('loginForm').style.display = 'block';
    } else {
        document.getElementById('signupForm').style.display = 'block';
    }
}

async function handleLogin() {
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;

    if (!username || !password) {
        showAuthError('Please fill in all fields');
        return;
    }

    hideAuthError();
    showAuthLoading();

    const result = await window.firebaseAuth.signIn(username, password);

    hideAuthLoading();

    if (result.success) {
        showAuthSuccess('Login successful! Redirecting...');

        // Record the sign-in time for the 24-hour / 1-hour idle expiry checks
        window.firebaseAuth.recordLoginTime();

        try {
            await window.firebaseAuth.migrateLocalStorageToFirebase(result.user.uid);
        } catch (migrationError) {
            console.error("Migration error (non-fatal):", migrationError);
        }

        setTimeout(() => {
            closeAuthModal();
        }, 1000);
    } else {
        showAuthError(friendlyAuthError(result.error));

        if (window.firebaseAuth.getCurrentUser()) {
            await window.firebaseAuth.signOut();
        }
    }
}

function friendlyAuthError(error) {
    if (!error) return "Something went wrong.";

    if (error.includes("EMAIL")) return "Invalid email address.";
    if (error.includes("password")) return "Password is too weak.";
    if (error.includes("USER_NOT_FOUND")) return "Account not found.";
    if (error.includes("USERNAME_TAKEN")) return "That username is already taken.";

    return error;
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidUsername(username) {
    return /^[a-zA-Z0-9_]{3,20}$/.test(username);
}

async function handleSignup() {
    const email = document.getElementById('signupEmail').value.trim();
    const username = document.getElementById('signupUsername').value.trim();
    const password = document.getElementById('signupPassword').value;
    const passwordVerify = document.getElementById('signupPasswordVerify').value;
    const confirmed = document.getElementById('signupConfirm').checked;

    if (!email || !username || !password || !passwordVerify) {
        showAuthError('Please fill in all fields');
        return;
    }

    if (password !== passwordVerify) {
        showAuthError('Passwords do not match');
        return;
    }

    if (password.length < 6) {
        showAuthError('Password must be at least 6 characters');
        return;
    }

    if (!confirmed) {
        showAuthError('You must agree to the Terms of Service and Privacy Policy');
        return;
    }

    if (!isValidEmail(email)) {
        showAuthError("That email address doesn't look right. Please check it and try again.");
        return;
    }

    if (!isValidUsername(username)) {
        showAuthError("That username doesn't look right. Please choose a different one.");
        return;
    }

    hideAuthError();
    showAuthLoading();

    const result = await window.firebaseAuth.signUp(email, username, password);

    hideAuthLoading();

    if (result.success) {
        showAuthSuccess('Account created successfully! Redirecting...');

        // Record the sign-in time for expiry checks
        window.firebaseAuth.recordLoginTime();

        setTimeout(() => {
            closeAuthModal();
        }, 1000);
    } else {
        showAuthError(friendlyAuthError(result.error));

        if (window.firebaseAuth.getCurrentUser()) {
            await window.firebaseAuth.signOut();
        }
    }
}

async function handleForgotPassword() {
    const email = prompt('Please enter your email address to reset your password:');

    if (!email) return;

    const result = await window.firebaseAuth.resetPassword(email);

    if (result.success) {
        showAlert('Password reset email sent! Please check your inbox.');
    } else {
        showAlert('Error: ' + (result.error || 'Could not send reset email'));
    }
}

async function handleLogout() {
    const confirmed = confirm('Are you sure you want to logout?');

    if (!confirmed) return;

    const result = await window.firebaseAuth.signOut();

    if (result.success) {
        window.location.href = './BookCenter.html';
    } else {
        showAlert('Error logging out: ' + result.error);
    }
}

/**
 * The function `handleDeleteAccount` allows a user to delete their account after confirming the action
 * and verifying the deletion by typing "DELETE".
 * @returns The `handleDeleteAccount` function is returning different messages based on the conditions
 * met during its execution. Here are the possible return scenarios:
 */
async function handleDeleteAccount() {
    if (!currentUser || !currentUserData) {
        showAlert("No user is currently logged in.");
        return;
    }

    const confirmFirst = confirm(
        "Are you sure you want to delete your account?\n\nThis action is PERMANENT and cannot be undone."
    );

    if (!confirmFirst) return;

    const confirmFinal = prompt(
        "Type DELETE to confirm account deletion:"
    );

    if (confirmFinal !== "DELETE") {
        showAlert("Account deletion cancelled.");
        return;
    }

    try {
        showPageLoadingOverlay();

        const uid = currentUser.uid;
        const username = currentUserData.username;

        const result = await window.firebaseAuth.deleteAccount(uid, username);

        hidePageLoadingOverlay();

        if (result.success) {
            showAlert("Your account has been permanently deleted.");
            window.location.href = "./BookCenter.html";
        } else {
            showAlert("Error deleting account: " + result.error);
        }

    } catch (error) {
        hidePageLoadingOverlay();
        console.error("Delete account error:", error);
        showAlert("An unexpected error occurred.");
    }
}

function openUserOptions() {
    const existingModal = document.getElementById('userOptionsModal');
    if (existingModal) existingModal.remove();

    const darkModeChecked = currentUserData && currentUserData.preferences && currentUserData.preferences.darkMode ? 'checked' : '';

    const modalHTML = `
        <div class="user-options-modal" id="userOptionsModal">
            <div class="user-options-content">
                <div class="user-options-header">
                    <h3 class="user-options-title">User Options</h3>
                    <button class="user-options-close" onclick="closeUserOptions()">×</button>
                </div>
                <div class="user-options-body">
                    <div class="user-option-item">
                        <span class="user-option-label">Dark Mode</span>
                        <label class="toggle-switch">
                            <input type="checkbox" id="darkModeToggle" ${darkModeChecked} onchange="toggleDarkMode()">
                            <span class="toggle-slider"></span>
                        </label>
                    </div>
                    <hr style="margin: 15px 0;">
                    <div class="user-option-item" style="justify-content: center;">
                        <button
                            class="auth-btn auth-btn-secondary"
                            style="background-color: #ff4d4d; color: white;"
                            onclick="handleDeleteAccount()">
                            Delete Account
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    setTimeout(() => {
        document.getElementById('userOptionsModal').classList.add('show');
    }, 10);

    document.getElementById('userOptionsModal').addEventListener('click', (e) => {
        if (e.target.id === 'userOptionsModal') {
            closeUserOptions();
        }
    });
}

function closeUserOptions() {
    const modal = document.getElementById('userOptionsModal');
    if (modal) {
        modal.classList.remove('show');
        setTimeout(() => modal.remove(), 300);
    }
}

async function toggleDarkMode() {
    const darkModeEnabled = document.getElementById('darkModeToggle').checked;

    if (darkModeEnabled) {
        document.body.classList.add('dark-mode');
    } else {
        document.body.classList.remove('dark-mode');
    }

    if (currentUser && currentUserData) {
        currentUserData.preferences.darkMode = darkModeEnabled;
        await window.firebaseAuth.updateUserPreferences(currentUser.uid, currentUserData.preferences);
    }
}

function loadPageSpecificData() {
    const currentPage = getCurrentPage();

    switch (currentPage) {
        case 'BookCenter':
            if (typeof window.initBookCenter === 'function') window.initBookCenter(currentUserData);
            break;
        case 'Bookeep':
            loadBookeepData();
            break;
        case 'BookHelp':
            loadBookHelpData();
            break;
        case 'BookStats':
            loadBookStatsData();
            break;
        case 'BookNotes':
            loadBookNotesData();
            break;
    }
}

function loadBookeepData() {
    if (!currentUserData) return;
    if (typeof window.initBookeep === 'function') window.initBookeep(currentUserData);
}

function loadBookHelpData() {
    if (!currentUserData) return;
    if (typeof window.initBookHelp === 'function') window.initBookHelp(currentUserData);
}

function loadBookStatsData() {
    if (!currentUserData) return;
    if (typeof window.initBookStats === 'function') window.initBookStats(currentUserData);
}

function loadBookNotesData() {
    if (!currentUserData) return;
    if (typeof window.initBookNotes === 'function') window.initBookNotes(currentUserData);
}

// ── Session watchdog ─────────────────────────────────────────────────────────
// Checks every 5 minutes whether the session has expired and signs out if so.

let _sessionWatchdogTimer = null;

function startSessionWatchdog() {
    stopSessionWatchdog();
    _sessionWatchdogTimer = setInterval(async () => {
        if (window.firebaseAuth.isSessionExpired()) {
            console.log('Session watchdog: session expired, signing out.');
            clearInterval(_sessionWatchdogTimer);
            showAlert('Your session has expired. Please sign in again.');
            await window.firebaseAuth.signOut();
            window.location.href = './BookCenter.html';
        }
    }, 5 * 60 * 1000); // check every 5 minutes
}

function stopSessionWatchdog() {
    if (_sessionWatchdogTimer) {
        clearInterval(_sessionWatchdogTimer);
        _sessionWatchdogTimer = null;
    }
}

const TERMS_TEXT = `
<H1>BookCenter Terms of Service</H1>

<p>Effective date: 4/24/2026</p>

<h3>1. Acceptance of Terms</h3>
By creating an account or using BookCenter (“the Service”), you agree to these Terms of Service. If you do not agree, you may not use the Service.

<h3>2. Description of the Service</h3>
BookCenter is a web-based platform that allows users to:
<ul>
    <li>Track books and reading activity</li>
    <li>Record reading statistics (e.g., word counts, reading time)</li>
    <li>Take comprehension and speed tests</li>
    <li>Store notes and personal reading data</li>
</ul>

<h3>3. User Accounts</h3>
<ol>
    <li>Account Creation: To use certain features, you must create an account and provide: 1. A valid email address, 2. A unique username, 3. A password</li>
    <li>Account Security: You are responsible for maintaining the confidentiality of your account credentials. Notify us immediately of any unauthorized use.</li>
    <li>Account Deletion: You can delete your account at any time through the user options. This action is irreversible and will permanently remove all your data.</li>
</ol>

<h3>4. Data Collection and Use</h3>
<p>We collect the following data to provide and improve our Service:</p>
<ul>
    <li>Personal Information: Email, username, and password (stored securely).</li>
    <li>Reading Data: Books read, reading time,word counts, test results, and notes.</li>
</ul>

<p>We use this data to:</p>
<ul>
    <li>Provide the core functionality of the Service.</li>
    <li>Personalize your experience and provide insights.</li>
    <li>Improve our Service and develop new features.</li>
</ul>

<h3>5. Session Management</h3>
<p>Sessions expire after 24 hours of absolute time or 1 hour of inactivity. You will be automatically signed out when a session expires and will need to log in again to continue using the Service.</p>

<h3>6. Acceptable Use</h3>
<p>You agree to use the Service only for lawful purposes and in a manner that does not infringe upon the rights of others or disrupt the Service.</p>

<h3>7. Intellectual Property</h3>
<p>All content and materials provided by BookCenter are the property of BookCenter or its licensors and are protected by applicable intellectual property laws.</p>

<h3>8. Termination</h3>
<p>We may terminate or suspend your account and access to the Service at our sole discretion, without prior notice, for conduct that we believe violates these Terms or is harmful to other users of the Service.</p>

<h3>9. Changes to Terms</h3>
<p>We reserve the right to modify these Terms at any time. We will provide notice of any changes by updating the effective date and posting the new Terms on our website. Your continued use of the Service after any such changes constitutes your acceptance of the new Terms.</p>

<h3>10. Contact Us</h3>
<p>If you have any questions about these Terms, please contact us at BookCenter0@outlook.com</p>

`;

const PRIVACY_TEXT = `

<h1>BookCenter Privacy Policy</h1>
<p>Effective date: 4/24/2026</p>
<h3>1. Information We Collect</h3>
<p>We collect the following types of information:</p>
<ul>
    <li><strong>Personal Information:</strong> When you create an account, we collect your email address, username, and password (stored securely).</li>
    <li><strong>Reading Data:</strong> We collect data related to your reading activity, including books read, reading time, word counts, test results, and notes.</li>
</ul>

<h3>2. How We Use Your Information</h3>
<p>We use the information we collect to:</p>
<ul>

    <li>Provide and maintain the Service.</li>
    <li>Personalize your experience and provide insights based on your reading data.</li>
    <li>Improve our Service and develop new features.</li>
</ul>
<h3>3. Data Security</h3>
<p>We take reasonable measures to protect your information from unauthorized access, alteration, disclosure, or destruction. However, no method of transmission over the internet or method of electronic storage is 100% secure.</p>
<h3>4. Data Retention</h3>
<p>We retain your information for as long as your account is active or as needed to provide you with the Service. You can delete your account at any time, which will permanently remove all your data from our servers.</p>
<h3>5. Sharing Your Information</h3>
<p>We do not sell, trade, or rent your personal information to third parties. We may share your information with trusted service providers who assist us in operating our Service, as long as they agree to keep this information confidential.</p>

<h3>6. Your Choices</h3>
<p>You can choose to delete your account at any time, which will permanently remove all your data from our servers. You can also contact us to request access to, correction of, or deletion of your personal information.</p>

<h3>7. Changes to This Privacy Policy</h3>
<p>We reserve the right to update our Privacy Policy at any time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the effective date. Your continued use of the Service after any such changes constitutes your acceptance of the new Privacy Policy.</p>
<h3>8. Contact Us</h3>
<p>If you have any questions about this Privacy Policy, please contact us at BookCenter0@outlook.com</p>

`;


window.authUI = {
    openAuthModal,
    openUserOptions,
    handleLogout,
    getCurrentUser: () => currentUser,
    getCurrentUserData: () => currentUserData,
    setCurrentUserData: (data) => { currentUserData = data; }
};