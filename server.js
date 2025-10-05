const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const LOGIN_TRACKER_PATH = path.join(__dirname, 'login_tracker.json');
const SCORES_PATH = path.join(__dirname, 'public', 'scores.json');
const CONFIG_PATH = path.join(__dirname, 'quiz_config.json');

let resultsPublished = false;

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
      const initialData = { loggedInTeams: [] };
      fs.writeFileSync(LOGIN_TRACKER_PATH, JSON.stringify(initialData, null, 2));
      console.log('Login tracker file created');
    }
  } catch (error) {
    console.error('Error initializing login tracker:', error);
  }
}

function initializeQuizConfig() {
  try {
    if (!fs.existsSync(CONFIG_PATH)) {
      const initialConfig = { currentLevel: 1 };
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(initialConfig, null, 2));
      console.log('Quiz config file created');
    }
  } catch (error) {
    console.error('Error initializing quiz config:', error);
  }
}

function readQuizConfig() {
  try {
    if (!fs.existsSync(CONFIG_PATH)) {
      initializeQuizConfig();
    }
    const data = fs.readFileSync(CONFIG_PATH, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading quiz config:', error);
    return { currentLevel: 1 };
  }
}

function writeQuizConfig(config) {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
    return true;
  } catch (error) {
    console.error('Error writing quiz config:', error);
    return false;
  }
}

