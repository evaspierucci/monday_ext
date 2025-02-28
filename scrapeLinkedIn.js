require('dotenv').config();
const puppeteer = require('puppeteer');
const { google } = require('googleapis');
const logger = require('./logger');
const config = require('./config');
const createServer = require('./server');

// Disable all debug logging
process.env.DEBUG = '';
process.env.NODE_NO_WARNINGS = '1';
process.env.PUPPETEER_DISABLE_HEADLESS_WARNING = 'true';
process.env.NODE_ENV = 'production';
process.env.NO_COLOR = '1';

// Load credentials and setup
const { GOOGLE_APPLICATION_CREDENTIALS, SPREADSHEET_ID, SHEET_NAME } = process.env;

if (!GOOGLE_APPLICATION_CREDENTIALS) {
    logger.error("❌ GOOGLE_APPLICATION_CREDENTIALS is not set.");
    process.exit(1);
}

// Authenticate with Google Sheets API
const auth = new google.auth.GoogleAuth({
    keyFile: GOOGLE_APPLICATION_CREDENTIALS,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
});

const sheets = google.sheets({ version: 'v4', auth });

async function scrapeLinkedInJob(url) {
    const browser = await puppeteer.launch(config.puppeteer);
    
    try {
        const page = await browser.newPage();
        
        // Block all unnecessary resources
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            if (['image', 'stylesheet', 'font', 'media'].includes(req.resourceType())) {
                req.abort();
            } else {
                req.continue();
            }
        });

        // Set a longer timeout and wait for content
        await page.setDefaultNavigationTimeout(45000);
        await page.goto(url, { waitUntil: 'networkidle0' });
        await new Promise(resolve => setTimeout(resolve, 3000));

        const jobData = await page.evaluate(() => {
            const getTextContent = (selector) => {
                const element = document.querySelector(selector);
                return element ? element.textContent.trim() : null;
            };

            return {
                jobTitle: getTextContent('h1.top-card-layout__title') || 
                         getTextContent('h1') || 
                         'Not Found',
                companyName: getTextContent('a.top-card-layout__company-url') || 
                           getTextContent('.topcard__org-name-link') || 
                           getTextContent('.company-name') || 
                           'Not Found',
                location: getTextContent('span.top-card__location') || 
                         getTextContent('.topcard__flavor--bullet') || 
                         getTextContent('.job-location') || 
                         'Not Found',
                jobDescription: getTextContent('div.show-more-less-html__markup') || 
                              getTextContent('.description__text') || 
                              'Not Found'
            };
        });

        return jobData;
    } finally {
        await browser.close();
    }
}

async function updateGoogleSheet(jobData, rowIndex) {
    const values = [[
        jobData.jobTitle || 'Not Found',
        jobData.companyName || 'Not Found',
        jobData.location || 'Not Found',
        jobData.jobDescription || 'Not Found',
    ]];

    try {
        const range = `${SHEET_NAME}!B${rowIndex}:E${rowIndex}`;
        await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range,
            valueInputOption: 'RAW',
            resource: { values },
        });
        return true;
    } catch (error) {
        logger.error(`Failed to update sheet at row ${rowIndex}:`, error.message);
        throw error;
    }
}

// Create express app with minimal logging
const app = createServer();

// Handle scraping requests
app.post('/scrape', async (req, res) => {
    const { url, row } = req.body;
    
    if (!url || !row) {
        return res.status(400).json({ error: 'Missing URL or row number' });
    }

    try {
        logger.important(`Processing job at row ${row}`);
        const jobData = await scrapeLinkedInJob(url);
        
        if (!jobData.jobTitle || jobData.jobTitle === 'Not Found') {
            throw new Error('Failed to extract job data');
        }
        
        await updateGoogleSheet(jobData, row);
        logger.success(`Updated row ${row}`);
        res.json({ success: true });
    } catch (error) {
        logger.error(`Failed to process row ${row}:`, error.message);
        res.status(500).json({ error: error.message });
    }
});

// Start server quietly
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
    logger.important(`Server running on port ${PORT}`);
});

// Disable server logging
server.on('connection', () => {});
