/* All Work Related to the Timer Made in part with Mateusz Rybczonek's guide linked on index.html */
let TIME_LIMIT = 1800; 
let timePassed = 0;
let timeLeft = TIME_LIMIT;
let timerInterval = null;
let isTimerRunning = false;
let isPaused = false;

let sessionReadingTimeAdded = 0;

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

function updateTimerDuration() {
    if (isTimerRunning) {
        alert("Cannot change duration while timer is running!");
        return;
    }

    const select = document.getElementById("timerDuration");
    TIME_LIMIT = parseInt(select.value);
    timePassed = 0;
    timeLeft = TIME_LIMIT;

    initializeTimer();
}

function setPageLocked(locked) {
    const navItems = document.querySelectorAll('.nav-box-item:not(.disabled)');
    navItems.forEach(el => {
        if (locked) {
            el.setAttribute('data-timer-locked', 'true');
            el.style.pointerEvents = 'none';
            el.style.opacity = '0.4';
        } else {
            if (el.getAttribute('data-timer-locked')) {
                el.removeAttribute('data-timer-locked');
                el.style.pointerEvents = '';
                el.style.opacity = '';
            }
        }
    });

    const featureBtns = document.querySelectorAll('.feature-btn');
    featureBtns.forEach(btn => {
        if (locked) {
            if (!btn.classList.contains('active')) {
                btn.setAttribute('data-timer-locked', 'true');
                btn.disabled = true;
                btn.style.opacity = '0.4';
            }
        } else {
            if (btn.getAttribute('data-timer-locked')) {
                btn.removeAttribute('data-timer-locked');
                btn.disabled = false;
                btn.style.opacity = '';
            }
        }
    });

    const navBrand = document.querySelector('.navbar-brand');
    if (navBrand) {
        if (locked) {
            navBrand.setAttribute('data-timer-locked', 'true');
            navBrand.style.pointerEvents = 'none';
            navBrand.style.opacity = '0.5';
        } else {
            if (navBrand.getAttribute('data-timer-locked')) {
                navBrand.removeAttribute('data-timer-locked');
                navBrand.style.pointerEvents = '';
                navBrand.style.opacity = '';
            }
        }
    }

    const userMenuBtn = document.getElementById('userMenuButton');
    if (userMenuBtn) {
        if (locked) {
            userMenuBtn.setAttribute('data-timer-locked', 'true');
            userMenuBtn.disabled = true;
            userMenuBtn.style.opacity = '0.4';
        } else {
            if (userMenuBtn.getAttribute('data-timer-locked')) {
                userMenuBtn.removeAttribute('data-timer-locked');
                userMenuBtn.disabled = false;
                userMenuBtn.style.opacity = '';
            }
        }
    }
}

function handleTimerControl() {
    if (!isTimerRunning && !isPaused) {
        const confirmStart = confirm("Are you sure you want to start the timer? The screen will go dark to help you focus.");
        if (!confirmStart) return;
        startTimer();
    } else if (isTimerRunning && !isPaused) {
        pauseTimer();
    } else if (isPaused) {
        resumeTimer();
    }
}

function startTimer() {
    isTimerRunning = true;
    isPaused = false;
    sessionReadingTimeAdded = 0;

    const controlButton = document.getElementById("timerControlButton");
    controlButton.textContent = "Pause Timer";
    controlButton.classList.remove("btn-success");
    controlButton.classList.add("btn-warning");

    document.getElementById("timerResetButton").style.display = 'inline-block';

    document.getElementById("timerDuration").disabled = true;

    setPageLocked(true);

    activateOverlay();

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
            sessionReadingTimeAdded = 0;
            stopTimer(true);
            alert("Time's up! Great reading session!");
        }
    }, 1000);
}

function pauseTimer() {
    isPaused = true;
    isTimerRunning = false;
    clearInterval(timerInterval);

    const controlButton = document.getElementById("timerControlButton");
    controlButton.textContent = "Resume Timer";
    controlButton.classList.remove("btn-warning");
    controlButton.classList.add("btn-success");

    deactivateOverlay();
}

function resumeTimer() {
    isTimerRunning = true;
    isPaused = false;

    const controlButton = document.getElementById("timerControlButton");
    controlButton.textContent = "Pause Timer";
    controlButton.classList.remove("btn-success");
    controlButton.classList.add("btn-warning");

    activateOverlay();

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
            sessionReadingTimeAdded = 0;
            stopTimer(true);
            alert("Time's up! Great reading session!");
        }
    }, 1000);
}

