require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Access API key from .env
const API_KEY = process.env.GEMINI_API_KEY;

// Check if API key is present
if (!API_KEY) {
    console.error("Error: GEMINI_API_KEY is missing in .env file.");
    process.exit(1);
}

// Log first few chars to verify correct key is loaded
console.log(`Using API Key: ${API_KEY.substring(0, 8)}...`);

const genAI = new GoogleGenerativeAI(API_KEY);

const axios = require('axios');

async function checkAvailableModels() {
    try {
        console.log("Attempting to list models via REST API...");
        const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`;

        const response = await axios.get(url);
        const models = response.data.models;

        if (models && models.length > 0) {
            console.log("✅ SUCCESS! API IS WORKING.");
            console.log(`Found ${models.length} models.`);
            console.log("Available models (first 5):");
            models.slice(0, 5).forEach(m => console.log(` - ${m.name.replace('models/', '')}`));

            // Check for specific models we want
            const hasFlash = models.some(m => m.name.includes('gemini-1.5-flash'));
            const hasPro = models.some(m => m.name.includes('gemini-pro'));

            console.log("\nSpecific Model Check:");
            console.log(` - gemini-1.5-flash: ${hasFlash ? 'AVAILABLE' : 'MISSING'}`);
            console.log(` - gemini-pro: ${hasPro ? 'AVAILABLE' : 'MISSING'}`);
        } else {
            console.log("⚠️ API returned 200 OK but no models found?");
        }

    } catch (error) {
        console.error("\n❌ REST API ERROR");
        console.error("----------------");
        console.error("Message:", error.message);
        if (error.response) {
            console.error("Status:", error.response.status);
            console.error("Data:", JSON.stringify(error.response.data, null, 2));
        }
    }
}

checkAvailableModels();
