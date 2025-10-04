const http = require('http');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

// Read the team data from the JSON file
const teamsFilePath = path.join(__dirname, 'teams.json');
let teams = JSON.parse(fs.readFileSync(teamsFilePath, 'utf8'));

// Create a function to handle requests with CORS enabled
const handleRequest = (req, res) => {
    const corsMiddleware = cors();
    corsMiddleware(req, res, () => {
        // Serve login.html, quiz.html, or results.html
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
        } else if (req.method === 'POST' && req.url === '/login') {
            // --- MODIFIED LOGIN LOGIC ---
            let body = '';
            req.on('data', chunk => {
                body += chunk.toString();
            });
            req.on('end', () => {
                try {
                    const { teamId, regNum } = JSON.parse(body);
                    const user = teams.find(team => team.teamId === teamId && team.regNum === regNum);

                    
                    if (!user) {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        return res.end(JSON.stringify({ success: false, message: 'Invalid credentials.' }));
                    }

                    
                    if (user.logged === true) {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        return res.end(JSON.stringify({ success: false, message: 'This team has already logged in.' }));
                    }

                    
                    user.logged = true; 
                    fs.writeFileSync(teamsFilePath, JSON.stringify(teams, null, 2)); 

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, message: 'Login successful!' }));
                    
                } catch (error) {
                    console.error("Login error:", error);
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, message: 'Invalid request format.' }));
                }
            });
          
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
        } else {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Not Found');
        }
    });
};

const server = http.createServer(handleRequest);

const PORT = 3000;
server.listen(PORT, '172.23.221.241', () => {
    console.log(`Server running at http://172.23.221.241:${PORT}/`);
});
