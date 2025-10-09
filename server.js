const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const cookieParser = require('cookie-parser');
const excel = require('exceljs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const LOGIN_TRACKER_PATH = path.join(__dirname, 'login_tracker.json');
const SCORES_PATH = path.join(__dirname, 'public', 'scores.json');
const SELECTED_TEAMS_PATH = path.join(__dirname, 'public', 'selected_teams.json');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'password';

// --- STATE VARIABLES ---
let resultsPublished = false;
let activeRound = 'round1';
let forceRedirectToLogin = false;
let startQuizSignal = false;
let forceViewTarget = null;

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
app.use(cookieParser());

app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// ============================================
// HELPER & AUTH FUNCTIONS
// ============================================

const authMiddleware = (req, res, next) => {
    if (req.cookies.adminAuth === 'true') {
        next();
    } else {
        res.status(401).redirect('/admin_login.html');
    }
};

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
      console.log('Login tracker file created.');
    }
  } catch (error) {
    console.error('Error initializing login tracker:', error);
  }
}

function readJsonFile(filePath, defaultData) {
    try {
        if (!fs.existsSync(filePath)) {
            if(filePath === LOGIN_TRACKER_PATH) initializeLoginTracker();
            return defaultData;
        }
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (error) {
        console.error(`Error reading file ${filePath}:`, error);
        return defaultData;
    }
}

function writeJsonFile(filePath, data) {
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error(`Error writing file ${filePath}:`, error);
        return false;
    }
}

const readLoginTracker = () => readJsonFile(LOGIN_TRACKER_PATH, { loggedInTeams: [] });
const writeLoginTracker = (data) => writeJsonFile(LOGIN_TRACKER_PATH, data);
const isTeamLoggedIn = (teamId) => readLoginTracker().loggedInTeams.some(team => team.teamId === teamId);

function markTeamAsLoggedIn(teamId, regNum) {
    const tracker = readLoginTracker();
    if (!tracker.loggedInTeams.some(team => team.teamId === teamId)) {
      tracker.loggedInTeams.push({ teamId, regNum, loginTime: new Date().toISOString(), quizStartTime: null, marks: null, endTime: null, timeTaken: null, answers: [] });
      return writeLoginTracker(tracker);
    }
    return false;
}

function updateTeamLogin(teamId) {
    const tracker = readLoginTracker();
    const teamIndex = tracker.loggedInTeams.findIndex(team => team.teamId === teamId);
    if (teamIndex !== -1) {
      tracker.loggedInTeams[teamIndex].loginTime = new Date().toISOString();
      tracker.loggedInTeams[teamIndex].quizStartTime = null;
      tracker.loggedInTeams[teamIndex].marks = null;
      tracker.loggedInTeams[teamIndex].endTime = null;
      tracker.loggedInTeams[teamIndex].timeTaken = null;
      tracker.loggedInTeams[teamIndex].answers = [];
      return writeLoginTracker(tracker);
    }
    return false;
}

// ============================================
// PUBLIC API ROUTES
// ============================================
app.get('/health', (req, res) => res.json({ status: 'Server is running' }));
app.get('/api/logged-teams', (req, res) => res.json({ success: true, loggedInTeams: readLoginTracker().loggedInTeams || [] }));
app.get('/api/selected-teams', (req, res) => res.json(readJsonFile(SELECTED_TEAMS_PATH, { selectedTeams: [] })));
app.get('/api/status', (req, res) => res.json({ success: true, activeRound, resultsPublished }));
app.get('/api/results-status', (req, res) => res.json({ published: resultsPublished }));
app.get('/api/redirect-status', (req, res) => res.json({ redirect: forceRedirectToLogin }));
app.get('/api/start-quiz-status', (req, res) => res.json({ start: startQuizSignal }));
app.get('/api/view-status', (req, res) => res.json({ view: forceViewTarget }));

