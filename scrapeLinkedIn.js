require('dotenv').config();
const puppeteer = require('puppeteer');
const { google } = require('googleapis');
const fs = require('fs');
const express = require('express');

// Load your credentials from the environment variable
const CREDENTIALS_PATH = process.env.GOOGLE_APPLICATION_CREDENTIALS;

if (!CREDENTIALS_PATH) {
    console.error("❌ GOOGLE_APPLICATION_CREDENTIALS is not set.");
    process.exit(1);
}

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
const spreadsheetId = '1Tp6fb-iXuaZSfy8mJcZNYbayaZt51lbaJsHyGW6OylY';  // Replace with your Google Sheet ID
const sheetName = 'Job Data';  // Adjust if your sheet has a different name

// Authenticate with Google Sheets API
const auth = new google.auth.GoogleAuth({
    keyFile: CREDENTIALS_PATH,
    scopes: SCOPES,
});

const sheets = google.sheets({ version: 'v4', auth });

// Scrape LinkedIn job details
async function scrapeLinkedInJob(url) {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36');
    console.log(`Navigating to ${url}...`);
    await page.goto(url, { waitUntil: 'networkidle2' });

    try {
        const jobData = await page.evaluate(() => {
            // More robust selectors that try multiple possible elements
            const jobTitle = (
                document.querySelector('h1.top-card-layout__title')?.textContent ||
                document.querySelector('h1')?.textContent ||
                'Not Found'
            ).trim();

            const companyName = (
                document.querySelector('a.top-card-layout__company-url')?.textContent ||
                document.querySelector('.topcard__org-name-link')?.textContent ||
                document.querySelector('.company-name')?.textContent ||
                'Not Found'
            ).trim();

            const location = (
                document.querySelector('span.top-card__location')?.textContent ||
                document.querySelector('.topcard__flavor--bullet')?.textContent ||
                document.querySelector('.job-location')?.textContent ||
                'Not Found'
            ).trim();

            const jobDescription = (
                document.querySelector('div.show-more-less-html__markup')?.textContent ||
                document.querySelector('.description__text')?.textContent ||
                'Not Found'
            ).trim();

            return { jobTitle, companyName, location, jobDescription };
        });

        console.log("🎉 Job Data Extracted Successfully:", jobData);
        return jobData;

    } catch (error) {
        console.error("❌ Error extracting data:", error);
        throw error;
    } finally {
        await browser.close();
    }
}

// Function to read URLs from the sheet
async function readJobUrls() {
    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `${sheetName}!A2:A`, // Read all URLs from column A starting from row 2
        });
        
        return response.data.values || [];
    } catch (error) {
        console.error('❌ Error reading URLs:', error.message);
        return [];
    }
}

// Update Google Sheets with the scraped job data
async function updateGoogleSheet(jobData, rowIndex) {
    const values = [
        [
            jobData.jobTitle || 'Not Found',
            jobData.companyName || 'Not Found',
            jobData.location || 'Not Found',
            jobData.jobDescription || 'Not Found',
        ],
    ];

    const resource = { values };

    try {
        console.log(`Updating row ${rowIndex} with data:`, values);
        // Write to columns B-E in the same row as the URL
        const range = `${sheetName}!B${rowIndex}:E${rowIndex}`;
        const response = await sheets.spreadsheets.values.update({
            spreadsheetId,
            range,
            valueInputOption: 'RAW',
            resource,
        });
        console.log(`✅ Row ${rowIndex} updated successfully:`, response.data);
        return true;
    } catch (error) {
        console.error(`❌ Error updating Google Sheet row ${rowIndex}:`, error);
        throw error; // Propagate error up
    }
}

const app = express();
app.use(express.json());

// Add this near the top of your express setup
app.use((req, res, next) => {
  console.log('Received request:', req.method, req.url, req.body);
  next();
});

// Modify the /scrape endpoint
app.post('/scrape', async (req, res) => {
    console.log('\n--- New Scrape Request ---');
    console.log('Received scrape request:', req.body);
    const { url, row } = req.body;
    
    if (!url || !row) {
        console.error('Missing required parameters');
        return res.status(400).json({ error: 'Missing URL or row number' });
    }
    
    try {
        console.log('Starting to scrape URL:', url);
        const jobData = await scrapeLinkedInJob(url);
        console.log('Scraped job data:', jobData);
        
        if (!jobData.jobTitle || !jobData.companyName) {
            throw new Error('Failed to scrape job data properly');
        }
        
        const updateResult = await updateGoogleSheet(jobData, row);
        console.log('Google Sheet update result:', updateResult);
        
        res.json({ 
            success: true,
            data: jobData,
            message: `Successfully updated row ${row}`
        });
    } catch (error) {
        console.error('Error in /scrape endpoint:', error);
        res.status(500).json({ 
            error: error.message,
            success: false,
            stack: error.stack
        });
    }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
