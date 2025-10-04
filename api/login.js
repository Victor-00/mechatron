// api/login.js - Login endpoint

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

module.exports = async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        res.status(405).json({ success: false, message: 'Method not allowed' });
        return;
    }

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
};
