// server.js (Complete and Updated Version)

// Load credentials from .env into process.env
require('dotenv').config();

const http = require('http');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

// This in-memory 'Set' will track logged-in teams.
// It resets whenever the server restarts.
const loggedInTeams = new Set();

// Create a function to handle requests
const handleRequest = (req, res) => {
    // Enable CORS for all routes
    const corsMiddleware = cors();
    corsMiddleware(req, res, () => {

        // --- SERVE HTML PAGES ---
        if (req.method === 'GET' && (req.url === '/' || req.url === '/login.html')) {
            const loginPath = path.join(__dirname, 'login.html');
            fs.readFile(loginPath, 'utf8', (err, data) => {
                if (err) {
                    res.writeHead(500, { 'Content-Type': 'text/plain' });
                    res.end('Internal Server Error');
                } else {
                    res.writeHead(200, { 'Content-Type': 'text/html' });
                    res.end(data);
                }
            });
        } else if (req.method === 'GET' && req.url === '/quiz.html') {
            const quizPath = path.join(__dirname, 'quiz.html');
            fs.readFile(quizPath, 'utf8', (err, data) => {
                if (err) {
                    res.writeHead(500, { 'Content-Type': 'text/plain' });
                    res.end('Internal Server Error');
                } else {
                    res.writeHead(200, { 'Content-Type': 'text/html' });
                    res.end(data);
                }
            });
        } else if (req.method === 'GET' && req.url === '/results.html') {
            const resultsPath = path.join(__dirname, 'results.html');
            fs.readFile(resultsPath, 'utf8', (err, data) => {
                if (err) {
                    res.writeHead(500, { 'Content-Type': 'text/plain' });
                    res.end('Internal Server Error');
                } else {
                    res.writeHead(200, { 'Content-Type': 'text/html' });
                    res.end(data);
                }
            });

        // --- NEW LOGIN LOGIC ---
        } else if (req.method === 'POST' && req.url === '/login') {
            let body = '';
            req.on('data', chunk => {
                body += chunk.toString();
            });
            req.on('end', () => {
                try {
                    const { teamId, regNum } = JSON.parse(body);

                    // 1. Check if this team is already logged in
                    if (loggedInTeams.has(teamId)) {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        return res.end(JSON.stringify({ success: false, message: 'This team has already logged in.' }));
                    }

                    // 2. Build the key and check credentials against the .env file
                    const envKey = `TEAM_${teamId}`;
                    const expectedPassword = process.env[envKey];

                    // 3. Validate credentials
                    if (expectedPassword && expectedPassword === regNum) {
                        // Success! Add team to our logged-in list and send success response.
                        loggedInTeams.add(teamId);
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: true, message: 'Login successful!' }));
                    } else {
                        // Failure. Send invalid credentials response.
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, message: 'Invalid credentials.' }));
                    }
                } catch (error) {
                    console.error("Login error:", error);
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, message: 'Invalid request format.' }));
                }
            });

        // --- SERVE QUESTIONS.JSON ---
        } else if (req.method === 'GET' && req.url === '/questions') {
            const questionsPath = path.join(__dirname, 'questions.json');
            fs.readFile(questionsPath, 'utf8', (err, data) => {
                if (err) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, message: 'Failed to load questions.' }));
                } else {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(data);
                }
            });

        // --- HANDLE QUIZ SUBMISSION ---
        } else if (req.method === 'POST' && req.url === '/submit-quiz') {
            let body = '';
            req.on('data', chunk => {
                body += chunk.toString();
            });
            req.on('end', () => {
                try {
                    const quizResult = JSON.parse(body);
                    const scoresPath = path.join(__dirname, 'scores.json');
                    
                    let scores = [];
                    if (fs.existsSync(scoresPath)) {
                        const fileData = fs.readFileSync(scoresPath, 'utf8');
                        if (fileData) { scores = JSON.parse(fileData); }
                    }
                    
                    scores.push(quizResult);
                    fs.writeFileSync(scoresPath, JSON.stringify(scores, null, 2));

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, message: 'Quiz submitted successfully!' }));
                } catch (error) {
                    console.error('Failed to write score:', error);
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, message: 'Failed to save score.' }));
                }
            });

        // --- HANDLE NOT FOUND ---
        } else {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Not Found');
        }
    });
};

const server = http.createServer(handleRequest);

const PORT = 3000;
server.listen(PORT, '127.0.0.1', () => {
    console.log(`✅ Server is running at http://127.0.0.1:${PORT}/`);
});