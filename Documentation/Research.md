# BookCenter: Design and Development of a Full-Stack Reading Companion Web Application

**Author:** Preston Jackson  
**Course:** ASE 485 — Software Engineering Capstone  
**Institution:** Northern Kentucky University  
**Date:** April 2026  
**Deployment:** https://book-center-official.web.app

---

## Abstract

BookCenter is a full-stack web application designed to serve as a comprehensive personal reading companion. The system integrates four distinct functional modules — Bookeep, BookHelp, BookStats, and BookNotes — under a unified authentication and data persistence layer. The application is deployed on Firebase Hosting with Cloud Firestore as its database backend, Firebase Authentication for identity management, and Firebase App Check for security enforcement. This paper documents the architecture, design decisions, implementation challenges, and outcomes of each module, as well as the cross-cutting concerns of authentication, security, and deployment that tie the system together.

---

## 1. System Architecture and Authentication

### 1.1 Overview

BookCenter is a multi-page web application (MPA) built entirely with vanilla JavaScript, HTML5, and CSS3, augmented by Bootstrap 5.3 for layout and component utilities and the Google Fonts API for typography. Rather than adopting a frontend framework such as React or Vue, the project deliberately uses a globals-style JavaScript architecture in which each page loads its own backend script, and shared state is managed through Firebase's real-time authentication listener and a cached user data object maintained by `authUI.js`.

The decision to avoid a framework was intentional. As a capstone project targeting breadth of full-stack knowledge, the implementation demonstrates direct DOM manipulation, asynchronous JavaScript patterns, and manual state management — skills that sit underneath the abstractions provided by modern frameworks.

### 1.2 Firebase Infrastructure

The application relies on three Firebase services:

- **Firebase Hosting** serves all static assets over HTTPS via Firebase's global CDN, ensuring fast load times and automatic SSL certificate management.
- **Cloud Firestore** is the primary database, storing each user's data in a document at `/users/{uid}`. A secondary `/usernames/{username}` collection enables login by username rather than email, with an O(1) direct document lookup.
- **Firebase Authentication** handles account creation, email/password sign-in, session persistence scoped to the browser session, and password reset flows.

Firebase App Check with reCAPTCHA v3 is enforced on Firestore, meaning all database reads and writes require a valid App Check token. This prevents unauthorized scripts or scrapers from accessing the database even if the Firebase configuration object is exposed.

### 1.3 Authentication Flow

Authentication is managed by two files: `firebaseAuth.js`, which wraps all Firebase SDK calls into a clean API exposed on `window.firebaseAuth`, and `authUI.js`, which manages the UI layer — rendering login/signup modals, navbar buttons, and routing users to appropriate pages.

On every page load, `authUI.js` registers an `onAuthStateChanged` listener. When a user is authenticated, the listener fetches their Firestore document, caches it in memory, and calls the appropriate page initialization function (e.g., `window.initBookeep(userData)`). When the user signs out or their session expires, the cached data is cleared and protected pages redirect to `BookCenter.html`.

Session security is enforced at two levels. Firebase's built-in session persistence is scoped to `SESSION` (tab-level), meaning credentials do not persist across browser restarts. Additionally, a custom session watchdog runs every five minutes and signs the user out automatically if their session exceeds 24 hours in absolute time or 1 hour of inactivity, measured via timestamps written to `sessionStorage`.

### 1.4 Security Rules

Firestore security rules enforce the principle of least privilege. User documents are readable and writable only by the authenticated user whose UID matches the document ID. The `usernames` collection is publicly readable (required for the username-to-email lookup during login) but write operations are restricted: only the authenticated user whose UID matches the document's stored `uid` field may create, update, or delete their own username entry. This prevents any authenticated user from hijacking or deleting another user's username.

```
match /users/{userId} {
  allow read, write: if request.auth != null && request.auth.uid == userId;
}
match /usernames/{username} {
  allow read: if true;
  allow create: if request.auth != null
                && request.resource.data.uid == request.auth.uid;
  allow update, delete: if request.auth != null
                        && resource.data.uid == request.auth.uid;
}
```

