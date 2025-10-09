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
    try {
        const { teamId } = req.params;
        const team = readLoginTracker().loggedInTeams.find(t => t.teamId === teamId);
        if (!team) return res.status(404).json({ error: 'Team not logged in.' });

        if (activeRound === 'round1') {
            const round1Path = path.join(__dirname, 'public', 'round1.json');
            const ss1Path = path.join(__dirname, 'public', 'SS1.json');

            if (fs.existsSync(round1Path) && fs.existsSync(ss1Path)) {
                const round1Data = readJsonFile(round1Path, {});
                const ss1Data = readJsonFile(ss1Path, {});
                
                const responseData = {
                    isSpecialRound: true,
                    storyData: ss1Data,
                    questionBlocks: round1Data.questions || [],
                    timeLimit: round1Data.timeLimit || 900
                };
                return res.json(responseData);
            } else {
                return res.status(404).json({ error: 'Required files for Round 1 (round1.json, SS1.json) are missing.' });
            }
        } else {
            const regNumStr = String(team.regNum);
            let digitToCheck;
            if (regNumStr.length >= 3) {
                digitToCheck = parseInt(regNumStr.charAt(regNumStr.length - 3), 10);
            } else {
                digitToCheck = parseInt(regNumStr.charAt(regNumStr.length - 1), 10);
            }
            
            if (isNaN(digitToCheck)) return res.status(400).json({ error: 'Invalid registration number.' });

            const questionSet = digitToCheck % 2 === 0 ? 'a' : 'b';
            const questionFileName = `${activeRound}${questionSet}.json`;
            const questionsFilePath = path.join(__dirname, 'public', questionFileName);

            if (fs.existsSync(questionsFilePath)) {
                res.sendFile(questionsFilePath);
            } else {
                res.status(404).json({ error: `Questions file not found: ${questionFileName}` });
            }
        }
    } catch (error) {
        console.error('Error serving questions:', error);
        res.status(500).json({ error: 'Server error while serving questions.' });
    }
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

// ... (rest of the admin routes and server setup remain the same)
// ============================================
// ADMIN ROUTES (Login and Protected)
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

app.get('/admin/export', authMiddleware, async (req, res) => {
    try {
        const tracker = readLoginTracker();
        const teams = tracker.loggedInTeams || [];

        teams.sort((a, b) => {
            if (b.marks !== a.marks) return b.marks - a.marks;
            const aTime = a.timeTaken || Infinity;
            const bTime = b.timeTaken || Infinity;
            return aTime - bTime;
        });

        const workbook = new excel.Workbook();
        const worksheet = workbook.addWorksheet('Team Report');

        worksheet.columns = [
            { header: 'Rank', key: 'rank', width: 10 },
            { header: 'Team ID', key: 'teamId', width: 20 },
            { header: 'Marks', key: 'marks', width: 15 },
            { header: 'Time Taken (s)', key: 'timeTaken', width: 20 },
            { header: 'Quiz Start Time', key: 'quizStartTime', width: 25 },
            { header: 'End Time', key: 'endTime', width: 25 },
        ];

        teams.forEach((team, index) => {
            worksheet.addRow({
                rank: index + 1,
                teamId: team.teamId,
                marks: team.marks !== null ? team.marks : 'N/A',
                timeTaken: team.timeTaken ? (team.timeTaken / 1000).toFixed(3) : 'N/A',
                quizStartTime: team.quizStartTime ? new Date(team.quizStartTime).toLocaleString() : 'N/A',
                endTime: team.endTime ? new Date(team.endTime).toLocaleString() : 'N/A',
            });
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="TeamReport.xlsx"');

        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error('Error exporting data:', error);
        res.status(500).send('Error generating Excel file');
    }
});

app.post('/admin/set-round', authMiddleware, (req, res) => {
    const { round } = req.body;
    const validRounds = ['round1', 'round2', 'round3', 'round4', 'round5', 'round6'];
    if (!round || !validRounds.includes(round)) {
        return res.status(400).json({ success: false, message: 'Invalid round.' });
    }
    activeRound = round;

    const selectedData = readJsonFile(SELECTED_TEAMS_PATH, { selectedTeams: [] });
    const tracker = readLoginTracker();
    
    let resetCount = 0;
    tracker.loggedInTeams.forEach(team => {
        if (selectedData.selectedTeams.includes(team.teamId)) {
            team.quizStartTime = null;
            team.marks = null;
            team.endTime = null;
            team.timeTaken = null;
            team.answers = [];
            resetCount++;
        }
    });

    if (writeLoginTracker(tracker)) {
        console.log(`Prepared next round (${round}) and reset ${resetCount} teams.`);
        res.json({ success: true, message: `Active round set to ${round}. Progress for ${resetCount} selected teams has been reset.`, activeRound });
    } else {
        res.status(500).json({ success: false, message: 'Error preparing next round.' });
    }
});

app.post('/admin/start-quiz', authMiddleware, (req, res) => {
  startQuizSignal = true;
  setTimeout(() => { startQuizSignal = false; }, 120000);
  res.json({ success: true, message: 'Quiz start signal sent.' });
});

app.post('/admin/publish-results', authMiddleware, (req, res) => {
  resultsPublished = true;
  setTimeout(() => { resultsPublished = false; }, 120000);
  res.json({ success: true, message: 'Results published' });
});

app.post('/admin/force-redirect', authMiddleware, (req, res) => {
  forceRedirectToLogin = true;
  setTimeout(() => { forceRedirectToLogin = false; }, 120000);
  res.json({ success: true, message: 'Force redirect activated.' });
});

app.post('/admin/finalize-selections', authMiddleware, (req, res) => {
    const { selectedTeams } = req.body;
    if (!selectedTeams || !Array.isArray(selectedTeams)) {
        return res.status(400).json({ success: false, message: 'Invalid data.' });
    }
    writeJsonFile(SELECTED_TEAMS_PATH, { selectedTeams });
    res.json({ success: true, message: 'Selections finalized.' });
});

app.post('/admin/reset-logins', authMiddleware, (req, res) => {
    writeLoginTracker({ loggedInTeams: [] });
    if (fs.existsSync(SELECTED_TEAMS_PATH)) {
        fs.unlinkSync(SELECTED_TEAMS_PATH);
    }
    resultsPublished = false;
    forceRedirectToLogin = false;
    startQuizSignal = false;
    activeRound = 'round1';
    res.json({ success: true, message: 'System reset successfully.' });
});

app.post('/admin/remove-teams-batch', authMiddleware, (req, res) => {
    const { teamIds } = req.body;
    if (!teamIds || !Array.isArray(teamIds)) return res.status(400).json({ success: false, message: 'Invalid request' });
    
    const tracker = readLoginTracker();
    const initialLength = tracker.loggedInTeams.length;
    tracker.loggedInTeams = tracker.loggedInTeams.filter(team => !teamIds.includes(team.teamId));
    writeLoginTracker(tracker);

    if (fs.existsSync(SELECTED_TEAMS_PATH)) {
        const selectedData = readJsonFile(SELECTED_TEAMS_PATH, { selectedTeams: [] });
        selectedData.selectedTeams = selectedData.selectedTeams.filter(id => !teamIds.includes(id));
        writeJsonFile(SELECTED_TEAMS_PATH, selectedData);
    }

    res.json({ success: true, removedCount: initialLength - tracker.loggedInTeams.length });
});

// ============================================
// STATIC FILES & FINAL ROUTE
// ============================================

app.use(express.static(path.join(__dirname, 'public')));
app.get('/admin.html', authMiddleware, (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));

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


