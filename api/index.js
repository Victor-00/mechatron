// api/index.js - HTML page server for Vercel

const fs = require('fs');
const path = require('path');

// Vercel serverless function handler for HTML pages
module.exports = async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    try {
        // Get the path from the request
        const url = new URL(req.url, http://${req.headers.host});
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

        // --- HANDLE NOT FOUND ---
        res.status(404).send('Not Found');
        
    } catch (error) {
        console.error('Server error:', error);
        res.status(500).send('Internal Server Error');
    }
};
