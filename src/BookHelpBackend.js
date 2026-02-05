/* All Work Related to the Timer Made in part with Mateusz Rybczonek's guide linked on index.html */
let TIME_LIMIT = 1800; // Default 30 minutes
let timePassed = 0;
let timeLeft = TIME_LIMIT;
let timerInterval = null;
let isTimerRunning = false;
let isPaused = false;

const COLOR_CODES = {
    early: { color: "yellow" },
    halfway: { color: "orange" },
    lastMinute: { color: "green" }
};

function remainingPathColor() {
    const { early, halfway, lastMinute } = COLOR_CODES;
    const halfwayPoint = TIME_LIMIT / 2;
    const lastMinuteThreshold = 60;
    
    if (timeLeft <= lastMinuteThreshold) {
        return lastMinute.color;
    } else if (timeLeft <= halfwayPoint) {
        return halfway.color;
    } else {
        return early.color;
    }
}

// Initialize timer HTML
function initializeTimer() {
    const appElement = document.getElementById("app");
    if (appElement) {
        appElement.innerHTML = `
            <div class="base-timer">
                <svg class="base-timer__svg" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                <g class="base-timer__circle">
                    <circle class="base-timer__path-elapsed" cx="50" cy="50" r="45"></circle>
                    <path
                    id="base-timer-path-remaining"
                    stroke-dasharray="283"
                    class="base-timer__path-remaining ${remainingPathColor()}"
                    d="
                    M 50, 50
                        m -45, 0
                        a 45,45 0 1,0 90,0
                        a 45,45 0 1,0 -90,0
                    "
                    ></path>
                </g>
            </svg>
            <span id="base-timer-label" class="base-timer__label">
            ${formatTimeLeft(timeLeft)}
            </span>
            </div>
        `;
    }
}

// Update timer duration when dropdown changes
function updateTimerDuration() {
    if (isTimerRunning) {
        alert("Cannot change duration while timer is running!");
        return;
    }
    
    const select = document.getElementById("timerDuration");
    TIME_LIMIT = parseInt(select.value);
    timePassed = 0;
    timeLeft = TIME_LIMIT;
    
    // Re-initialize timer display
    initializeTimer();
}

// Handle timer control button (start/pause)
function handleTimerControl() {
    if (!isTimerRunning) {
        // Show confirmation dialog
        const confirmStart = confirm("Are you sure you want to start the timer? The screen will go dark to help you focus.");
        if (!confirmStart) {
            return;
        }
        startTimer();
    } else {
        pauseTimer();
    }
}

// Start the timer
function startTimer() {
    isTimerRunning = true;
    isPaused = false;
    
    // Change button to pause
    const controlButton = document.getElementById("timerControlButton");
    controlButton.textContent = "Pause Timer";
    controlButton.classList.remove("btn-success");
    controlButton.classList.add("btn-warning");
    
    // Disable duration dropdown
    document.getElementById("timerDuration").disabled = true;
    
    // Activate overlay (blackout screen)
    activateOverlay();
    
    // Start timer interval
    timerInterval = setInterval(() => {
        timePassed += 1;
        timeLeft = TIME_LIMIT - timePassed;
        
        const labelElement = document.getElementById("base-timer-label");
        if (labelElement) {
            labelElement.innerHTML = formatTimeLeft(timeLeft);
        }
        
        setCircleDasharray();
        setRemainingPathColor(timeLeft);
        
        if (timeLeft <= 0) {
            stopTimer();
            alert("Time's up! Great reading session!");
        }
    }, 1000);
}

// Pause the timer
function pauseTimer() {
    isPaused = true;
    clearInterval(timerInterval);
    
    // Change button back to start
    const controlButton = document.getElementById("timerControlButton");
    controlButton.textContent = "Resume Timer";
    controlButton.classList.remove("btn-warning");
    controlButton.classList.add("btn-success");
    
    // Deactivate overlay (restore screen)
    deactivateOverlay();
}