---

## 2. Bookeep — Book Tracking and Library Management

### 2.1 Purpose and Design

Bookeep is the core data-entry module of BookCenter. It allows users to log books they have finished, recording the title, author, word count, date finished, and a star rating from 0 to 5 (supporting half-star increments). The accumulated library feeds data into every other module — BookStats pulls from it for charts, BookHelp's recommendation engine analyzes it for taste profiling, and BookCenter's dashboard summarizes it on the homepage.

### 2.2 Book Search Integration

Rather than requiring users to manually enter book details, Bookeep integrates with the Open Library Search API (`openlibrary.org/search.json`). As the user types a query, a search request is issued on button press or Enter key, returning up to eight results with title, author, and publication year. Selecting a result pre-fills the title and author fields, reducing friction and improving data consistency across users.

For books not found in Open Library — self-published works, textbooks, or obscure titles — a manual entry mode is available, toggled by a button that switches between the search interface and plain text input fields.

### 2.3 Statistics and the Points System

Bookeep maintains four running statistics visible to the user: total word count across all books, word count for the current calendar year, total books read, and a "goal" metric that can be toggled between two modes. In words mode, the goal is calculated as total yearly word count divided by 10,000, producing a points figure that grows with reading volume. In books mode, the goal simply counts books completed in the current year. This dual-mode system accommodates readers who track progress by volume (words read) and those who prefer a simpler book count target.

### 2.4 Data Persistence and Export

Books are stored in Firestore under `bookeep.books` as an array of objects. On save, `firebaseAuth.updateBookeepData()` also recomputes and stores derived statistics (`totalWords`, `totalBooks`, `yearlyWordCount`, `yearlyPoints`) at the document level, so that the BookCenter dashboard can display summary figures without re-reading the full books array.

For users who want a backup or wish to migrate data, Bookeep provides JSON export and import functionality. Export serializes the current books array and triggers a browser file download. Import reads a user-supplied JSON file, validates that it is an array with the required fields (`id`, `title`, `wordCount`, `dateRead`), and merges it with or replaces the existing library.

### 2.5 Wrapped

Inspired by Spotify Wrapped, Bookeep includes a year-in-review feature that generates a visually styled summary of the user's reading year. The modal displays total books and words read, the highest-rated book, the longest book by word count, and the most recently finished book, rendered over a gradient background with Playfair Display typography. Users can screenshot the modal to share their reading year.

---

## 3. BookHelp — Reading Skills and Improvement Tools

### 3.1 Purpose and Design

BookHelp is the most feature-rich module in BookCenter, comprising five distinct tools accessible through a tabbed navigation interface: a reading speed (WPM) test, a reading comprehension test, a goal center, an AI-assisted goal advisor powered by the Anthropic Claude API, and a book recommendation engine. The module is designed around the idea that reading is a skill that can be measured, tracked, and improved.

### 3.2 Reading Speed Test (WPM)

The WPM tester presents the user with a prose passage at a chosen difficulty level (beginner, intermediate, or expert) and measures how long it takes to read it. When the user clicks "Done Reading," the elapsed time and passage word count are used to calculate words per minute. The result is saved to Firestore and appended to the user's WPM history, enabling BookStats to chart speed progression over time.

The reading timer is implemented using an SVG circular countdown display, a technique adapted from a guide by Mateusz Rybczonek. The SVG path's `stroke-dasharray` is updated on each tick to visually shrink the circle, and the stroke color transitions through yellow, orange, and green thresholds as time progresses — providing an intuitive visual cue without requiring any external animation library.

### 3.3 Comprehension Testing

The comprehension test presents a passage followed by four multiple-choice questions. Passages exist at three difficulty levels, with beginner passages drawn from gentle narrative prose, intermediate passages from expository essays on topics such as technological change and civic institutions, and expert passages from formal academic and philosophical prose in an elevated Victorian register.

