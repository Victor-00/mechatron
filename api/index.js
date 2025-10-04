// api/index.js - Main API handler for Vercel

// Load credentials from .env into process.env
require('dotenv').config();

const fs = require('fs');
const path = require('path');

// This in-memory 'Set' will track logged-in teams.
// It resets whenever the serverless function restarts.
const loggedInTeams = new Set();

// Vercel serverless function handler
module.exports = async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    try {
        // --- SERVE HTML PAGES ---
        if (req.method === 'GET' && (req.url === '/' || req.url === '/login.html')) {
            const loginPath = path.join(__dirname, '..', 'login.html');
            const data = fs.readFileSync(loginPath, 'utf8');
            res.setHeader('Content-Type', 'text/html');
            res.status(200).send(data);
            return;
        } 
        
        if (req.method === 'GET' && req.url === '/quiz.html') {
            const quizPath = path.join(__dirname, '..', 'quiz.html');
            const data = fs.readFileSync(quizPath, 'utf8');
            res.setHeader('Content-Type', 'text/html');
            res.status(200).send(data);
            return;
        } 
        
        if (req.method === 'GET' && req.url === '/results.html') {
            const resultsPath = path.join(__dirname, '..', 'results.html');
            const data = fs.readFileSync(resultsPath, 'utf8');
            res.setHeader('Content-Type', 'text/html');
            res.status(200).send(data);
            return;
        }

        // --- LOGIN LOGIC ---
        if (req.method === 'POST' && req.url === '/login') {
            try {
                const { teamId, regNum } = req.body;

                // 1. Check if this team is already logged in
                if (loggedInTeams.has(teamId)) {
                    res.setHeader('Content-Type', 'application/json');
                    res.status(200).json({ success: false, message: 'This team has already logged in.' });
                    return;
                }

                // 2. Build the key and check credentials against the .env file
                const envKey = `TEAM_${teamId}`;
                const expectedPassword = process.env[envKey];

                // 3. Validate credentials
                if (expectedPassword && expectedPassword === regNum) {
                    // Success! Add team to our logged-in list and send success response.
                    loggedInTeams.add(teamId);
                    res.setHeader('Content-Type', 'application/json');
                    res.status(200).json({ success: true, message: 'Login successful!' });
                    return;
                } else {
                    // Failure. Send invalid credentials response.
                    res.setHeader('Content-Type', 'application/json');
                    res.status(200).json({ success: false, message: 'Invalid credentials.' });
                    return;
                }
            } catch (error) {
                console.error("Login error:", error);
                res.setHeader('Content-Type', 'application/json');
                res.status(400).json({ success: false, message: 'Invalid request format.' });
                return;
            }
        }

        // --- SERVE QUESTIONS.JSON ---
        if (req.method === 'GET' && req.url === '/questions') {
            try {
                const questionsPath = path.join(__dirname, '..', 'questions.json');
                const data = fs.readFileSync(questionsPath, 'utf8');
                res.setHeader('Content-Type', 'application/json');
                res.status(200).send(data);
                return;
            } catch (error) {
                console.error("Questions error:", error);
                res.setHeader('Content-Type', 'application/json');
                res.status(500).json({ success: false, message: 'Failed to load questions.' });
                return;
            }
        }

        // --- HANDLE QUIZ SUBMISSION ---
        if (req.method === 'POST' && req.url === '/submit-quiz') {
            try {
                const quizResult = req.body;
                
                // For Vercel, we'll store scores in memory for now
                // In production, you might want to use a database
                if (!global.quizScores) {
                    global.quizScores = [];
                }
                
                global.quizScores.push(quizResult);
                
                res.setHeader('Content-Type', 'application/json');
                res.status(200).json({ success: true, message: 'Quiz submitted successfully!' });
                return;
            } catch (error) {
                console.error('Failed to save score:', error);
                res.setHeader('Content-Type', 'application/json');
                res.status(500).json({ success: false, message: 'Failed to save score.' });
                return;
            }
        }

        // --- HANDLE NOT FOUND ---
        res.status(404).send('Not Found');
        
    } catch (error) {
        console.error('Server error:', error);
        res.status(500).send('Internal Server Error');
    }
};
