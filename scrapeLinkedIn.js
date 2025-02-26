const puppeteer = require('puppeteer');
const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

// Google Sheets API Authentication
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive'];
const SPREADSHEET_ID = '1Tp6fb-iXuaZSfy8mJcZNYbayaZt51lbaJsHyGW6OylY';  // Updated Google Sheets ID
const CREDENTIALS_PATH = path.join(__dirname, 'linkedin-scraper-452115-55e44da21018.json');  // Updated credentials path

// Authenticate Google Sheets API
async function authenticateGoogleSheets() {
  const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH));
  const auth = new google.auth.GoogleAuth({
    credentials: credentials,
    scopes: SCOPES,
  });

  const client = await auth.getClient();
  const sheets = google.sheets({ version: 'v4', auth: client });
  return sheets;
}

// Function to append job data to Google Sheets
async function appendToSheet(jobData) {
  const sheets = await authenticateGoogleSheets();

  const range = 'Sheet1!A2:E';  // Sheet range to write data to (adjust if needed)

  const values = [
    [
      jobData.url,
      jobData.jobTitle,
      jobData.company,
      jobData.location,
      jobData.description,
    ],
  ];

  const resource = {
    values,
  };

  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range,
      valueInputOption: 'RAW',
      resource,
    });

    console.log("✅ Job data added to Google Sheets.");
  } catch (err) {
    console.error("❌ Error adding data to Google Sheets:", err);
  }
}

// Scrape LinkedIn Job Data
async function scrapeLinkedInJob(url) {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36');
  console.log(`Navigating to ${url}...`);
  await page.goto(url, { waitUntil: 'networkidle2' });

  try {
    const jobDetails = await page.evaluate((jobUrl) => {
      const jobTitle = document.querySelector('h1')?.innerText || 'Not Found';
      const company = document.querySelector('.topcard__org-name-link')?.innerText || 'Not Found';
      const location = document.querySelector('.topcard__flavor--bullet')?.innerText || 'Not Found';
      const description = document.querySelector('.description__text')?.innerText || 'Not Found';
      return { jobTitle, company, location, description, url: jobUrl };
    }, url);

    console.log("🎉 Job Data Extracted Successfully:", jobDetails);
    await appendToSheet(jobDetails);  // Add job data to Google Sheets

  } catch (error) {
    console.log("❌ Error extracting data:", error);
  }

  await browser.close();
}

// Example usage: Replace with your LinkedIn job URL
const jobUrl = 'https://www.linkedin.com/jobs/view/4167002995';
scrapeLinkedInJob(jobUrl);
