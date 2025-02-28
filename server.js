const express = require('express');
const morgan = require('morgan'); // You'll need to install this: npm install morgan

// Completely disable express debug logging
require('express').logger = () => {};
process.env.NO_DEBUG = '*';
process.env.DEBUG = '';
process.env.NODE_ENV = 'production';

function createServer() {
    const app = express();
    
    // Disable all middleware logging
    app.set('env', 'production');
    app.disable('x-powered-by');
    app.set('etag', false);
    
    // Only log errors
    app.use(morgan('tiny', {
        skip: (req, res) => res.statusCode < 400
    }));
    
    // Parse JSON silently
    app.use(express.json({ silent: true }));
    
    // Add a test endpoint
    app.get('/test', (req, res) => {
        res.json({ status: 'Server is running' });
    });
    
    return app;
}

module.exports = createServer; 