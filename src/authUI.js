// Authentication UI Components and Logic

// Global state
let currentUser = null;
let currentUserData = null;

// Initialize authentication on page load
document.addEventListener('DOMContentLoaded', async () => {
    // Initialize Firebase
    if (typeof window.firebaseAuth !== 'undefined') {
        window.firebaseAuth.initializeFirebase();
        
        // Set up auth state observer
        window.firebaseAuth.onAuthStateChanged(async (user) => {
            currentUser = user;
            
            if (user) {
                // User is signed in
                currentUserData = await window.firebaseAuth.getUserData(user.uid);
                handleUserSignedIn(user);
                
                // Apply dark mode if enabled
                if (currentUserData && currentUserData.preferences && currentUserData.preferences.darkMode) {
                    document.body.classList.add('dark-mode');
                }
                
                // Load user-specific data for each page
                loadPageSpecificData();
            } else {
                // User is signed out
                currentUserData = null;
                handleUserSignedOut();
            }
        });
    }
});

// Handle user signed in state
function handleUserSignedIn(user) {
    const currentPage = getCurrentPage();
    
    // Show user menu
    showUserMenu(user);
    
    // Hide login button if on BookCenter
    if (currentPage === 'BookCenter') {
        hideLoginButton();
    }
}

// Handle user signed out state
function handleUserSignedOut() {
    const currentPage = getCurrentPage();
    
    // Remove dark mode
    document.body.classList.remove('dark-mode');
    
    // If not on BookCenter, redirect with alert
    if (currentPage !== 'BookCenter') {
        alert('You are not logged in. Please log in to access this page.');
        window.location.href = './BookCenter.html';
    } else {
        // Show login button
        showLoginButton();
    }
}

// Get current page name
function getCurrentPage() {
    const path = window.location.pathname;
    const page = path.split('/').pop().split('.')[0];
    return page || 'BookCenter';
}

// Show user menu in navbar
function showUserMenu(user) {
    // Find the navbar buttons container
    let navbarButtons = document.getElementById('navbarButtons');
    
    if (!navbarButtons) {
        // Fallback: try to find container-fluid and create buttons div
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
    
    // Remove login button if exists
    const existingLogin = document.getElementById('loginButtonContainer');
    if (existingLogin) {
        existingLogin.remove();
    }
    
    // Remove existing user menu if exists
    const existingMenu = document.getElementById('userMenuContainer');
    if (existingMenu) {
        existingMenu.remove();
    }
    
    // Create user menu
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
    
    // Add to navbar buttons container
    navbarButtons.insertAdjacentHTML('beforeend', menuHTML);
    
    // Add click handler for dropdown
    document.getElementById('userMenuButton').addEventListener('click', (e) => {
        e.stopPropagation();
        const dropdown = document.getElementById('userMenuDropdown');
        dropdown.classList.toggle('show');
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', () => {
        const dropdown = document.getElementById('userMenuDropdown');
        if (dropdown) {
            dropdown.classList.remove('show');
        }
    });
}

// Show login button (BookCenter only)
function showLoginButton() {
    // Find the navbar buttons container
    let navbarButtons = document.getElementById('navbarButtons');
    
    if (!navbarButtons) {
        // Fallback: try to find container-fluid and create buttons div
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
    
    // Remove user menu if exists
    const existingMenu = document.getElementById('userMenuContainer');
    if (existingMenu) {
        existingMenu.remove();
    }
    
    // Check if login button already exists
    if (document.getElementById('loginButtonContainer')) return;
    
    const buttonHTML = `
        <div id="loginButtonContainer">
            <button class="btn btn-light" onclick="openAuthModal('login')">Login</button>
        </div>
    `;
    
    navbarButtons.insertAdjacentHTML('beforeend', buttonHTML);
}

// Hide login button
function hideLoginButton() {
    const loginButton = document.getElementById('loginButtonContainer');
    if (loginButton) {
        loginButton.remove();
    }
}

// Create and show auth modal
function openAuthModal(tab = 'login') {
    // Remove existing modal if any
    const existingModal = document.getElementById('authModalOverlay');
    if (existingModal) {
        existingModal.remove();
    }
    
    const modalHTML = `
        <div class="auth-modal-overlay" id="authModalOverlay">
            <div class="auth-modal">
                <div class="auth-modal-header">
                    <h2 class="auth-modal-title">BookCenter Account</h2>
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
                            <label for="signupConfirm">I confirm that the data I entered is correct</label>
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
    
    document.getElementById('authModalOverlay').addEventListener('click', (e) => {
        if (e.target.id === 'authModalOverlay') {
            closeAuthModal();
        }
    });
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
        setTimeout(() => {
            modal.remove();
        }, 300);
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
    if (errorEl) {
        errorEl.classList.remove('show');
    }
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
    if (successEl) {
        successEl.classList.remove('show');
    }
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
        
        try {
            await window.firebaseAuth.migrateLocalStorageToFirebase(result.user.uid);
        } catch (migrationError) {
            console.error("Migration error (non-fatal):", migrationError);
        }
        
        setTimeout(() => {
            closeAuthModal();
        }, 1000);
    } else {
        showAuthError(result.error || 'Login failed. Please try again.');
        
        if (window.firebaseAuth.getCurrentUser()) {
            await window.firebaseAuth.signOut();
        }
    }
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
        showAuthError('Please confirm that your data is correct');
        return;
    }
    
    hideAuthError();
    showAuthLoading();
    
    const result = await window.firebaseAuth.signUp(email, username, password);
    
    hideAuthLoading();
    
    if (result.success) {
        showAuthSuccess('Account created successfully! Redirecting...');
        
        setTimeout(() => {
            closeAuthModal();
        }, 1000);
    } else {
        showAuthError(result.error || 'Signup failed. Please try again.');
        
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
        alert('Password reset email sent! Please check your inbox.');
    } else {
        alert('Error: ' + (result.error || 'Could not send reset email'));
    }
}

async function handleLogout() {
    const confirmed = confirm('Are you sure you want to logout?');
    
    if (!confirmed) return;
    
    const result = await window.firebaseAuth.signOut();
    
    if (result.success) {
        window.location.href = './BookCenter.html';
    } else {
        alert('Error logging out: ' + result.error);
    }
}

function openUserOptions() {
    const existingModal = document.getElementById('userOptionsModal');
    if (existingModal) {
        existingModal.remove();
    }
    
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
        setTimeout(() => {
            modal.remove();
        }, 300);
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
    
    if (currentUserData.bookeep && currentUserData.bookeep.books) {
        books = currentUserData.bookeep.books;
        renderBooks();
        updateStats();
    }
}

function loadBookHelpData() {
    if (!currentUserData) return;
    
    console.log('BookHelp data loaded:', currentUserData.bookhelp);
}

function loadBookStatsData() {
    if (!currentUserData) return;
    
    console.log('BookStats data loaded:', currentUserData.bookstats);
}

function loadBookNotesData() {
    if (!currentUserData) return;
    
    console.log('BookNotes data loaded:', currentUserData.booknotes);
}

window.authUI = {
    openAuthModal,
    openUserOptions,
    handleLogout,
    getCurrentUser: () => currentUser,
    getCurrentUserData: () => currentUserData
};