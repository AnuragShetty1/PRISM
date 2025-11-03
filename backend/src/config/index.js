const dotenv = require('dotenv');
const path = require('path');

// --- FIX: Correct path to the .env file ---
// This now correctly looks for the .env file inside the 'backend' directory.
dotenv.config({ path: path.resolve(__dirname, '../..', '.env') });


const config = {
    // --- FIX: Change default port to 3001 to match the frontend API calls ---
    port: process.env.PORT || 3001,
    mongoURI: process.env.MONGO_URI,
    jwtSecret: process.env.JWT_SECRET,
    providerUrl: process.env.PROVIDER_URL,
    contractAddress: process.env.CONTRACT_ADDRESS,
    superAdminPrivateKey: process.env.SUPER_ADMIN_PRIVATE_KEY
};

// Validate essential configuration
if (!config.mongoURI || !config.providerUrl || !config.contractAddress) {
    console.error("FATAL ERROR: Missing required environment variables. Please check your .env file.");
    if (process.env.NODE_ENV !== 'test') {
        process.exit(1);
    }
}


module.exports = config;