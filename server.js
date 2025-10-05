const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const LOGIN_TRACKER_PATH = path.join(__dirname, 'login_tracker.json');
const DATA_PATH = path.join(__dirname, 'data');

// CORS configuration for production
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

// Function to read credentials from environment variables
function getCredentials() {
  const credentials = {};
  
  Object.keys(process.env).forEach(key => {
    if (key.startsWith('TEAM_')) {
      credentials[key] = process.env[key];
    }
  });
  
  return credentials;
}

// Function to initialize login tracker file
function initializeLoginTracker() {
  if (!fs.existsSync(LOGIN_TRACKER_PATH)) {
    fs.writeFileSync(LOGIN_TRACKER_PATH, JSON.stringify({ loggedInTeams: [] }, null, 2));
    console.log('Login tracker file created');
  }
}

// Function to read login tracker
function readLoginTracker() {
  try {
    const data = fs.readFileSync(LOGIN_TRACKER_PATH, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading login tracker:', error);
    return { loggedInTeams: [] };
  }
}

// Function to check if team has already logged in
function isTeamLoggedIn(teamKey) {
  const tracker = readLoginTracker();
  return tracker.loggedInTeams.includes(teamKey);
}

// Function to mark team as logged in
function markTeamAsLoggedIn(teamKey) {
  try {
    const tracker = readLoginTracker();
    
    if (!tracker.loggedInTeams.includes(teamKey)) {
      tracker.loggedInTeams.push(teamKey);
      tracker[teamKey] = {
        loginTime: new Date().toISOString(),
        timestamp: Date.now()
      };
      
      fs.writeFileSync(LOGIN_TRACKER_PATH, JSON.stringify(tracker, null, 2));
      console.log(`Team ${teamKey} marked as logged in`);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error marking team as logged in:', error);
    return false;
  }
}

// Rate limiting (simple implementation)
const loginAttempts = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_ATTEMPTS = 5;

function checkRateLimit(ip) {
  const now = Date.now();
  const attempts = loginAttempts.get(ip) || [];
  const recentAttempts = attempts.filter(time => now - time < RATE_LIMIT_WINDOW);
  
  if (recentAttempts.length >= MAX_ATTEMPTS) {
    return false;
  }
  
  recentAttempts.push(now);
  loginAttempts.set(ip, recentAttempts);
  return true;
}

// API Routes for data files
app.get('/api/questions', (req, res) => {
  const questionsPath = path.join(DATA_PATH, 'questions.json');
  if (fs.existsSync(questionsPath)) {
    res.sendFile(questionsPath);
  } else {
    res.status(404).json({ error: 'Questions file not found' });
  }
});

app.get('/api/teams', (req, res) => {
  const teamsPath = path.join(DATA_PATH, 'teams.json');
  if (fs.existsSync(teamsPath)) {
    res.sendFile(teamsPath);
  } else {
    res.status(404).json({ error: 'Teams file not found' });
  }
});

app.get('/api/scores', (req, res) => {
  const scoresPath = path.join(DATA_PATH, 'scores.json');
  if (fs.existsSync(scoresPath)) {
    res.sendFile(scoresPath);
  } else {
    res.status(404).json({ error: 'Scores file not found' });
  }
});

// Save scores endpoint
app.post('/api/scores', (req, res) => {
  try {
    const scoresPath = path.join(DATA_PATH, 'scores.json');
    const scores = req.body;
    
    // Ensure data directory exists
    if (!fs.existsSync(DATA_PATH)) {
      fs.mkdirSync(DATA_PATH, { recursive: true });
    }
    
    fs.writeFileSync(scoresPath, JSON.stringify(scores, null, 2));
    res.json({ success: true, message: 'Scores saved successfully' });
  } catch (error) {
    console.error('Error saving scores:', error);
    res.status(500).json({ success: false, message: 'Error saving scores' });
  }
});

// Login endpoint
app.post('/login', (req, res) => {
  const clientIp = req.ip || req.connection.remoteAddress;
  
  // Check rate limit
  if (!checkRateLimit(clientIp)) {
    return res.status(429).json({
      success: false,
      message: 'Too many login attempts. Please try again later.'
    });
  }
  
  const { teamId, regNum } = req.body;
  
  if (!teamId || !regNum) {
    return res.json({
      success: false,
      message: 'Team ID and Registration Number are required'
    });
  }
  
  // Format the team key to match environment variable format
  let teamKey = teamId.toUpperCase();
  if (!teamKey.startsWith('TEAM_')) {
    teamKey = 'TEAM_' + teamId.replace(/[^a-zA-Z0-9]/g, '');
  } else {
    teamKey = teamKey.replace(/[^a-zA-Z0-9_]/g, '_');
  }
  
  console.log(`Login attempt - Team Key: ${teamKey}`);
  
  // Check if team has already logged in
  if (isTeamLoggedIn(teamKey)) {
    console.log(`Team ${teamKey} has already logged in`);
    return res.json({
      success: false,
      message: 'This team has already logged in. Each team can only login once.'
    });
  }
  
  // Get credentials from environment variables
  const credentials = getCredentials();
  
  // Check if team exists and credentials match
  if (credentials[teamKey] === regNum) {
    if (markTeamAsLoggedIn(teamKey)) {
      console.log(`Login successful for team ${teamKey}`);
      return res.json({
        success: true,
        message: 'Login successful',
        teamId: teamKey
      });
    } else {
      return res.json({
        success: false,
        message: 'Error updating login status. Please try again.'
      });
    }
  } else {
    console.log(`Invalid credentials for team ${teamKey}`);
    return res.json({
      success: false,
      message: 'Invalid Team ID or Registration Number'
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

// Admin endpoint - SECURED with admin password
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
    teams: tracker.loggedInTeams,
    details: tracker
  });
});

// Serve index page for root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Catch-all route to serve frontend routes
app.get('*', (req, res) => {
  const filePath = path.join(__dirname, 'public', req.path);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    res.sendFile(filePath);
  } else {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
  }
});

// Initialize the login tracker on server start
initializeLoginTracker();

// Ensure data directory exists
if (!fs.existsSync(DATA_PATH)) {
  fs.mkdirSync(DATA_PATH, { recursive: true });
  console.log('Data directory created');
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Login tracker file: ${LOGIN_TRACKER_PATH}`);
  console.log(`Data directory: ${DATA_PATH}`);
  
  const credentials = getCredentials();
  console.log(`Loaded ${Object.keys(credentials).length} team credentials from environment`);
});
