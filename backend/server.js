require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') }); // --- [THE FIX] --- This line MUST be first to load environment variables.
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const { WebSocketServer } = require('ws'); 

const config = require('./src/config');
const logger = require('./src/utils/logger');
const errorHandler = require('./src/api/middlewares/errorHandler');
const startIndexer = require('./src/indexer/indexer');

// --- Import API Routes ---
const superAdminRoutes = require('./src/api/routes/superAdmin');
const userRoutes = require('./src/api/routes/users');
const hospitalAdminRoutes = require('./src/api/routes/hospitalAdmin');

const app = express();

// --- Middlewares ---
const corsOptions = {
  origin: 'http://localhost:3000', // Allow requests from your frontend
  methods: ['GET', 'POST', 'PUT', 'DELETE'], // Explicitly allow POST
  allowedHeaders: ['Content-Type', 'Authorization'], // Allow these specific headers
};
app.use(cors(corsOptions));
app.use(express.json());

// --- Basic Health Check Route ---
app.get('/', (req, res) => {
    res.status(200).json({ status: 'ok', message: 'Backend server is running.' });
});

// --- API Routes ---
app.use('/api/super-admin', superAdminRoutes);
app.use('/api/users', userRoutes);
app.use('/api/hospital-admin', hospitalAdminRoutes);

// --- Global Error Handler ---
app.use(errorHandler);

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
    logger.info('Client connected via WebSocket');
    ws.on('close', () => {
        logger.info('Client disconnected from WebSocket');
    });
});


const startServer = async () => {
    try {
        // --- Connect to MongoDB ---
        logger.info('Connecting to MongoDB...');
        await mongoose.connect(config.mongoURI);
        logger.info('MongoDB connected successfully.');

        server.listen(config.port, () => {
            logger.info(`Server is running on port ${config.port}`);
        });

        startIndexer(wss);

    } catch (error) {
        logger.error('Failed to start the server:', error);
        process.exit(1);
    }
};

startServer();

