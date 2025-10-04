# Quiz Website Deployment Guide

## Vercel Deployment Instructions

Your quiz website has been configured for Vercel deployment. Here's how to deploy it:

### 1. Environment Variables Setup

Create a `.env` file in your project root with team credentials:

```env
# Team Credentials for Quiz Login
# Format: TEAM_<teamId>=<registrationNumber>
TEAM_team-1=REG123456
TEAM_team-2=REG789012
TEAM_team-3=REG345678
TEAM_team-4=REG901234
TEAM_team-5=REG567890
```

### 2. Deploy to Vercel

#### Option A: Using Vercel CLI
1. Install Vercel CLI: `npm i -g vercel`
2. Run: `vercel`
3. Follow the prompts to link your project
4. Add environment variables in Vercel dashboard

#### Option B: Using Vercel Dashboard
1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Import your GitHub repository
4. Add environment variables in project settings
5. Deploy

### 3. Environment Variables in Vercel

In your Vercel project dashboard:
1. Go to Settings → Environment Variables
2. Add each team credential as a separate variable:
   - Name: `TEAM_team-1`, Value: `REG123456`
   - Name: `TEAM_team-2`, Value: `REG789012`
   - etc.

### 4. Important Notes

- **Team Login**: Teams log in using their Team ID (e.g., "team-1") and Registration Number
- **Security**: The quiz has anti-cheating measures including fullscreen mode and tab-switching detection
- **Data Storage**: Quiz scores are stored in memory (resets on server restart)
- **Questions**: Edit `questions.json` to modify quiz content

### 5. File Structure

```
├── api/
│   └── index.js       # Main serverless function
├── package.json       # Dependencies and scripts
├── vercel.json        # Vercel configuration
├── login.html         # Login page
├── quiz.html          # Quiz interface
├── results.html       # Results page
├── questions.json     # Quiz questions
└── teams.json         # Team data (if needed)
```

### 6. Testing

After deployment:
1. Visit your Vercel URL
2. Try logging in with team credentials
3. Complete a test quiz
4. Verify results submission

### 7. Customization

- **Questions**: Edit `questions.json` to add/modify questions
- **Styling**: Modify CSS in HTML files
- **Team Credentials**: Update environment variables in Vercel
- **Quiz Duration**: Modify timer in `quiz.html` (currently 5 minutes)

Your quiz website is now ready for production deployment on Vercel!
