// api/questions.js - Questions endpoint

const fs = require('fs');
const path = require('path');

module.exports = async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'GET') {
        res.status(405).json({ success: false, message: 'Method not allowed' });
        return;
    }

    try {
        const questionsPath = path.join(process.cwd(), 'questions.json');
        const data = fs.readFileSync(questionsPath, 'utf8');
        res.setHeader('Content-Type', 'application/json');
        res.status(200).send(data);
        return;
    } catch (error) {
        console.error("Questions error:", error);
        res.setHeader('Content-Type', 'application/json');
        res.status(500).json({ success: false, message: 'Failed to load questions.' });
        return;
    }
};
