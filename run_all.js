const path = require('path');

const districts = [
    { name: 'Dehiwala', dir: 'Dehiwala', script: 'Dehiwala _index.js' },
    { name: 'Colombo3', dir: 'Colombo3', script: 'Colombo3_index.js' },
    { name: 'Nugegoda', dir: 'Nugegoda', script: 'Nugegoda_index.js' },
    { name: 'Piliyandala', dir: 'Piliyandala', script: 'Piliyandala_index.js' },
    { name: 'Maharagama', dir: 'Maharagama', script: 'Maharagama_index.js' }
];

async function runAll() {
    console.log("🚀 STARTING GLOBAL REAL ESTATE AUTOMATION");
    console.log("=========================================");

    for (const district of districts) {
        try {
            console.log(`\n📍 DISTRICT: ${district.name.toUpperCase()}`);
            console.log(`-----------------------------------------`);

            // Resolve the path to the district script
            const scriptPath = path.resolve(__dirname, district.dir, district.script);

            // Require the script and run its automation function
            const { runAutomation } = require(scriptPath);

            if (typeof runAutomation === 'function') {
                await runAutomation();
            } else {
                console.warn(`⚠️  Warning: runAutomation function not found in ${district.script}`);
            }

            console.log(`✅ Completed ${district.name}`);
        } catch (error) {
            console.error(`❌ Error in ${district.name}:`, error.message);
        }
    }

    console.log("\n=========================================");
    console.log("🏁 GLOBAL AUTOMATION COMPLETED");
}

if (require.main === module) {
    runAll();
}

module.exports = { runAll };