After submission, the user receives a score out of four (or five, depending on the passage), expressed as a percentage. Results are saved to Firestore and tracked for streak counting — if the user has set a comprehension goal percentage, consecutive tests meeting that goal increment a streak counter displayed in the goal center.

### 3.4 Goal Center and AI Advisor

The goal center allows users to set two personal targets: a WPM speed goal and a comprehension score goal. Goals are saved to Firestore and persist across sessions. The comprehension streak counter tracks consecutive tests that meet the set threshold, providing motivational continuity.

An AI-powered goal advisor is also available, built on top of the Anthropic Claude API (via the artifact's `window.anthropic` integration). Users select a goal mode (WPM improvement or comprehension score) and click "Get AI Suggestion." The advisor is prompted with the user's current WPM history, comprehension history, and goals, and returns a personalized suggested target along with a rationale and a practical tip. The suggestion can be applied directly to the goal input field with a single button click, reducing friction between receiving advice and acting on it.

### 3.5 Book Recommendation Engine

The recommendation engine generates personalized book suggestions by constructing a taste profile from the user's Bookeep library and querying the Open Library API. The pipeline operates in four stages:

1. **Profile building:** The engine samples up to eight of the user's logged books and fetches their subject tags from Open Library. Author names are also collected from the full library. Subject and author frequencies are tallied to identify the user's top interests.

2. **Candidate fetching:** Parallel API queries are issued for each top subject and top author, retrieving up to 15 candidates per subject and 10 per author. An additional set of "curveball" queries targets the user's less-frequent subjects to surface unexpected discoveries.

3. **Scoring and diversification:** Each candidate is scored by summing the frequency weights of its subjects that overlap with the user's profile, with a bonus for books by known authors and a small penalty for pre-1900 publication dates. A diversification pass ensures that no single subject dominates the final list.

4. **Rendering:** The top-scored recommendations are displayed in styled cards, each linking to the book's Open Library page and a Goodreads search. Curveball picks and author-specific picks are visually distinguished. Users can hide individual recommendations with an animated dismissal, cycling through the full scored pool without regenerating it.

---

## 4. BookStats — Analytics and Data Visualization

### 4.1 Purpose and Design

BookStats is the analytics module of BookCenter. It aggregates data from all three other modules — Bookeep, BookHelp, and BookNotes — and renders it as a collection of Chart.js charts and summary badges. The goal is to give users a clear, visually appealing picture of their reading habits over time, enabling reflection and motivation.

### 4.2 Bookeep-Derived Charts

Four charts are generated from the Bookeep library:

- **Books Read (monthly bar chart):** Shows how many books were completed in each of the last 13 calendar months, giving a rolling year view of reading frequency.
- **Points (yearly bar chart):** Plots accumulated reading points (words ÷ 10,000) per calendar year, useful for tracking year-over-year growth.
- **Word Count (line chart):** Tracks total words read over time, broken down by month.
- **Ratings Distribution (horizontal bar chart):** Shows the count of books at each star rating from 1 to 5, giving a sense of the user's critical standards.

Two additional submission breakdown charts (by year and by month, color-coded by year) give a longitudinal view of how reading habits have evolved since the user started logging books.

### 4.3 BookHelp-Derived Charts

WPM test results are plotted as a line chart ordered by test date, allowing users to see their speed trajectory. Comprehension results are rendered as a bar chart with a percentage overlay, with bars color-coded by score tier (dark blue for 4/4, red for 0–1). Summary badges for both charts include counts of tests taken in the last 12 months and last month, average WPM, and average comprehension score.

Reading timer data, logged whenever the user uses BookHelp's built-in countdown timer, is aggregated by month and displayed as a bar chart measuring hours spent reading per month.

### 4.4 BookNotes-Derived Charts

Two charts summarize the user's BookNotes activity: a monthly bar chart of notes created over the last 13 months, and a horizontal bar chart of notes per collection. These provide a lightweight view into annotation habits and which books generated the most engagement.

### 4.5 Loading and Empty States

BookStats includes thoughtful handling of data states. A spinner is shown while data loads from Firestore. If the user has no data at all, an empty state with a friendly prompt directs them to Bookeep and BookHelp to get started. The stats container is only revealed once data is confirmed to be present, preventing a flash of empty charts.

---

## 5. BookNotes — Sticky Note Collections

### 5.1 Purpose and Design

BookNotes provides a visual, sticky-note-style interface for capturing thoughts, quotes, and page references from books. The design metaphor is a corkboard of colorful paper notes, each attached with a red pin and lined with faint horizontal rules. Collections group notes by book or topic, and users navigate between a grid view of collections and a grid view of the notes within each collection.

### 5.2 Collections and Notes

Each collection stores a title, a hex color, a creation timestamp, and an array of notes. Each note stores a title, an optional page number, a body text, a color, and both creation and update timestamps. All IDs are generated client-side using a timestamp-plus-random-string scheme (`Date.now().toString(36) + Math.random().toString(36).slice(2, 7)`), which provides sufficient uniqueness for personal data without requiring server-side ID generation.

The note creation interface features a live sticky-note preview that updates in real time as the user types — the preview note's title, page number, body, and background color all respond immediately to input, giving users a WYSIWYG experience before committing.

### 5.3 Inline Editing

Notes support inline editing directly on the card without navigating to a separate page. Clicking the edit button replaces the note card's HTML content with an edit form, pre-populated with the note's current values. On save, the note is updated in place and the card is re-rendered. On cancel, the card reverts to its display state. This in-place editing pattern keeps the user oriented within the collection view and avoids disorienting page transitions.

### 5.4 Data Security and XSS Prevention

All user-supplied text rendered into the DOM is passed through an `escBN()` function that sets the text as `textContent` on a throwaway `div` element and reads back `innerHTML`, relying on the browser's native HTML entity encoding to neutralize `<`, `>`, and `&` characters. HTML attribute values are sanitized separately through `escAttr()`, which escapes double quotes and single quotes to prevent attribute injection. These measures ensure that notes containing HTML or script tags render as literal text rather than executable markup.

---

## 6. Cross-Cutting Concerns: Deployment, Testing, and Lessons Learned

### 6.1 Deployment

BookCenter is deployed to Firebase Hosting from a `src/` directory containing all application files. The deployment pipeline is managed via the Firebase CLI (`firebase deploy`), which uploads changed files to Firebase's CDN and invalidates the cache. A custom `index.html` at the root of the public directory performs an immediate meta-refresh redirect to `BookCenter.html`, ensuring that the bare domain URL (`book-center-official.web.app`) resolves to the homepage.

One significant deployment challenge encountered was Firebase's CDN caching behavior. After correcting a case-sensitivity error in the image filename (`bookeepLogo.png` vs. `bookeeplogo.png`), the corrected file was deployed successfully but the CDN continued to serve the cached 404 response for several minutes. This is expected behavior for a globally distributed CDN — propagation is not instantaneous — but it required awareness of the distinction between a deployment completing and the deployment being visible to all users.

A credential leak to a public GitHub repository necessitated rotating the Firebase project and reCAPTCHA keys mid-project. This incident reinforced the importance of adding sensitive configuration files (`firebaseAuth.js`) to `.gitignore` before the first commit, rather than after a leak has occurred.

### 6.2 Testing

The project includes a Jest-based unit test suite covering all five backend JavaScript modules. Tests are organized in a `tests/` subdirectory and run with `npm test`. Each test file uses a `eval()`-based module loading pattern — the source file is read from disk and evaluated in the test context, with top-level `let`/`const` declarations preprocessed to `global.*` assignments so that tests can both read and mutate module-level state.

Key testing challenges included:
- **Firebase SDK mocking:** `firebaseAuth.js` initializes Firebase on load, requiring a complete mock of `firebase.initializeApp`, `firebase.auth()`, `firebase.firestore()`, and `firebase.appCheck()` before the eval.
- **DOM simulation:** Backend modules reference `document.getElementById`, `document.createElement`, and `localStorage` on load, requiring stubs to be in place before the module is evaluated.
- **XSS utility testing:** The `escBN()` function uses `document.createElement('div')` and relies on the `textContent`/`innerHTML` relationship, requiring the mock `createElement` to simulate real DOM encoding behavior by escaping `<`, `>`, and `&` in the `textContent` setter.

188 tests pass across the five modules, covering utility functions, data persistence paths, rendering logic, and authentication flows.

### 6.3 Lessons Learned

Several design decisions made early in the project created friction later:

**Globals-style module loading** kept the deployment simple (no build step, no bundler) but made unit testing significantly more complex. A module system such as CommonJS or ES modules would have made both imports and test isolation cleaner, at the cost of requiring a build pipeline.

**Storing all user data in a single Firestore document** simplifies reads — one `getUserData()` call fetches everything — but creates a practical limit on how large a user's library can grow before the document approaches Firestore's 1 MB per-document limit. A subcollection-based architecture would scale better for heavy users.

**The Firebase App Check activation call** was initially wrapped in a conditional (`if (!firebase.appCheck().getToken)`) that never evaluated to true, silently disabling App Check while Firestore enforcement was enabled. This caused all database operations to fail until the conditional was removed. The lesson is that security middleware failures tend to be silent rather than loud, and should be explicitly verified in a staging environment before enabling enforcement in production.

**Case sensitivity** on Linux-based servers (Firebase Hosting runs on Linux) is a meaningful concern for developers on Windows, where the filesystem is case-insensitive. The image file `bookeepLogo.png` was referenced as `bookeeplogo.png` in all HTML files — this worked locally on Windows but produced 404 errors in production until the filenames were aligned.

### 6.4 Future Work

Several enhancements would meaningfully improve BookCenter beyond the current implementation:

- **Social features:** Allowing users to share their Wrapped summaries or reading statistics publicly would increase engagement and provide a sharing mechanism for the project.
- **Mobile app:** The current web application is responsive and functional on mobile browsers, but a native or Progressive Web App (PWA) version with offline support and push notifications for reading reminders would better serve mobile users.
- **Richer recommendations:** The current recommendation engine relies entirely on Open Library subject tags, which are inconsistently applied. Integrating a dedicated book metadata API such as Google Books would provide richer genre and theme data for more accurate profiling.
- **Reading streaks:** A daily reading log feature, combined with a streak counter tracking consecutive days of logged reading time, would add a habit-formation dimension to the application.
- **Collaborative notes:** Allowing multiple users to share a BookNotes collection would support book clubs and classroom use cases.

---

## References

- Firebase Documentation. (2024). *Firebase Hosting, Cloud Firestore, Firebase Authentication, App Check*. Google. https://firebase.google.com/docs
- Open Library API. (2024). *Open Library Developer Center*. Internet Archive. https://openlibrary.org/developers/api
- Bootstrap. (2024). *Bootstrap 5.3 Documentation*. The Bootstrap Authors. https://getbootstrap.com/docs/5.3
- Rybczonek, M. (2019). *Building a Countdown Timer with CSS and JavaScript*. CSS-Tricks. https://css-tricks.com/how-to-create-an-animated-countdown-timer-with-html-css-and-javascript/
- Anthropic. (2024). *Claude API Documentation*. Anthropic. https://docs.anthropic.com
- Jest. (2024). *Jest Documentation*. Meta Open Source. https://jestjs.io/docs/getting-started
- Google reCAPTCHA. (2024). *reCAPTCHA v3 Developer Guide*. Google. https://developers.google.com/recaptcha/docs/v3
