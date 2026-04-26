---
marp: true
size: 4:3
paginate: true
title: Final Project Presentation - BookCenter
---

# BookCenter - Final Presentation
#### Preston Jackson

---

## BookCenter
- Problem: Reading rates dwindling in younger generations and skills are decreasing
- Solution: Full-Stack Web App containing tools, tracking, and stats to visualize progress and succeed
- Made up of 4 Main Tools: Bookeep, BookHelp, BookStats, and BookNotes

---

## Technology Stack
- Frontend: HTML, CSS, JavaScript, Bootstrap, Chart.js
- Backend: Firebase (Firestore, Authentication, App Check, Hosting)
- APIs: OpenLibrary, Anthropic Claude, reCAPTCHA

---

## Sprint 1 Recap

- User Login/Logout
- Firebase Setup (Authorization)
- UI Creation
- OpenLibrary API Implemetation
- Bookeep: Ratings, Goal System
- BookHelp: Reading Timer, WPM Calculation Test, Comprehension Test, Goal Setting

---

## Sprint 2

- AI Book Recommendations
- BookStats: Chart.js Implementation
- BookNotes: Implement Collections and Notes Functions
- BookHelp: AI Goal Setting utilizing Claude API
- UI Overhaul
- Firebase Modifications and Setup
- Test Case Implementation
- Deployment

---

## Changes Made Along the Way

- Switched Focus from MongoDB to Firebase Early On
- Rescheduled AI Goal Setting to after BookStats creation

---

## Burndown Rate

Total Features: 5 (Bookeep, BookHelp, BookStats, BookNotes, Firebase)
Total Requirements: 25 (13 (Sprint 1), 12 (Sprint 2))

Completed Features: 5
Completed Requirements: 25

Feature Rate: 100%
Requirement Rate: 100%

Total LoC: 6,121

---

## Test Results

- Test Suites: 5 passed, 5 total
- Tests: 188 passed, 188 total
- Time: 2.252 s

---

## Challenges

- First time using Firebase - Had some setbacks and long nights solving issues
- Test Cases had setup issues, took some time to resolve
- User test feedback was often broad and not helpful along development

---

## Future Development Plan

- BookHelp
  1. Add Color Key to Book Recommendations as users felt lost by color meaning
- Login
  1. Quality of Life Updates
  2. View password button
- BookStats
  1. Users wanted to be able to click on note overviews to traverse to relevant page

---

## Demo Link

Link to Video Presentation: https://youtu.be/vcaluEkqz_8

Link to Site: https://bookcenter-b90ae.web.app
Link also on GitHub

---

## Learning with AI
### Topic 1: AI Book Recommendations

#### How it Works:
- Taking in info from user and OpenLibraryAPI
- Compares books and gives them point score
- Returns list of highest scores, displays on BookHelp

#### What I Learned:
- Reactive Machine will not always produce the same # of items each time
- Recommendation system is a sweet-spot for AI
- Model needed manual tweaking to keep bias down and non-English translations away

---

## Learning with AI
### Topic 2: AI Goal Setting

#### How it Works:
- User selects level of goal (1 of 3)
- Data is gathered from BookStats metrics of that user
- Prompt is sent and used by Claude API
- JSON Response sent back, showing personalized goal for the user
- User chooses if the goal should be applied

#### What I Learned:
- First time setting up Claude API was challenging
- Good prompts for API to give best response took trial+error
- Claude API was really good at making personal goals and giving good feedback on why this goal is perfect

---

## Questions?