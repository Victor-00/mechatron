const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const LOGIN_TRACKER_PATH = path.join(__dirname, 'login_tracker.json');
const SCORES_PATH = path.join(__dirname, 'public', 'scores.json');

// --- STATE VARIABLES ---
let resultsPublished = false;
let activeRound = 'round1';
let forceRedirectToLogin = false; // New state variable

// CORS configuration
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://mechatron.onrender.com', 'http://mechatron.onrender.com']
    : '*',
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json());

app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// ============================================
// HELPER FUNCTIONS
// ============================================
function getTeamsFromEnv() {
  const teams = {};
  Object.keys(process.env).forEach(key => {
    if (key.startsWith('TEAM_ID_')) {
      const teamId = key.replace('TEAM_ID_', '');
      teams[teamId] = process.env[key];
    }
  });
  return teams;
}

function initializeLoginTracker() {
  try {
    if (!fs.existsSync(LOGIN_TRACKER_PATH)) {
      fs.writeFileSync(LOGIN_TRACKER_PATH, JSON.stringify({ loggedInTeams: [] }, null, 2));
    }
  } catch (error) {
    console.error('Error initializing login tracker:', error);
  }
}

function readLoginTracker() {
  try {
    if (!fs.existsSync(LOGIN_TRACKER_PATH)) initializeLoginTracker();
    return JSON.parse(fs.readFileSync(LOGIN_TRACKER_PATH, 'utf8'));
  } catch (error) {
    console.error('Error reading login tracker:', error);
    return { loggedInTeams: [] };
  }
}

