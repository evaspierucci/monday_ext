require("dotenv").config();
const { google } = require('googleapis');
const axios = require("axios");

// Load environment variables
const CREDENTIALS_PATH = process.env.GOOGLE_APPLICATION_CREDENTIALS;
const MONDAY_API_KEY = process.env.MONDAY_API_KEY;
const MONDAY_BOARD_ID = process.env.MONDAY_BOARD_ID;
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const SHEET_NAME = process.env.SHEET_NAME || 'Job Data';

if (!CREDENTIALS_PATH || !MONDAY_API_KEY || !MONDAY_BOARD_ID) {
    console.error("❌ Missing required environment variables");
    process.exit(1);
}

// Set up Google Sheets authentication
const auth = new google.auth.GoogleAuth({
    keyFile: CREDENTIALS_PATH,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

const sheets = google.sheets({ version: 'v4', auth });

// Function to fetch job data from Google Sheets
async function fetchJobData() {
    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEET_NAME}!A2:E`, // Assuming columns A-E contain your data
        });

        const rows = response.data.values || [];
        
        return rows.map(row => ({
            title: row[1] || '', // Column B: Job Title
            company: row[2] || '', // Column C: Company
            location: row[3] || '', // Column D: Location
            url: row[0] || '', // Column A: Job URL
            description: row[4] || '', // Column E: Description
        })).filter(job => job.title && job.company); // Only include rows with at least a title and company
        
    } catch (error) {
        console.error("❌ Error fetching job data:", error);
        return [];
    }
}

// Function to send job data to Monday.com
async function sendToMonday(jobData) {
    for (const job of jobData) {
        try {
            // Escape special characters to prevent JSON parsing errors
            const escapedTitle = job.title.replace(/"/g, '\\"');
            const escapedCompany = job.company.replace(/"/g, '\\"');
            const escapedLocation = job.location.replace(/"/g, '\\"');
            const escapedUrl = job.url.replace(/"/g, '\\"');
            const escapedDescription = job.description.replace(/"/g, '\\"');

            const response = await axios.post(
                "https://api.monday.com/v2",
                {
                    query: `
                        mutation {
                            create_item (
                                board_id: ${MONDAY_BOARD_ID}, 
                                item_name: "${escapedTitle}",
                                column_values: "{
                                    \\"text_mknhnrja\\": \\"${escapedCompany}\\",
                                    \\"text_mknjamzd\\": \\"${escapedLocation}\\",
                                    \\"link_mknhdsm8\\": {\\"url\\": \\"${escapedUrl}\\", \\"text\\": \\"Job Link\\"},
                                    \\"long_text_mknhxgw\\": \\"${escapedDescription}\\"
                                }"
                            ) {
                                id
                            }
                        }
                    `,
                },
                {
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: MONDAY_API_KEY,
                    },
                }
            );

            console.log(`✅ Successfully added job: ${job.title}`);
        } catch (error) {
            console.error(`❌ Failed to add job: ${job.title}`, error.response?.data || error.message);
            // Log the full error for debugging
            console.error('Full error:', error);
        }

        // Add a small delay between requests to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
}

// Add this function to get column information
async function getColumnInfo() {
    try {
        const response = await axios.post(
            "https://api.monday.com/v2",
            {
                query: `
                    query {
                        boards(ids: ${MONDAY_BOARD_ID}) {
                            columns {
                                id
                                title
                                type
                            }
                        }
                    }
                `
            },
            {
                headers: {
                    "Content-Type": "application/json",
                    Authorization: MONDAY_API_KEY,
                }
            }
        );
        console.log('Board columns:', JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.error('Error getting column info:', error);
    }
}

// Main Function
(async () => {
    await getColumnInfo();
    console.log("🚀 Fetching job data from Google Sheets...");
    const jobData = await fetchJobData();

    if (jobData.length === 0) {
        console.log("⚠️ No job data found.");
        return;
    }

    console.log(`📤 Found ${jobData.length} jobs. Sending to Monday.com...`);
    await sendToMonday(jobData);
    console.log("✅ Process completed!");
})();