// Stop the timer completely
function stopTimer() {
    isTimerRunning = false;
    isPaused = false;
    clearInterval(timerInterval);
    
    // Reset button
    const controlButton = document.getElementById("timerControlButton");
    controlButton.textContent = "Start Timer";
    controlButton.classList.remove("btn-warning");
    controlButton.classList.add("btn-success");
    
    // Enable duration dropdown
    document.getElementById("timerDuration").disabled = false;
    
    // Deactivate overlay
    deactivateOverlay();
    
    // Reset timer
    timePassed = 0;
    timeLeft = TIME_LIMIT;
    initializeTimer();
}

// Activate dark overlay
function activateOverlay() {
    const overlay = document.getElementById("timerOverlay");
    overlay.classList.add("active");
}

// Deactivate dark overlay with fade
function deactivateOverlay() {
    const overlay = document.getElementById("timerOverlay");
    overlay.classList.remove("active");
}

// Feature navigation system
function showFeature(featureName) {
    // Hide all content sections
    const allSections = document.querySelectorAll('.content-section');
    allSections.forEach(section => {
        section.classList.remove('active');
    });

    // Remove active class from all buttons
    const allButtons = document.querySelectorAll('.feature-btn');
    allButtons.forEach(btn => {
        btn.classList.remove('active');
        btn.disabled = false;
    });

    // Show selected content section
    let contentId = '';
    switch(featureName) {
        case 'timer':
            contentId = 'timerContent';
            initializeTimer(); // Initialize timer when showing timer content
            break;
        case 'wpm':
            contentId = 'wpmContent';
            break;
        case 'comprehension':
            contentId = 'comprehensionContent';
            break;
        case 'recommendations':
            contentId = 'recommendationsContent';
            break;
        case 'goals':
            contentId = 'goalsContent';
            break;
        default:
            contentId = 'defaultContent';
    }

    const selectedContent = document.getElementById(contentId);
    if (selectedContent) {
        selectedContent.classList.add('active');
    }

    // Set active button and disable it
    const buttons = document.querySelectorAll('.feature-btn');
    buttons.forEach(btn => {
        if (btn.textContent.toLowerCase().includes(featureName) || 
            (featureName === 'timer' && btn.textContent.includes('Reading Timer')) ||
            (featureName === 'wpm' && btn.textContent.includes('WPM')) ||
            (featureName === 'comprehension' && btn.textContent.includes('Comprehension')) ||
            (featureName === 'recommendations' && btn.textContent.includes('Recommendations')) ||
            (featureName === 'goals' && btn.textContent.includes('Goal Center'))) {
            btn.classList.add('active');
            btn.disabled = true;
        }
    });
}

function formatTimeLeft(time) {
    const minutes = Math.floor(time / 60);
    let seconds = time % 60;
    if (seconds < 10) {
        seconds = `0${seconds}`;
    }
    return `${minutes}:${seconds}`;
}

function calculateTimeFraction() {
    const rawTimeFraction = timeLeft / TIME_LIMIT;
    return rawTimeFraction - (1 / TIME_LIMIT) * (1 - rawTimeFraction);
}

function setCircleDasharray() {
    const circleDasharray = `${(
        calculateTimeFraction() * 283
    ).toFixed(0)} 283`;
    const pathElement = document.getElementById("base-timer-path-remaining");
    if (pathElement) {
        pathElement.setAttribute("stroke-dasharray", circleDasharray);
    }
}

function setRemainingPathColor(timeLeft) {
    const { early, halfway, lastMinute } = COLOR_CODES;
    const halfwayPoint = TIME_LIMIT / 2;
    const lastMinuteThreshold = 60;
    
    const pathElement = document.getElementById("base-timer-path-remaining");
    if (!pathElement) return;
    
    if (timeLeft <= lastMinuteThreshold) {
        pathElement.classList.remove(early.color, halfway.color);
        pathElement.classList.add(lastMinute.color);
    } else if (timeLeft <= halfwayPoint) {
        pathElement.classList.remove(early.color);
        pathElement.classList.add(halfway.color);
    }
}

// Prevent leaving page when timer is running
window.addEventListener('beforeunload', function (e) {
    if (isTimerRunning) {
        e.preventDefault();
        e.returnValue = '';
        return '';
    }
});