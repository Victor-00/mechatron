// api/submit-quiz.js - Quiz submission endpoint

// Helper function to parse request body
const parseBody = (req) => {
    return new Promise((resolve) => {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            try {
                resolve(JSON.parse(body));
            } catch (error) {
                resolve(null);
            }
        });
    });
};

module.exports = async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        res.status(405).json({ success: false, message: 'Method not allowed' });
        return;
    }

    try {
        const body = await parseBody(req);
        if (!body) {
            res.setHeader('Content-Type', 'application/json');
            res.status(400).json({ success: false, message: 'Invalid request format.' });
            return;
        }

        const quizResult = body;
        
        // For Vercel, we'll store scores in memory for now
        // In production, you might want to use a database
        if (!global.quizScores) {
            global.quizScores = [];
        }
        
        global.quizScores.push(quizResult);
        
        res.setHeader('Content-Type', 'application/json');
        res.status(200).json({ success: true, message: 'Quiz submitted successfully!' });
        return;
    } catch (error) {
        console.error('Failed to save score:', error);
        res.setHeader('Content-Type', 'application/json');
        res.status(500).json({ success: false, message: 'Failed to save score.' });
        return;
    }
};
