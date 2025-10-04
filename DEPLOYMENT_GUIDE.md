# Vercel Deployment Guide

## ✅ Fixed Issues

The following issues have been resolved:

1. **Removed dotenv usage** - No more `require('dotenv').config()` in API files
2. **Moved HTML files to /public** - Static files now served from `/public` folder
3. **Updated vercel.json** - Proper routing for static files and API endpoints
4. **Removed server.js dependency** - Pure serverless setup
5. **Fixed package.json main field** - Removed reference to deleted api/index.js
6. **Updated vercel.json builds** - Added explicit @vercel/node for API functions

## 🚀 Deployment Steps

### 1. Set Environment Variables in Vercel

Go to your Vercel Dashboard → Project Settings → Environment Variables and add:

```
TEAM_1=your_password_for_team_1
TEAM_2=your_password_for_team_2
TEAM_3=your_password_for_team_3
... (add as many teams as needed)
```

### 2. Deploy to Vercel

**Option A: Using Vercel Dashboard (Recommended)**
1. Push your changes to GitHub/GitLab
2. Go to Vercel Dashboard → Your Project
3. Click "Redeploy" to force a fresh deployment

**Option B: Using Vercel CLI**
```bash
# Install Vercel CLI if you haven't
npm i -g vercel

# Deploy with force to clear cache
vercel --prod --force
```

**Important:** Use `--force` flag to clear any cached deployments that might still reference the old server.js file.

## 📁 Project Structure

```
├── api/
│   ├── login.js          # Login endpoint
│   ├── questions.js      # Questions endpoint  
│   └── submit-quiz.js    # Quiz submission endpoint
├── public/
│   ├── login.html        # Login page
│   ├── quiz.html         # Quiz page
│   └── results.html      # Results page
├── questions.json        # Quiz questions data
├── teams.json           # Teams data
├── vercel.json          # Vercel configuration
└── package.json         # Dependencies
```

## 🔗 API Endpoints

- `POST /api/login` - Team login
- `GET /api/questions` - Get quiz questions
- `POST /api/submit-quiz` - Submit quiz answers

## 🌐 Static Routes

- `/` → `/public/login.html`
- `/login.html` → `/public/login.html`
- `/quiz.html` → `/public/quiz.html`
- `/results.html` → `/public/results.html`

## ✨ What's Fixed

- ✅ No more dotenv errors
- ✅ Proper serverless function setup
- ✅ Static file serving from /public
- ✅ Clean Vercel configuration
- ✅ Environment variables via Vercel Dashboard

Your app should now deploy successfully on Vercel!
