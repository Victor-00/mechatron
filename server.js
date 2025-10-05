const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const LOGIN_TRACKER_PATH = path.join(__dirname, 'login_tracker.json');
const SCORES_PATH = path.join(__dirname, 'public', 'scores.json');
const QUESTIONS_PATH = path.join(__dirname, 'public', 'questions.json');

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

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// Load teams credentials from environment variables
function getTeamsFromEnv() {
  const teams = {};
  
  // Look for environment variables in format: TEAM_ID_<teamid>=<regNum>
  Object.keys(process.env).forEach(key => {
    if (key.startsWith('TEAM_ID_')) {
      const teamId = key.replace('TEAM_ID_', '');
      teams[teamId] = process.env[key];
    }
  });
  
  return teams;
}

// Initialize login tracker file
function initializeLoginTracker() {
  try {
    if (!fs.existsSync(LOGIN_TRACKER_PATH)) {
      const initialData = { loggedInTeams: [] };
      fs.writeFileSync(LOGIN_TRACKER_PATH, JSON.stringify(initialData, null, 2));
      console.log('Login tracker file created');
    } else {
      console.log('Login tracker file exists');
    }
  } catch (error) {
    console.error('Error initializing login tracker:', error);
  }
}

// Read login tracker
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

// Write login tracker
function writeLoginTracker(data) {
  try {
    fs.writeFileSync(LOGIN_TRACKER_PATH, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('Error writing login tracker:', error);
    return false;
  }
}

// Check if team has already logged in
function isTeamLoggedIn(teamId) {
  const tracker = readLoginTracker();
  return tracker.loggedInTeams.some(team => team.teamId === teamId);
}

// Mark team as logged in
function markTeamAsLoggedIn(teamId) {
  try {
    const tracker = readLoginTracker();
    
    if (!tracker.loggedInTeams.some(team => team.teamId === teamId)) {
      tracker.loggedInTeams.push({
        teamId: teamId,
        loginTime: new Date().toISOString(),
        timestamp: Date.now()
      });
      
      return writeLoginTracker(tracker);
    }
    return false;
  } catch (error) {
    console.error('Error marking team as logged in:', error);
    return false;
  }
}

// Rate limiting removed - users can have infinite login attempts

// Get logged in teams endpoint
app.get('/api/logged-teams', (req, res) => {
  try {
    const tracker = readLoginTracker();
    res.json({
      success: true,
      loggedInTeams: tracker.loggedInTeams || []
    });
  } catch (error) {
    console.error('Error fetching logged teams:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching logged in teams'
    });
  }
});

// Login endpoint
app.post('/login', (req, res) => {
  const { teamId, regNum } = req.body;
  
  if (!teamId || !regNum) {
    return res.json({
      success: false,
      message: 'Team ID and Registration Number are required'
    });
  }
  
  console.log(`Login attempt - Team ID: ${teamId}`);
  
  // Check if team has already logged in
  if (isTeamLoggedIn(teamId)) {
    console.log(`Team ${teamId} has already logged in`);
    return res.json({
      success: false,
      message: 'This team has already logged in. Each team can only login once.'
    });
  }
  
  // Get teams from environment variables
  const teams = getTeamsFromEnv();
  
  // Check if credentials match
  if (teams[teamId] && teams[teamId] === regNum) {
    if (markTeamAsLoggedIn(teamId)) {
      console.log(`Login successful for team ${teamId}`);
      return res.json({
        success: true,
        message: 'Login successful',
        teamId: teamId
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

// Questions endpoint
app.get('/questions', (req, res) => {
  try {
    if (fs.existsSync(QUESTIONS_PATH)) {
      res.sendFile(QUESTIONS_PATH);
    } else {
      res.status(404).json({ error: 'Questions file not found' });
    }
  } catch (error) {
    console.error('Error serving questions:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Submit quiz endpoint
app.post('/submit-quiz', (req, res) => {
  try {
    const submissionData = req.body;
    console.log('Quiz submission received:', submissionData);
    
    // Read existing scores
    let scores = [];
    if (fs.existsSync(SCORES_PATH)) {
      const scoresData = fs.readFileSync(SCORES_PATH, 'utf8');
      scores = JSON.parse(scoresData);
    }
    
    // Add new submission
    scores.push(submissionData);
    
    // Write back to file
    fs.writeFileSync(SCORES_PATH, JSON.stringify(scores, null, 2));
    
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

// Admin endpoint - View logged teams
app.get('/admin/logged-teams', (req, res) => {
  const adminPassword = req.headers['x-admin-password'] || req.query.password;
  
  if (adminPassword !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized access'
    });
  }
  
  const tracker = readLoginTracker();
  res.json({
    totalLoggedIn: tracker.loggedInTeams.length,
    teams: tracker.loggedInTeams
  });
});

// Admin endpoint - Reset login tracker
app.post('/admin/reset-logins', (req, res) => {
  const adminPassword = req.headers['x-admin-password'] || req.body.password;
  
  if (adminPassword !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized access'
    });
  }
  
  const resetData = { loggedInTeams: [] };
  if (writeLoginTracker(resetData)) {
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

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'Server is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Catch-all route
app.get('*', (req, res) => {
  const filePath = path.join(__dirname, 'public', req.path);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    res.sendFile(filePath);
  } else {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
  }
});

// Initialize on server start
initializeLoginTracker();

const teams = getTeamsFromEnv();
console.log(`Loaded ${Object.keys(teams).length} teams from environment variables`);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Login tracker file: ${LOGIN_TRACKER_PATH}`);
});