app.post('/api/live-update', (req, res) => {
    const { teamId, detailedAnswers } = req.body;
    if (!teamId || !detailedAnswers) {
        return res.status(400).json({ success: false, message: 'Invalid data.' });
    }
    const tracker = readLoginTracker();
    const teamIndex = tracker.loggedInTeams.findIndex(team => team.teamId === teamId);
    if (teamIndex !== -1) {
        tracker.loggedInTeams[teamIndex].answers = detailedAnswers;
        writeLoginTracker(tracker);
        return res.json({ success: true });
    }
    res.status(404).json({ success: false, message: 'Team not found.' });
});

app.post('/login', (req, res) => {
    const { teamId, regNum } = req.body;
    if (!teamId || !regNum) return res.json({ success: false, message: 'ID and Registration Number are required' });

    const teams = getTeamsFromEnv();
    const teamIdNumber = teamId.replace('TEAM_ID_', '');
    if (!teams[teamIdNumber] || teams[teamIdNumber] !== regNum) {
        return res.json({ success: false, message: 'Invalid Credentials' });
    }

    if (isTeamLoggedIn(teamId)) {
        const selectedData = readJsonFile(SELECTED_TEAMS_PATH, { selectedTeams: [] });
        const isSelected = selectedData.selectedTeams.includes(teamId);

        if (!isSelected) {
            return res.json({ success: false, message: 'This team has already participated.' });
        } else {
            return updateTeamLogin(teamId)
                ? res.json({ success: true, message: 'Login successful for next round.', teamId })
                : res.status(500).json({ success: false, message: 'Server error updating login.' });
        }
    } else {
        return markTeamAsLoggedIn(teamId, regNum)
            ? res.json({ success: true, message: 'Login successful', teamId })
            : res.status(500).json({ success: false, message: 'Server error recording login.' });
    }
});

app.get('/questions/:teamId', (req, res) => {
    // ... logic for serving questions remains the same
});

app.post('/submit-quiz', (req, res) => {
    const submissionData = req.body;
    const scores = readJsonFile(SCORES_PATH, []);
    scores.push(submissionData);
    writeJsonFile(SCORES_PATH, scores);

    const tracker = readLoginTracker();
    const teamIndex = tracker.loggedInTeams.findIndex(team => team.teamId === submissionData.teamId);
    if (teamIndex !== -1) {
      tracker.loggedInTeams[teamIndex].marks = submissionData.score || 0;
      tracker.loggedInTeams[teamIndex].endTime = new Date().toISOString();
      tracker.loggedInTeams[teamIndex].timeTaken = submissionData.timeTaken;
      tracker.loggedInTeams[teamIndex].answers = submissionData.detailedAnswers || [];
      tracker.loggedInTeams[teamIndex].quizStartTime = submissionData.quizStartTime;
      writeLoginTracker(tracker);
    }
    res.json({ success: true, message: 'Quiz submitted successfully' });
});

// ============================================
// ADMIN ROUTES
// ============================================

app.post('/admin/login', (req, res) => {
    const { password } = req.body;
    if (password === ADMIN_PASSWORD) {
        res.cookie('adminAuth', 'true', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', maxAge: 8 * 60 * 60 * 1000 });
        res.json({ success: true });
    } else {
        res.status(401).json({ success: false, message: 'Invalid password' });
    }
});

app.get('/admin.html', authMiddleware, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// ... other admin routes ...

// ============================================
// STATIC FILES & FINAL ROUTE
// ============================================

app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => {
  const htmlFiles = ['login.html', 'instructions.html', 'quiz.html', 'results.html', 'selection_status.html', 'admin_login.html'];
  const requestedFile = req.path.substring(1);
  if (htmlFiles.includes(requestedFile)) {
    return res.sendFile(path.join(__dirname, 'public', requestedFile));
  }
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Initialize on server start
initializeLoginTracker();
console.log(`Loaded ${Object.keys(getTeamsFromEnv()).length} teams from env.`);
app.listen(PORT, '0.0.0.0', () => console.log(`Server is running on port ${PORT}`));