function resetTimer() {
    const confirmReset = confirm("Are you sure you want to reset the timer? Any reading time recorded during this session will be reverted.");
    if (!confirmReset) return;

    if (sessionReadingTimeAdded > 0) {
        revertSessionReadingTime(sessionReadingTimeAdded);
        sessionReadingTimeAdded = 0;
    }

    stopTimer(false);
}

async function revertSessionReadingTime(secondsToRemove) {
    const currentUser = window.authUI ? window.authUI.getCurrentUser() : null;
    const currentUserData = window.authUI ? window.authUI.getCurrentUserData() : null;

    if (currentUser && currentUserData) {
        const prev = (currentUserData.bookhelp && currentUserData.bookhelp.totalReadingTime) || 0;
        const newTime = Math.max(0, prev - secondsToRemove);

        currentUserData.bookhelp = currentUserData.bookhelp || {};
        currentUserData.bookhelp.totalReadingTime = newTime;

        await window.firebaseAuth.updateBookHelpData(currentUser.uid, {
            totalReadingTime: newTime
        });
    }
}

function stopTimer(committed) {
    isTimerRunning = false;
    isPaused = false;
    clearInterval(timerInterval);

    const controlButton = document.getElementById("timerControlButton");
    controlButton.textContent = "Start Timer";
    controlButton.classList.remove("btn-warning");
    controlButton.classList.add("btn-success");

    const resetBtn = document.getElementById("timerResetButton");
    if (resetBtn) resetBtn.style.display = 'none';

    document.getElementById("timerDuration").disabled = false;

    setPageLocked(false);

    deactivateOverlay();

    timePassed = 0;
    timeLeft = TIME_LIMIT;
    initializeTimer();
}

function activateOverlay() {
    const overlay = document.getElementById("timerOverlay");
    overlay.classList.add("active");
}

function deactivateOverlay() {
    const overlay = document.getElementById("timerOverlay");
    overlay.classList.remove("active");
}

