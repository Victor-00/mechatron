// server.js — Vercel-compatible Express server
require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// --- In-memory set to track logged-in teams ---
const loggedInTeams = new Set();

// --- Serve static files (login.html, quiz.html, results.html, etc.) ---
app.use(express.static(path.join(__dirname, 'public')));

// --- LOGIN ENDPOINT ---
app.post('/login', (req, res) => {
  try {
    const { teamId, regNum } = req.body;

    // 1. Check if already logged in
    if (loggedInTeams.has(teamId)) {
      return res.json({ success: false, message: 'This team has already logged in.' });
    }

    // 2. Check against .env credentials
    const envKey = `TEAM_${teamId}`;
    const expectedPassword = process.env[envKey];

    // 3. Validate
    if (expectedPassword && expectedPassword === regNum) {
      loggedInTeams.add(teamId);
      return res.json({ success: true, message: 'Login successful!' });
    } else {
      return res.json({ success: false, message: 'Invalid credentials.' });
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(400).json({ success: false, message: 'Invalid request format.' });
  }
});

// --- GET QUESTIONS ---
app.get('/questions', (req, res) => {
  const questionsPath = path.join(__dirname, 'questions.json');
  fs.readFile(questionsPath, 'utf8', (err, data) => {
    if (err) {
      res.status(500).json({ success: false, message: 'Failed to load questions.' });
    } else {
      res.type('application/json').send(data);
    }
  });
});

// --- SUBMIT QUIZ RESULTS ---
app.post('/submit-quiz', (req, res) => {
  try {
    const quizResult = req.body;
    const scoresPath = path.join(__dirname, 'scores.json');

    let scores = [];
    if (fs.existsSync(scoresPath)) {
      const fileData = fs.readFileSync(scoresPath, 'utf8');
      if (fileData) scores = JSON.parse(fileData);
    }

    scores.push(quizResult);
    fs.writeFileSync(scoresPath, JSON.stringify(scores, null, 2));

    res.json({ success: true, message: 'Quiz submitted successfully!' });
  } catch (error) {
    console.error('Failed to save score:', error);
    res.status(500).json({ success: false, message: 'Failed to save score.' });
  }
});

// --- DEFAULT FALLBACK ---
app.use((req, res) => {
  res.status(404).send('Not Found');
});

// --- Export app for Vercel ---
module.exports = app;