function writeLoginTracker(data) {
  try {
    fs.writeFileSync(LOGIN_TRACKER_PATH, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('Error writing login tracker:', error);
    return false;
  }
}

function isTeamLoggedIn(teamId) {
  return readLoginTracker().loggedInTeams.some(team => team.teamId === teamId);
}

function markTeamAsLoggedIn(teamId, regNum) {
  try {
    const tracker = readLoginTracker();
    if (!tracker.loggedInTeams.some(team => team.teamId === teamId)) {
      tracker.loggedInTeams.push({
        teamId,
        regNum,
        loginTime: new Date().toISOString(),
        timestamp: Date.now(),
        marks: 0,
        endTime: null
      });
      return writeLoginTracker(tracker);
    }
    return false;
  } catch (error) {
    console.error('Error marking team as logged in:', error);
    return false;
  }
}

// ============================================
// API ROUTES
// ============================================
app.get('/health', (req, res) => res.json({ status: 'Server is running', timestamp: new Date().toISOString() }));

app.get('/api/logged-teams', (req, res) => {
  try {
    res.json({ success: true, loggedInTeams: readLoginTracker().loggedInTeams || [] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching teams' });
  }
});

app.get('/api/status', (req, res) => {
    res.json({
        success: true,
        activeRound: activeRound,
        resultsPublished: resultsPublished
    });
});

app.get('/api/results-status', (req, res) => res.json({ published: resultsPublished }));

app.get('/api/redirect-status', (req, res) => res.json({ redirect: forceRedirectToLogin })); // New API endpoint

app.post('/login', (req, res) => {
  const { teamId, regNum } = req.body;
  if (!teamId || !regNum) return res.json({ success: false, message: 'Team ID and Reg Number are required' });
  if (isTeamLoggedIn(teamId)) return res.json({ success: false, message: 'This team has already logged in.' });
  
  const teams = getTeamsFromEnv();
  if (teams[teamId] && teams[teamId] === regNum) {
    if (markTeamAsLoggedIn(teamId, regNum)) {
      return res.json({ success: true, message: 'Login successful', teamId: teamId });
    }
    return res.json({ success: false, message: 'Error updating login status.' });
  }
  return res.json({ success: false, message: 'Invalid credentials' });
});

app.get('/questions/:teamId', (req, res) => {
    try {
        const { teamId } = req.params;
        const team = readLoginTracker().loggedInTeams.find(t => t.teamId === teamId);
        if (!team) return res.status(404).json({ error: 'Team not found or not logged in.' });

        const regNum = parseInt(team.regNum, 10);
        if (isNaN(regNum)) return res.status(400).json({ error: 'Invalid registration number.' });

        const questionSet = regNum % 2 === 0 ? 'a' : 'b';
        const questionFileName = `${activeRound}${questionSet}.json`;
        const questionsFilePath = path.join(__dirname, 'public', questionFileName);

        if (fs.existsSync(questionsFilePath)) {
            res.sendFile(questionsFilePath);
        } else {
            res.status(404).json({ error: `Questions file not found: ${questionFileName}` });
        }
    } catch (error) {
        res.status(500).json({ error: 'Server error while serving questions.' });
    }
});

app.post('/submit-quiz', (req, res) => {
  try {
    const submissionData = req.body;
    let scores = fs.existsSync(SCORES_PATH) ? JSON.parse(fs.readFileSync(SCORES_PATH, 'utf8')) : [];
    scores.push(submissionData);
    fs.writeFileSync(SCORES_PATH, JSON.stringify(scores, null, 2));

    const tracker = readLoginTracker();
    const teamIndex = tracker.loggedInTeams.findIndex(team => team.teamId === submissionData.teamId);
    if (teamIndex !== -1) {
      tracker.loggedInTeams[teamIndex].marks = submissionData.score || 0;
      tracker.loggedInTeams[teamIndex].endTime = new Date().toISOString();
      writeLoginTracker(tracker);
    }
    res.json({ success: true, message: 'Quiz submitted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error submitting quiz' });
  }
});

// ============================================
// ADMIN ROUTES
// ============================================

app.post('/admin/set-round', (req, res) => {
    const { round } = req.body;
    const validRounds = ['round1', 'round2', 'round3', 'round4', 'round5', 'round6'];
    if (!round || !validRounds.includes(round)) {
        return res.status(400).json({ success: false, message: 'Invalid round specified.' });
    }
    activeRound = round;
    res.json({ success: true, message: `Active round set to ${round}`, activeRound: activeRound });
});

app.post('/admin/publish-results', (req, res) => {
  resultsPublished = true;
  res.json({ success: true, message: 'Results published' });
});

app.post('/admin/force-redirect', (req, res) => { // New admin endpoint
  forceRedirectToLogin = true;
  res.json({ success: true, message: 'Force redirect activated.' });
});

app.post('/admin/reset-logins', (req, res) => {
  if (writeLoginTracker({ loggedInTeams: [] })) {
    resultsPublished = false;
    forceRedirectToLogin = false; // Reset the new state
    activeRound = 'round1';
    res.json({ success: true, message: 'Login tracker reset successfully' });
  } else {
    res.status(500).json({ success: false, message: 'Error resetting login tracker' });
  }
});

app.post('/admin/remove-teams-batch', (req, res) => {
    const { teamIds } = req.body;
    if (!teamIds || !Array.isArray(teamIds)) {
        return res.status(400).json({ success: false, message: 'Invalid request' });
    }
    try {
        const tracker = readLoginTracker();
        const initialLength = tracker.loggedInTeams.length;
        tracker.loggedInTeams = tracker.loggedInTeams.filter(team => !teamIds.includes(team.teamId));
        if (writeLoginTracker(tracker)) {
            res.json({ success: true, removedCount: initialLength - tracker.loggedInTeams.length });
        } else {
            res.status(500).json({ success: false, message: 'Error updating login tracker' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ============================================
// STATIC FILES & FINAL ROUTE
// ============================================

app.use(express.static(path.join(__dirname, 'public')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Initialize on server start
initializeLoginTracker();
console.log(`Loaded ${Object.keys(getTeamsFromEnv()).length} teams from env.`);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});

