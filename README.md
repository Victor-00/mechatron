
# Snakes and Ladders Quiz Platform

A real-time quiz platform built for a college tech fest event, designed to handle large-scale participation with dynamic scoring, leaderboard control, and elimination based on performance and time.

## Overview

This project was used as the first round of a club event, where around 500 students participated simultaneously. The system supports team-based login, timed quizzes, automatic scoring, and a centralized dashboard for managing results and eliminations.

## Features

### Authentication

* Team-based login using Team ID and Registration Number
* Backend validation for secure access
* Session persistence using local storage

### Quiz System

* Timed quiz with automatic submission
* Dynamic question handling via JSON
* Score calculation based on correct answers
* Time tracking for tie-breaking

### Real-Time Performance Handling

* Efficient handling of ~500 concurrent users
* Lightweight frontend for smooth performance
* Optimized backend API calls

### Leaderboard & Elimination

* Admin-controlled dashboard for leaderboard
* Ranking based on score and time taken
* Elimination logic for advancing participants

### UI/UX

* Interactive login screen with animations
* Dice and board-themed visuals (Snakes and Ladders concept)
* Submission confirmation screen with performance feedback
* Responsive design for different screen sizes

### Result Handling

* Score percentage evaluation
* Performance-based feedback (e.g., Quiz Master, Excellent, etc.)
* Time taken display
* Clean session reset after completion

## Tech Stack

### Frontend

* HTML5
* CSS3 (custom animations, gradients, responsive layout)
* Vanilla JavaScript

### Backend

* Node.js
* Express.js

### Data Handling

* JSON-based storage (questions, teams, scores)

### Deployment

* Vercel (frontend + backend hosting)

### Additional Libraries

* Canvas Confetti (for submission feedback visuals)

## Project Structure

```
/api              # Backend endpoints
/public           # Static assets
index.html        # Login page
quiz.html         # Quiz interface
results.html      # Submission/result page
questions.json    # Question bank
teams.json        # Team credentials
scores.json       # Score tracking
vercel.json       # Deployment config
```

## How It Works

1. Teams log in using credentials.
2. Quiz starts with a timer.
3. Answers are submitted and evaluated.
4. Score and time are stored.
5. Admin dashboard processes leaderboard and eliminations.
6. Participants see submission confirmation and performance summary.

## Scalability Considerations

* Minimal frontend dependencies to reduce load time
* Stateless API design for better concurrency handling
* JSON-based lightweight data storage for quick reads/writes
* Suitable for short-duration, high-traffic events

## Use Case

* College tech fests
* Club recruitment rounds
* Competitive quizzes with elimination stages
* Large-scale classroom assessments

## Future Improvements

* Database integration (MongoDB / PostgreSQL)
* WebSocket-based real-time leaderboard
* Admin UI for live monitoring
* Authentication tokens instead of local storage
* Analytics dashboard for performance insights

