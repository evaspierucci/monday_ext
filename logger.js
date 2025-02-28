const DEBUG = process.env.DEBUG_MODE === 'true';

const logger = {
    info: (...args) => {
        if (DEBUG) console.log(...args);
    },
    error: (...args) => console.error(...args),
    success: (...args) => console.log('✅', ...args),
    important: (...args) => console.log('\n🔔', ...args)
};

module.exports = logger; 