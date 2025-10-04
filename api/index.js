// api/index.js - Main API handler for Vercel

// Load credentials from .env into process.env
require('dotenv').config();

const fs = require('fs');
const path = require('path');

// This in-memory 'Set' will track logged-in teams.
// It resets whenever the serverless function restarts.
const loggedInTeams = new Set();

// Helper function to parse request body
const parseBody = (req) => {
    return new Promise((resolve) => {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            try {
                resolve(JSON.parse(body));
            } catch (error) {
                resolve(null);
            }
        });
    });
};

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
        // Get the path from the request
        const url = new URL(req.url, `http://${req.headers.host}`);
        const pathname = url.pathname;

        // --- SERVE HTML PAGES ---
        if (req.method === 'GET' && (pathname === '/' || pathname === '/login.html')) {
            try {
                const loginPath = path.join(process.cwd(), 'login.html');
                const data = fs.readFileSync(loginPath, 'utf8');
                res.setHeader('Content-Type', 'text/html');
                res.status(200).send(data);
                return;
            } catch (error) {
                console.error('Error serving login page:', error);
                res.status(500).send('Error loading login page');
                return;
            }
        } 
        
        if (req.method === 'GET' && pathname === '/quiz.html') {
            try {
                const quizPath = path.join(process.cwd(), 'quiz.html');
                const data = fs.readFileSync(quizPath, 'utf8');
                res.setHeader('Content-Type', 'text/html');
                res.status(200).send(data);
                return;
            } catch (error) {
                console.error('Error serving quiz page:', error);
                res.status(500).send('Error loading quiz page');
                return;
            }
        } 
        
        if (req.method === 'GET' && pathname === '/results.html') {
            try {
                const resultsPath = path.join(process.cwd(), 'results.html');
                const data = fs.readFileSync(resultsPath, 'utf8');
                res.setHeader('Content-Type', 'text/html');
                res.status(200).send(data);
                return;
            } catch (error) {
                console.error('Error serving results page:', error);
                res.status(500).send('Error loading results page');
                return;
            }
        }

        // --- LOGIN LOGIC ---
        if (req.method === 'POST' && pathname === '/login') {
            try {
                const body = await parseBody(req);
                if (!body) {
                    res.setHeader('Content-Type', 'application/json');
                    res.status(400).json({ success: false, message: 'Invalid request format.' });
                    return;
                }

                const { teamId, regNum } = body;

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
        if (req.method === 'GET' && pathname === '/questions') {
            try {
                const questionsPath = path.join(process.cwd(), 'questions.json');
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
        if (req.method === 'POST' && pathname === '/submit-quiz') {
            try {
                const body = await parseBody(req);
                if (!body) {
                    res.setHeader('Content-Type', 'application/json');
                    res.status(400).json({ success: false, message: 'Invalid request format.' });
                    return;
                }

                const quizResult = body;
                
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