function showFeature(featureName) {
    const allSections = document.querySelectorAll('.content-section');
    allSections.forEach(section => section.classList.remove('active'));

    const allButtons = document.querySelectorAll('.feature-btn');
    allButtons.forEach(btn => {
        btn.classList.remove('active');
        btn.disabled = false;
    });

    let contentId = '';
    switch (featureName) {
        case 'timer':
            contentId = 'timerContent';
            initializeTimer();
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
    if (selectedContent) selectedContent.classList.add('active');

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
    if (seconds < 10) seconds = `0${seconds}`;
    return `${minutes}:${seconds}`;
}

function calculateTimeFraction() {
    const rawTimeFraction = timeLeft / TIME_LIMIT;
    return rawTimeFraction - (1 / TIME_LIMIT) * (1 - rawTimeFraction);
}

function setCircleDasharray() {
    const circleDasharray = `${(calculateTimeFraction() * 283).toFixed(0)} 283`;
    const pathElement = document.getElementById("base-timer-path-remaining");
    if (pathElement) pathElement.setAttribute("stroke-dasharray", circleDasharray);
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

window.addEventListener('beforeunload', function (e) {
    if (isTimerRunning || isPaused) {
        e.preventDefault();
        e.returnValue = '';
        return '';
    }
});

// ─── WPM CALCULATOR ──────────────────────────────────────────────────────────

const WPM_PROMPTS = {
    beginner: [
        {
            text: `The morning began quietly in the small town of Maple Hollow. A thin layer of mist rested over the fields, and the sun slowly climbed above the trees at the edge of the horizon. As the light grew stronger, the world seemed to stretch and wake. Birds called from fence posts, and somewhere in the distance a dog barked twice before settling down again. The air felt cool but gentle, and it carried the faint smell of damp earth from the rain that had fallen overnight.

Emma pushed open the front door of her house and stepped onto the porch. She paused for a moment, enjoying the stillness before the day became busy. Across the street, Mr. Jensen was already sweeping his walkway, moving the broom in steady strokes. He waved when he noticed her, and she waved back. It was a small ritual, but it made the morning feel friendly and familiar.

After breakfast, Emma decided to walk into town. The sidewalks were beginning to fill with people. A group of children hurried past her, laughing as they tried to keep up with one another. The bakery on the corner had its doors open, and the warm scent of fresh bread drifted outside. Emma stepped in and ordered a loaf of honey wheat and a small blueberry muffin. The baker wrapped them carefully in paper and wished her a good day.

At the park, the grass sparkled with droplets of water that had not yet dried. An older man sat on a bench reading the newspaper, while a young mother pushed her baby gently back and forth in a stroller. Emma chose a quiet spot beneath a large oak tree and sat down. She broke the muffin in half and watched as a pair of sparrows hopped closer, hoping for crumbs.

As she sat there, she thought about how simple the morning had been. There had been no rush, no loud noise, no urgent demands. Each moment had arrived calmly and left just as softly. She realized that days like this were easy to overlook. People often waited for exciting events or big changes before calling a day important. Yet this peaceful morning felt meaningful in its own quiet way.

When Emma finally rose to head home, the town had fully awakened. Cars moved along the main road, shop signs creaked in the breeze, and conversations drifted from open windows. She carried her bread under one arm and walked with steady steps. Though nothing extraordinary had happened, she felt content. The beauty of the day had not come from grand events but from small, steady details—the warmth of sunlight, the kindness of a wave, and the comfort of familiar streets.`,
            words: 620
        },
        {
            text: `On the edge of the forest stood an old wooden cabin that had been built many years ago. Its paint had faded, and the steps leading to the door creaked when anyone climbed them. Still, it remained strong, as if it understood that it had an important purpose. Every summer, the cabin welcomed visitors who came seeking rest from their busy lives in the city.

Daniel arrived there one afternoon with a single suitcase and a notebook tucked beneath his arm. He had decided that he needed time to think. His job had become stressful, and the noise of the city never seemed to stop. Even at night, traffic roared outside his apartment window. He hoped that the quiet of the forest would help him clear his mind.

Inside, the cabin was simple. A small table stood near the window, and a stone fireplace rested against the far wall. Dust floated in thin beams of sunlight. Daniel set down his suitcase and opened the windows to let in fresh air. The scent of pine trees filled the room almost at once.

Over the next few days, Daniel followed a slow routine. He woke with the sunrise and brewed coffee on the stove. Then he carried his notebook outside and sat on a fallen log, listening to the wind move through the branches. At first, his thoughts raced. He worried about unfinished tasks and unanswered emails. But gradually, the forest seemed to quiet his mind.

One afternoon, he noticed how many small sounds surrounded him—the buzz of insects, the distant rush of a stream, the soft crack of twigs beneath a squirrel's feet. These sounds did not demand attention; they simply existed. Watching them, he realized that not everything needed to be urgent. Some things could unfold naturally.

By the end of the week, Daniel felt lighter. He had not solved every problem waiting for him back home, but he had gained perspective. The cabin had not offered luxury or excitement. Instead, it had given him silence, and within that silence he had found clarity.

When he finally packed his suitcase to leave, Daniel paused at the doorway and looked back inside. The cabin stood just as it had before—quiet and steady. He understood that he could not stay forever, but he could carry the calm he had found there into his daily life. With that thought, he stepped outside and began the journey home.`,
            words: 640
        }
    ],

    intermediate: [
        {
            text: `Throughout history, periods of rapid technological advancement have reshaped not only economies but also patterns of thought, communication, and identity. When the printing press became widely available in Europe, it altered the distribution of knowledge in ways that few could have predicted. Literacy expanded, religious authority was challenged, and scientific inquiry accelerated. Centuries later, the industrial revolution reorganized labor, drawing populations into cities and redefining the meaning of work itself. Today, digital technologies continue this pattern of transformation at a pace that feels almost overwhelming.

One of the most significant changes brought about by the digital age is the restructuring of attention. Information is no longer scarce; it is abundant. Individuals carry devices that provide instant access to news, entertainment, and social interaction. While this connectivity offers undeniable benefits—greater efficiency, broader collaboration, and expanded access to education—it also fragments concentration. Tasks are frequently interrupted by notifications, and sustained focus becomes more difficult to maintain.

The implications of this shift extend beyond productivity. Attention shapes experience. When individuals divide their focus among multiple streams of information, their perception of time and depth can change. Conversations may feel shorter, reading sessions more hurried, and reflection less common. Researchers have begun to question how constant connectivity influences memory formation and emotional regulation. Some studies suggest that multitasking reduces retention and increases stress, while others highlight the adaptability of the human brain.

At the same time, digital platforms have democratized expression. Voices that once struggled to find publication can now reach global audiences. Grassroots movements have organized online, and marginalized communities have built networks of support. The same systems that fragment attention can also amplify solidarity and awareness.

The challenge, therefore, is not to reject technology but to engage with it intentionally. Educational institutions increasingly incorporate digital literacy into their curricula, teaching students not only how to use tools but how to evaluate information critically. Employers experiment with policies that protect uninterrupted work time. Individuals adopt strategies such as scheduled "offline hours" to restore balance.

Ultimately, technological transformation is neither inherently beneficial nor harmful. Its effects depend on design, regulation, and personal habits. By examining past revolutions and observing present patterns, society can make informed decisions about how to integrate innovation without sacrificing well-being. The goal is not to retreat into nostalgia but to cultivate awareness, ensuring that progress enhances rather than diminishes the human experience.`,
            words: 820
        }
    ],

    expert: [
        {
            text: `It has long been observed by those who devote themselves to the contemplation of human affairs, that the progress of civilization is attended by consequences at once splendid and perplexing; for while the arts advance, commerce extends her dominion, and the sciences multiply their triumphs, there arises also a species of inquietude, subtle yet persistent, which insinuates itself into the breast of modern man. He who walks amidst the marvels of invention—engines that outstrip the wind, wires that bear intelligence with the swiftness of thought, and instruments whereby the invisible motions of nature are rendered visible to the eye—may nevertheless confess to a certain disquiet, as though the very abundance of contrivance had imposed upon him a burden not easily borne.

In earlier ages, when the rhythm of existence was regulated chiefly by the rising and setting of the sun, and when the boundaries of one's native village seemed scarcely less fixed than the hills which enclosed it, the sphere of obligation was narrow, though perhaps no less solemn. A man's duties were plain before him; his reputation was shaped by neighbors whose faces he beheld daily; and the measure of his ambition was constrained by circumstance. Yet in our more expansive era, wherein the individual is made participant in transactions that traverse continents and in controversies that agitate distant nations, the field of action has widened beyond all former precedent.

This enlargement of sphere, though justly celebrated as a triumph of enlightenment, has rendered the cultivation of judgment more arduous. For when opinions, like leaves in autumn, descend in multitudes from every quarter, the mind must labor diligently lest it be overwhelmed. It is no longer sufficient to inherit conclusions from tradition; one must examine, compare, and discriminate. The faculty of attention, therefore, becomes not merely a convenience but a moral necessity. Without it, the citizen is at the mercy of clamor; with it, he may yet preserve independence of thought amidst tumult.

Nor is the difficulty confined to public concerns. In private life likewise, the multiplication of choice presents its own perplexities. The markets abound with commodities of every description; the professions diversify into countless specializations; and the paths by which a person may seek distinction are so numerous that selection itself grows burdensome. Freedom, in such circumstances, assumes a paradoxical aspect: it is cherished as a right, yet experienced at times as an obligation to decide wisely among alternatives whose consequences cannot be fully foreseen.

What remedy, then, shall be proposed? It would be folly to counsel retreat from improvement, for the benefits conferred by knowledge are too substantial to be renounced without ingratitude. Rather, the wiser course appears to consist in the deliberate formation of character suited to an age of complexity. Patience must be strengthened, that inquiry may proceed without haste. Humility must temper confidence, lest partial understanding masquerade as certainty. And above all, there must be cultivated a habit of reflection, whereby experience is not permitted to pass unexamined but is gathered, as it were, into the treasury of memory for future guidance.

Thus may the individual, though surrounded by the engines and excitements of modern life, retain that composure which earlier generations derived from simpler conditions. Progress need not extinguish serenity, provided that the inward faculties are disciplined to match the outward expansion of power. In this equilibrium—between advancement and restraint, between liberty and responsibility—lies the hope that civilization shall proceed not only in magnitude but in wisdom.`,
            words: 1040
        }
    ]
};

let wpmStartTime = null;
let wpmRunning = false;
let currentWpmPrompt = null;

function loadWpmPrompt() {
    const difficulty = document.getElementById('wpmDifficulty').value;
    const prompts = WPM_PROMPTS[difficulty];
    currentWpmPrompt = prompts[Math.floor(Math.random() * prompts.length)];
    document.getElementById('wpmPrompt').textContent = '';
    document.getElementById('wpmPromptContainer').style.display = 'none';
    document.getElementById('wpmResults').style.display = 'none';
    document.getElementById('wpmBeginButton').style.display = 'inline-block';
    document.getElementById('wpmFinishButton').style.display = 'none';
    wpmRunning = false;
    wpmStartTime = null;
}

function beginWPMTest() {
    if (!currentWpmPrompt) { loadWpmPrompt(); return; }
    document.getElementById('wpmPrompt').textContent = currentWpmPrompt.text;
    document.getElementById('wpmPromptContainer').style.display = 'block';
    wpmStartTime = Date.now();
    wpmRunning = true;
    document.getElementById('wpmBeginButton').style.display = 'none';
    document.getElementById('wpmFinishButton').style.display = 'inline-block';
}

function finishWPMTest() {
    if (!wpmRunning || !wpmStartTime) return;
    const elapsed = (Date.now() - wpmStartTime) / 1000 / 60;
    const wpm = Math.round(currentWpmPrompt.words / elapsed);
    wpmRunning = false;

    const resultsDiv = document.getElementById('wpmResults');
    const scoreDiv = document.getElementById('wpmScore');
    scoreDiv.innerHTML = `<strong>Your WPM: ${wpm}</strong><br><span class="text-muted">Words: ${currentWpmPrompt.words} &nbsp;|&nbsp; Time: ${(elapsed * 60).toFixed(1)}s</span>`;
    resultsDiv.style.display = 'block';
    document.getElementById('wpmFinishButton').style.display = 'none';
    document.getElementById('wpmBeginButton').style.display = 'inline-block';

    resultsDiv.dataset.wpm = wpm;

    const saveBtn = document.getElementById('wpmSaveButton');
    if (saveBtn) { saveBtn.textContent = 'Save Result'; saveBtn.disabled = false; }

    const goal = localStorage.getItem('wpmGoal');
    if (goal) {
        const met = wpm >= parseInt(goal);
        scoreDiv.innerHTML += `<br><span class="text-${met ? 'success' : 'danger'}">${met ? '✅ Goal met!' : `❌ Goal: ${goal} WPM`}</span>`;
    }
}

async function saveWpmResult() {
    const resultsDiv = document.getElementById('wpmResults');
    const wpm = parseInt(resultsDiv.dataset.wpm);
    if (!wpm) return;

    const currentUser = window.authUI ? window.authUI.getCurrentUser() : null;
    if (currentUser) {
        await window.firebaseAuth.updateBookHelpData(currentUser.uid, { wpmSpeed: wpm });
        document.getElementById('wpmSaveButton').textContent = 'Saved ✓';
        document.getElementById('wpmSaveButton').disabled = true;
    } else {
        localStorage.setItem('wpmLastResult', wpm);
        document.getElementById('wpmSaveButton').textContent = 'Saved ✓';
        document.getElementById('wpmSaveButton').disabled = true;
    }
}

// ─── COMPREHENSION TEST ──────────────────────────────────────────────────────

const COMP_PROMPTS = {
    beginner: [
        {
            passage: `Every Saturday morning, Liam helped his grandfather in the garden behind their small blue house. The garden was not very large, but it was carefully planned. Rows of tomatoes stood on one side, supported by wooden stakes. Carrots and lettuce grew in neat lines, while tall sunflowers leaned gently toward the fence. 

Liam's grandfather believed that gardening required patience more than strength. "Plants grow on their own time," he often said. "You can't rush them." At first, Liam did not understand what that meant. He wanted the tomatoes to turn red overnight and the sunflowers to bloom as soon as they were planted. But over the weeks, he began to see the truth in his grandfather's words.

Each visit followed a routine. They checked the soil for dryness, pulled small weeds before they spread, and examined the leaves for holes made by insects. One morning, Liam noticed that several tomato leaves had turned yellow. Worried, he asked if the plants were dying. His grandfather explained that the recent heavy rain had washed away some nutrients from the soil. To fix the problem, they mixed compost into the ground around the roots.

As summer continued, Liam learned to recognize small changes. He could tell when the lettuce was ready to harvest by the size and color of its leaves. He understood that sunflowers followed the movement of the sun during the day. Most importantly, he discovered that waiting was not the same as doing nothing. Even when growth was slow, careful attention made a difference.

By late August, the garden looked completely different from how it had in the spring. Bright red tomatoes hung heavily from their vines. The carrots were thick and ready to be pulled from the earth. Liam felt proud when neighbors complimented the vegetables at the local market. His grandfather simply smiled and reminded him that the garden's success came from steady care rather than quick effort.

On the final harvest day of the season, Liam realized he had changed as much as the plants had. He no longer expected instant results. Instead, he appreciated the quiet progress that happened a little at a time. Gardening had taught him that patience, attention, and consistency often matter more than speed.`,
            questions: [
                { q: "What lesson did Liam's grandfather say gardening required most?", options: ["Strength", "Money", "Patience", "Luck"], answer: 2 },
                { q: "Why did the tomato leaves turn yellow?", options: ["Too much sunlight", "Insects ate them", "Nutrients were washed away by rain", "They were too old"], answer: 2 },
                { q: "How did they fix the problem with the tomatoes?", options: ["Watered them more", "Added compost to the soil", "Moved them to shade", "Picked them early"], answer: 1 },
                { q: "What did Liam ultimately learn from gardening?", options: ["How to sell vegetables", "That speed is most important", "That patience and steady care lead to success", "That gardening is easy"], answer: 2 }
            ]
        }
    ],

    intermediate: [
        {
            passage: `Public libraries have long served as cornerstones of civic life, yet their role has evolved significantly over time. Originally conceived primarily as repositories of books, libraries were designed to preserve knowledge and provide access to printed materials for those who could not afford to purchase them. In the nineteenth and early twentieth centuries, expanding literacy rates and industrial growth increased demand for public education, and libraries became symbols of democratic access to information.

In the contemporary era, however, libraries fulfill a much broader function. While lending books remains central, modern libraries provide digital resources such as e-books, online databases, and internet access. For individuals without reliable connectivity at home, library computers and Wi-Fi services are essential tools for applying for jobs, completing school assignments, or accessing government services.

Beyond technological access, libraries have developed into community hubs. Many host workshops on resume writing, financial literacy, and language learning. Children's story hours promote early literacy, while book clubs encourage discussion and critical thinking among adults. Some libraries even provide maker spaces equipped with 3D printers and audio-visual tools, allowing patrons to experiment with new forms of creativity.

The social significance of these services becomes especially apparent during times of economic hardship. When unemployment rises, library attendance often increases as individuals seek both practical assistance and a quiet space to focus. During public emergencies, libraries have functioned as information centers, helping residents navigate rapidly changing circumstances.

Critics occasionally question whether physical libraries remain necessary in an age when vast amounts of information are accessible online. However, this perspective overlooks two key factors. First, not all information online is reliable or accurate. Librarians are trained to guide patrons toward credible sources, fostering information literacy rather than passive consumption. Second, access to digital tools is unevenly distributed. Libraries help bridge this divide by offering free services regardless of income level.

Ultimately, the enduring value of libraries lies not solely in the materials they house but in the equitable access and communal space they provide. As technology continues to transform how knowledge is created and shared, libraries adapt rather than disappear. Their mission remains consistent: to empower individuals through access to information, education, and community engagement.`,
            questions: [
                { q: "What was the primary original purpose of public libraries?", options: ["Hosting technology workshops", "Preserving and lending books", "Providing internet access", "Offering job training"], answer: 1 },
                { q: "Why are library computers important today?", options: ["They are faster than home computers", "They are used only for entertainment", "They provide access for those without reliable connectivity", "They replace librarians"], answer: 2 },
                { q: "Which criticism of libraries does the passage address?", options: ["Libraries are too expensive to maintain", "Libraries are unnecessary because information is online", "Libraries have too many books", "Libraries limit creativity"], answer: 1 },
                { q: "What is identified as a key enduring value of libraries?", options: ["Selling books cheaply", "Replacing schools", "Providing equitable access and community space", "Eliminating printed materials"], answer: 2 }
            ]
        }
    ],

    expert: [
        {
            passage: `Among the many questions which have engaged the reflections of philosophers and statesmen, few have proven so persistent as that which concerns the proper relation between liberty and authority. For if liberty be understood as the natural right of individuals to direct their own conduct according to conscience and reason, authority must nevertheless be acknowledged as the necessary instrument whereby order is preserved and justice administered. The difficulty arises not from the abstract definitions of these principles, but from their practical reconciliation within the institutions of civil society.

In the earliest formations of organized government, authority frequently asserted itself in forms absolute and untempered. Monarchs claimed dominion by divine sanction; obedience was enjoined as both civic and spiritual duty. Yet experience demonstrated that unchecked power is prone to excess. The history of nations furnishes abundant testimony that rulers, however virtuous at their accession, may succumb to ambition or partiality when no countervailing force restrains them.

From such observations emerged the doctrine that liberty is best secured not by the absence of authority, but by its distribution. The separation of powers—assigning legislative, executive, and judicial functions to distinct bodies—was conceived as a safeguard against tyranny. By obliging each branch to operate within defined limits, and by enabling them to moderate one another's excesses, constitutional frameworks sought to harmonize strength with restraint.

Yet even these contrivances are not self-executing. Institutions depend upon the character of those who inhabit them. If citizens grow indifferent to public affairs, or if representatives prioritize faction over principle, the equilibrium so carefully designed may deteriorate. Liberty, therefore, demands vigilance not only from magistrates but from the populace at large. Education assumes particular importance in this regard, for an uninformed citizenry is ill-equipped to evaluate policy or resist encroachment.

It must likewise be conceded that liberty is not synonymous with license. The freedom to act cannot extend to actions that undermine the equal rights of others. Laws, when justly framed and impartially enforced, do not extinguish liberty but delineate its proper sphere. The challenge lies in discerning where regulation preserves common welfare and where it intrudes unnecessarily upon individual autonomy.

Thus the contest between liberty and authority ought not to be conceived as a perpetual antagonism, but rather as a dynamic balance requiring continual adjustment. Excess in either direction proves detrimental: unbounded authority invites despotism, while unrestrained liberty risks disorder. The enduring task of constitutional government is to maintain this balance through prudent legislation, institutional safeguards, and an engaged citizenry.

In contemplating these matters, one is reminded that political arrangements, however ingeniously devised, cannot substitute entirely for civic virtue. The stability of free institutions ultimately rests upon habits of moderation, respect for law, and a willingness to subordinate private interest to public good. Where such qualities flourish, liberty and authority may coexist in productive tension; where they decay, no parchment barrier will suffice to preserve freedom.`,
            questions: [
                { q: "According to the passage, what creates the difficulty between liberty and authority?", options: ["Their definitions are unclear", "They cannot exist together", "Their practical reconciliation in civil institutions", "Authority is always evil"], answer: 2 },
                { q: "Why were constitutional separations of power developed?", options: ["To eliminate government entirely", "To safeguard against tyranny by distributing authority", "To increase monarch power", "To simplify lawmaking"], answer: 1 },
                { q: "What role does education play in maintaining liberty?", options: ["It replaces constitutional safeguards", "It prepares citizens to evaluate policy and resist encroachment", "It eliminates authority", "It ensures economic growth"], answer: 1 },
                { q: "How does the passage define the proper relationship between liberty and law?", options: ["Law always destroys liberty", "Liberty means absence of all law", "Just laws define and protect the proper sphere of liberty", "Law and liberty cannot coexist"], answer: 2 }
            ]
        }
    ]
};

let currentCompPrompt = null;
let compStreak = 0;

function loadCompPrompt() {
    const difficulty = document.getElementById('compDifficulty').value;
    const prompts = COMP_PROMPTS[difficulty];
    currentCompPrompt = prompts[Math.floor(Math.random() * prompts.length)];
    document.getElementById('compPrompt').textContent = '';
    document.getElementById('compPromptContainer').style.display = 'none';
    document.getElementById('compQuestions').style.display = 'none';
    document.getElementById('compResults').style.display = 'none';
    document.getElementById('compBeginButton').style.display = 'inline-block';
    document.getElementById('compSubmitButton').style.display = 'none';
}

function beginCompTest() {
    if (!currentCompPrompt) { loadCompPrompt(); return; }
    document.getElementById('compPrompt').textContent = currentCompPrompt.passage;
    document.getElementById('compPromptContainer').style.display = 'block';
    const qContainer = document.getElementById('compQuestions');
    qContainer.innerHTML = currentCompPrompt.questions.map((q, i) => `
        <div class="mb-3">
            <p><strong>${i + 1}. ${q.q}</strong></p>
            ${q.options.map((opt, j) => `
                <div class="form-check">
                    <input class="form-check-input" type="radio" name="compQ${i}" id="compQ${i}O${j}" value="${j}">
                    <label class="form-check-label" for="compQ${i}O${j}">${opt}</label>
                </div>
            `).join('')}
        </div>
    `).join('');
    qContainer.style.display = 'block';
    document.getElementById('compBeginButton').style.display = 'none';
    document.getElementById('compSubmitButton').style.display = 'inline-block';
    document.getElementById('compResults').style.display = 'none';
}

async function submitCompAnswers() {
    if (!currentCompPrompt) return;
    let correct = 0;
    const total = currentCompPrompt.questions.length;
    currentCompPrompt.questions.forEach((q, i) => {
        const selected = document.querySelector(`input[name="compQ${i}"]:checked`);
        if (selected && parseInt(selected.value) === q.answer) correct++;
    });
    const pct = Math.round((correct / total) * 100);

    document.getElementById('compScore').innerHTML =
        `<strong>${correct} / ${total} correct (${pct}%)</strong>`;
    document.getElementById('compResults').style.display = 'block';
    document.getElementById('compSubmitButton').style.display = 'none';
    document.getElementById('compQuestions').style.display = 'none';
    document.getElementById('compPromptContainer').style.display = 'none';

    const goalStr = localStorage.getItem('compGoal');
    if (goalStr) {
        const goal = parseInt(goalStr);
        if (pct >= goal) {
            compStreak++;
        } else {
            compStreak = 0;
        }
        localStorage.setItem('compStreak', compStreak);
        updateCompStreakDisplay();
    }

    const currentUser = window.authUI ? window.authUI.getCurrentUser() : null;
    if (currentUser) {
        await window.firebaseAuth.updateBookHelpData(currentUser.uid, {
            lastComprehensionTest: { score: correct, total, percentage: pct, date: new Date().toISOString() }
        });
    }
}

// ─── GOAL CENTER ─────────────────────────────────────────────────────────────

function saveWpmGoal() {
    const val = document.getElementById('wpmGoalInput').value;
    if (!val || isNaN(val) || parseInt(val) <= 0) {
        alert('Please enter a valid WPM goal.');
        return;
    }
    localStorage.setItem('wpmGoal', parseInt(val));
    updateWpmGoalDisplay();
}

function clearWpmGoal() {
    localStorage.removeItem('wpmGoal');
    document.getElementById('wpmGoalInput').value = '';
    updateWpmGoalDisplay();
}

function updateWpmGoalDisplay() {
    const goal = localStorage.getItem('wpmGoal');
    const statusEl = document.getElementById('wpmGoalStatus');
    if (goal) {
        statusEl.textContent = `Current WPM goal: ${goal} WPM`;
        statusEl.className = 'mb-3 text-success';
    } else {
        statusEl.textContent = 'No WPM goal set.';
        statusEl.className = 'mb-3 text-muted';
    }
}

function saveCompGoal() {
    const val = document.getElementById('compGoalInput').value;
    localStorage.setItem('compGoal', val);
    compStreak = parseInt(localStorage.getItem('compStreak') || '0');
    updateCompGoalDisplay();
}

function clearCompGoal() {
    localStorage.removeItem('compGoal');
    localStorage.removeItem('compStreak');
    compStreak = 0;
    updateCompGoalDisplay();
    updateCompStreakDisplay();
}

function updateCompGoalDisplay() {
    const goal = localStorage.getItem('compGoal');
    const statusEl = document.getElementById('compGoalStatus');
    if (goal) {
        statusEl.textContent = `Current comprehension goal: ${goal}% per test`;
        statusEl.className = 'mb-3 text-success';
    } else {
        statusEl.textContent = 'No comprehension goal set.';
        statusEl.className = 'mb-3 text-muted';
    }
}

function updateCompStreakDisplay() {
    const streakEl = document.getElementById('compStreakStatus');
    const streak = parseInt(localStorage.getItem('compStreak') || '0');
    if (streak > 0) {
        streakEl.textContent = `🔥 Current streak: ${streak} test${streak !== 1 ? 's' : ''} meeting your goal`;
        streakEl.className = 'mb-3 text-warning fw-bold';
    } else {
        streakEl.textContent = 'No active streak yet. Take a comprehension test to start one!';
        streakEl.className = 'mb-3 text-muted';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    loadWpmPrompt();
    loadCompPrompt();
    updateWpmGoalDisplay();
    updateCompGoalDisplay();
    updateCompStreakDisplay();
    compStreak = parseInt(localStorage.getItem('compStreak') || '0');

    const savedWpmGoal = localStorage.getItem('wpmGoal');
    if (savedWpmGoal) {
        document.getElementById('wpmGoalInput').value = savedWpmGoal;
    }
    const savedCompGoal = localStorage.getItem('compGoal');
    if (savedCompGoal) {
        document.getElementById('compGoalInput').value = savedCompGoal;
    }
});