function readLoginTracker() {
  try {
    if (!fs.existsSync(LOGIN_TRACKER_PATH)) {
      initializeLoginTracker();
    }
    const data = fs.readFileSync(LOGIN_TRACKER_PATH, 'utf8');
    return JSON.parse(data);
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
  const tracker = readLoginTracker();
  return tracker.loggedInTeams.some(team => team.teamId === teamId);
}

function getSetForTeam(level, regNum) {
  // Extract last digit from registration number
  const lastDigit = parseInt(String(regNum).slice(-1));
  const isEven = lastDigit % 2 === 0;
  
  // Even = A, Odd = B
  const subset = isEven ? 'A' : 'B';
  return `${level}${subset}`;
}

function markTeamAsLoggedIn(teamId, questionSet) {
  try {
    const tracker = readLoginTracker();
    
    if (!tracker.loggedInTeams.some(team => team.teamId === teamId)) {
      tracker.loggedInTeams.push({
        teamId: teamId,
        loginTime: new Date().toISOString(),
        timestamp: Date.now(),
        marks: 0,
        endTime: null,
        questionSet: questionSet
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

app.get('/health', (req, res) => {
  res.json({ 
    status: 'Server is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

app.get('/api/logged-teams', (req, res) => {
  try {
    console.log('API call to /api/logged-teams');
    const tracker = readLoginTracker();
    res.setHeader('Content-Type', 'application/json');
    res.json({
      success: true,
      loggedInTeams: tracker.loggedInTeams || []
    });
  } catch (error) {
    console.error('Error fetching logged teams:', error);
    res.setHeader('Content-Type', 'application/json');
    res.status(500).json({
      success: false,
      message: 'Error fetching logged in teams',
      error: error.message
    });
  }
});

app.get('/api/quiz-config', (req, res) => {
  try {
    const config = readQuizConfig();
    res.json({
      success: true,
      currentLevel: config.currentLevel || 1
    });
  } catch (error) {
    console.error('Error fetching quiz config:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching quiz config'
    });
  }
});

app.post('/admin/set-level', (req, res) => {
  const { level } = req.body;
  
  if (!level || level < 1 || level > 6) {
    return res.status(400).json({
      success: false,
      message: 'Invalid level. Must be between 1 and 6.'
    });
  }
  
  try {
    const config = { currentLevel: level };
    if (writeQuizConfig(config)) {
      console.log(`Quiz level set to ${level}`);
      res.json({
        success: true,
        message: `Level set to ${level}`,
        currentLevel: level
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Error updating level'
      });
    }
  } catch (error) {
    console.error('Error setting level:', error);
    res.status(500).json({
      success: false,
      message: 'Error setting level'
    });
  }
});

app.post('/login', (req, res) => {
  const { teamId, regNum } = req.body;
  
  if (!teamId || !regNum) {
    return res.json({
      success: false,
      message: 'Team ID and Registration Number are required'
    });
  }
  
  console.log(`Login attempt - Team ID: ${teamId}, RegNum: ${regNum}`);
  
  if (isTeamLoggedIn(teamId)) {
    console.log(`Team ${teamId} has already logged in`);
    return res.json({
      success: false,
      message: 'This team has already logged in. Each team can only login once.'
    });
  }
  
  const teams = getTeamsFromEnv();
  
  if (teams[teamId] && teams[teamId] === regNum) {
    // Get current level from config
    const config = readQuizConfig();
    const currentLevel = config.currentLevel || 1;
    
    // Determine set based on level and registration number
    const questionSet = getSetForTeam(currentLevel, regNum);
    
    if (markTeamAsLoggedIn(teamId, questionSet)) {
      console.log(`Login successful for team ${teamId}, assigned set ${questionSet}`);
      return res.json({
        success: true,
        message: 'Login successful',
        teamId: teamId,
        questionSet: questionSet
      });
    } else {
      return res.json({
        success: false,
        message: 'Error updating login status. Please try again.'
      });
    }
  } else {
    console.log(`Invalid credentials for team ${teamId}`);
    return res.json({
      success: false,
      message: 'Invalid Team ID or Registration Number'
    });
  }
});

app.post('/submit-quiz', (req, res) => {
  try {
    const submissionData = req.body;
    console.log('Quiz submission received:', submissionData);
    
    let scores = [];
    if (fs.existsSync(SCORES_PATH)) {
      const scoresData = fs.readFileSync(SCORES_PATH, 'utf8');
      scores = JSON.parse(scoresData);
    }
    
    scores.push(submissionData);
    fs.writeFileSync(SCORES_PATH, JSON.stringify(scores, null, 2));
    
    const tracker = readLoginTracker();
    const teamIndex = tracker.loggedInTeams.findIndex(team => team.teamId === submissionData.teamId);
    
    if (teamIndex !== -1) {
      tracker.loggedInTeams[teamIndex].marks = submissionData.score || 0;
      tracker.loggedInTeams[teamIndex].endTime = new Date().toISOString();
      writeLoginTracker(tracker);
      console.log(`Updated tracker for team ${submissionData.teamId}: marks=${submissionData.score}`);
    }
    
    res.json({
      success: true,
      message: 'Quiz submitted successfully'
    });
  } catch (error) {
    console.error('Error submitting quiz:', error);
    res.status(500).json({
      success: false,
      message: 'Error submitting quiz'
    });
  }
});

app.get('/api/results-status', (req, res) => {
  res.json({ published: resultsPublished });
});

// ============================================
// ADMIN ROUTES
// ============================================

app.get('/admin/logged-teams', (req, res) => {
  console.log('Admin API call to /admin/logged-teams');
  const tracker = readLoginTracker();
  res.json({
    success: true,
    totalLoggedIn: tracker.loggedInTeams.length,
    teams: tracker.loggedInTeams
  });
});

app.post('/admin/reset-logins', (req, res) => {
  const resetData = { loggedInTeams: [] };
  if (writeLoginTracker(resetData)) {
    resultsPublished = false;
    console.log('All logins and published status have been reset.');
    res.json({
      success: true,
      message: 'Login tracker reset successfully'
    });
  } else {
    res.status(500).json({
      success: false,
      message: 'Error resetting login tracker'
    });
  }
});

app.post('/admin/remove-team', (req, res) => {
  const { teamId } = req.body;
  
  if (!teamId) {
    return res.status(400).json({
      success: false,
      message: 'Team ID is required'
    });
  }
  
  try {
    const tracker = readLoginTracker();
    const initialLength = tracker.loggedInTeams.length;
    
    tracker.loggedInTeams = tracker.loggedInTeams.filter(team => team.teamId !== teamId);
    
    if (tracker.loggedInTeams.length < initialLength) {
      if (writeLoginTracker(tracker)) {
        res.json({
          success: true,
          message: `Team ${teamId} removed successfully`
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Error updating login tracker'
        });
      }
    } else {
      res.json({
        success: false,
        message: 'Team not found'
      });
    }
  } catch (error) {
    console.error('Error removing team:', error);
    res.status(500).json({
      success: false,
      message: 'Error removing team'
    });
  }
});

app.post('/admin/publish-results', (req, res) => {
  resultsPublished = true;
  console.log('Results have been published. Users will now be redirected.');
  res.json({ success: true, message: 'Results published.' });
});

// ============================================
// STATIC FILES
// ============================================

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('*', (req, res) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/admin/') || req.path.startsWith('/login') || req.path.startsWith('/submit-quiz')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  
  const filePath = path.join(__dirname, 'public', req.path);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    res.sendFile(filePath);
  } else {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
  }
});

initializeLoginTracker();
initializeQuizConfig();

const teams = getTeamsFromEnv();
console.log(`Loaded ${Object.keys(teams).length} teams from environment variables`);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Login tracker file: ${LOGIN_TRACKER_PATH}`);
  console.log(`Quiz config file: ${CONFIG_PATH}`);
});