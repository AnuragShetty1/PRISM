// --- REMOVED: 'dotenv' and 'path' ---
// We don't use a .env file in the Render deployment environment.
// Variables are set directly in the Render dashboard.

const config = {
    // Render provides its own PORT variable, this correctly falls back to 3001 if not set
    port: process.env.PORT || 3001, 
    mongoURI: process.env.MONGO_URI,
    jwtSecret: process.env.JWT_SECRET,
    providerUrl: process.env.PROVIDER_URL,
    // --- [NEW] ADDED WSS URL FOR THE INDEXER ---
    // This is the WebSocket URL (wss://) from Alchemy, used *only* for event listening.
    polygonAmoyWssUrl: process.env.POLYGON_AMOY_WSS_URL,
    contractAddress: process.env.CONTRACT_ADDRESS,
    superAdminPrivateKey: process.env.SUPER_ADMIN_PRIVATE_KEY,
    sponsorPrivateKey: process.env.SPONSOR_PRIVATE_KEY,
    // --- Load the FRONTEND_URL for CORS configuration ---
    frontendUrl: process.env.FRONTEND_URL
};

// Validate essential configuration
// --- MODIFIED: Removed frontendUrl from the validation. ---
// server.js can handle if this is missing, so it's not a fatal error.
// --- [NEW] ADDED WSS URL to validation ---
if (!config.mongoURI || 
    !config.providerUrl ||
    !config.polygonAmoyWssUrl || // Added validation for the new WSS URL
    !config.contractAddress || 
    !config.superAdminPrivateKey || 
    !config.sponsorPrivateKey || 
    !config.jwtSecret) {
        
    console.error("FATAL ERROR: Missing required environment variables. Please check the Render environment settings. (mongoURI, providerUrl, polygonAmoyWssUrl, contractAddress, superAdminPrivateKey, sponsorPrivateKey, jwtSecret)");
    
    // We still exit if variables are missing
    if (process.env.NODE_ENV !== 'test') {
        process.exit(1);
  T}
}

module.exports = config;