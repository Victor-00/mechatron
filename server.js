// Replace the existing admin endpoints in server.js with these:

// Admin endpoint - View logged teams (NO PASSWORD REQUIRED)
app.get('/admin/logged-teams', (req, res) => {
  const tracker = readLoginTracker();
  res.json({
    success: true,
    totalLoggedIn: tracker.loggedInTeams.length,
    teams: tracker.loggedInTeams
  });
});

// Admin endpoint - Reset login tracker (NO PASSWORD REQUIRED)
app.post('/admin/reset-logins', (req, res) => {
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

// Admin endpoint - Remove specific team (NEW ENDPOINT)
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
