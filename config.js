module.exports = {
    puppeteer: {
        // Disable all browser logs
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-logging',
            '--disable-gpu',
            '--disable-extensions',
            '--disable-software-rasterizer',
            '--disable-dev-tools',
            '--silent',
            '--disable-browser-side-navigation'
        ],
        headless: true,
        ignoreHTTPSErrors: true,
        // Disable all console output from the browser
        dumpio: false
    },
    express: {
        // Disable all express debug logging
        silent: true
    }
}; 