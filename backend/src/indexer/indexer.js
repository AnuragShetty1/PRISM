const { ethers } = require('ethers');
const path = require('path');
const config = require('../config');
const logger = require('../utils/logger');
const MedicalRecordsABI = require(path.join(__dirname, '../../../src/contracts/MedicalRecords.json')).abi;

const Hospital = require('../models/Hospital');
const RegistrationRequest = require('../models/RegistrationRequest');
const User = require('../models/User');
const Record = require('../models/Record');
const AccessRequest = require('../models/AccessRequest');
const AccessGrant = require('../models/AccessGrant');

// --- Global error handlers for server stability ---
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

const gracefulShutdown = () => {
    logger.info('Shutting down indexer gracefully.');
    process.exit(0);
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);


// --- [NEW] HTTP Provider for Read-Only Calls ---
// We keep a separate, stable HTTP provider for any read calls inside handlers
// (e.g., fetching user data from the contract in handlePublicKeySaved)
let httpProvider;
let httpContract;


// --- [NEW] Event Handlers ---
// We move the logic from the poll loop into dedicated, async-safe handlers.
// Each handler is wrapped in a try/catch to prevent one bad event from
// crashing the entire indexer.

const handleRegistrationRequested = async (requestId, hospitalName, requesterAddress, event) => {
    try {
        const numericRequestId = Number(requestId);
        logger.info(`[Event] RegistrationRequested: ID ${numericRequestId} for ${hospitalName}`);
        
        await RegistrationRequest.findOneAndUpdate(
            { requestId: numericRequestId },
            { 
                requestId: numericRequestId, 
                hospitalName, 
                requesterAddress, 
                status: 'pending_hospital' // Correct status for a pending hospital
            },
            { upsert: true, new: true }
        );
    } catch (e) { 
        logger.error(`Error processing RegistrationRequested (ID: ${requestId}): ${e.message}`, { tx: event.transactionHash }); 
    }
};

const handleHospitalVerified = async (hospitalId, adminAddress, event) => {
    try {
        const numericHospitalId = Number(hospitalId);
        logger.info(`[Event] HospitalVerified: ID ${numericHospitalId} for admin ${adminAddress}.`);
        
        const updatedRequest = await RegistrationRequest.findOneAndUpdate(
            { requestId: numericHospitalId, status: 'verifying' },
            { $set: { status: 'approved' } },
            { new: true }
        );
        if (!updatedRequest) {
            logger.warn(`[Indexer] Did not find a VERIFYING request for ID ${numericHospitalId}.`, { tx: event.transactionHash });
            return; // Use return instead of continue in a handler
        }
        
        const hospitalName = updatedRequest.hospitalName;
        await Hospital.findOneAndUpdate(
            { hospitalId: numericHospitalId }, 
            { hospitalId: numericHospitalId, name: hospitalName, adminAddress, isVerified: true, status: 'active' }, 
            { upsert: true, new: true }
        );
        await User.findOneAndUpdate(
            { address: adminAddress.toLowerCase() }, 
            { $set: { address: adminAddress.toLowerCase(), name: `Admin for ${hospitalName}`, role: 'HospitalAdmin', professionalStatus: 'approved', isVerified: true, hospitalId: numericHospitalId } }, 
            { upsert: true, new: true }
        );
    } catch (e) { 
        logger.error(`Error processing HospitalVerified (ID: ${hospitalId}): ${e.message}`, { tx: event.transactionHash }); 
    }
};

const handleHospitalRevoked = async (hospitalId, event) => {
    try {
        const numericHospitalId = Number(hospitalId);
        logger.info(`[Event] HospitalRevoked: ID ${numericHospitalId}.`);
        
        await Hospital.findOneAndUpdate(
            { hospitalId: numericHospitalId, status: 'revoking' },
            { $set: { status: 'revoked', isVerified: false } },
            { new: true }
        );

        // --- FIX (Copied from original) ---
        // Perform cascading revocation for all professionals at this hospital.
        const updateResult = await User.updateMany(
            { hospitalId: numericHospitalId },
            { $set: { professionalStatus: 'revoked', isVerified: false } }
        );

        if (updateResult.modifiedCount > 0) {
            logger.info(`[Cascading Revoke] Revoked ${updateResult.modifiedCount} professionals for Hospital ID ${numericHospitalId}.`);
        }
    } catch (e) { 
        logger.error(`Error processing HospitalRevoked (ID: ${hospitalId}): ${e.message}`, { tx: event.transactionHash }); 
    }
};

const handleRoleAssigned = async (userAddress, role, hospitalId, event) => {
    try {
        const roleEnumToString = { 1: "Doctor", 7: "LabTechnician" };
        const roleName = roleEnumToString[Number(role)] || 'Unassigned Professional';
        logger.info(`[Event] RoleAssigned: ${roleName} to ${userAddress} for Hospital ID ${hospitalId}`);
        
        await User.findOneAndUpdate(
            { address: userAddress.toLowerCase() },
            { $set: { role: roleName, hospitalId: Number(hospitalId), professionalStatus: 'approved', isVerified: true } },
            { new: true }
        );
    } catch (e) { 
        logger.error(`Error processing RoleAssigned (User: ${userAddress}): ${e.message}`, { tx: event.transactionHash }); 
    }
};

const handleRoleRevoked = async (userAddress, event) => {
    try {
        logger.info(`[Event] RoleRevoked from ${userAddress}`);
        
        await User.findOneAndUpdate(
            { address: userAddress.toLowerCase() },
            { $set: { role: 'Patient', professionalStatus: 'revoked', isVerified: false }, $unset: { hospitalId: "", requestedHospitalId: "" } }, 
            { new: true }
        );
    } catch (e) { 
        logger.error(`Error processing RoleRevoked (User: ${userAddress}): ${e.message}`, { tx: event.transactionHash }); 
    }
};

const handlePublicKeySaved = async (userAddress, event) => {
    try {
        logger.info(`[Event] PublicKeySaved: for user ${userAddress}`);
        
        // Use the stable httpContract for this read call
        const userOnChain = await httpContract.users(userAddress);
        
        if (userOnChain.publicKey && userOnChain.publicKey.length > 0) {
            await User.findOneAndUpdate(
                { address: userAddress.toLowerCase() },
                { $set: { publicKey: userOnChain.publicKey } },
                { new: true }
            );
        }
    } catch (e) { 
        logger.error(`Error processing PublicKeySaved (User: ${userAddress}): ${e.message}`, { tx: event.transactionHash }); 
    }
};
          
const handleRecordAdded = async (recordId, owner, title, ipfsHash, category, isVerified, verifiedBy, timestamp, event) => {
    try {
        const numericRecordId = Number(recordId);
        logger.info(`[Event] RecordAdded: ID ${numericRecordId} for owner ${owner}`);
        
        await Record.findOneAndUpdate(
            { recordId: numericRecordId },
            { recordId: numericRecordId, owner: owner.toLowerCase(), title, ipfsHash, category, isVerified, uploadedBy: verifiedBy.toLowerCase(), timestamp: new Date(Number(timestamp) * 1000) },
            { upsert: true, new: true }
        );
    } catch (e) { 
        logger.error(`Error processing RecordAdded (ID: ${recordId}): ${e.message}`, { tx: event.transactionHash }); 
    }
};

const handleProfessionalAccessRequested = async (requestId, recordIds, professional, patient, event) => {
    try {
        const numericRequestId = Number(requestId);
        logger.info(`[Event] ProfessionalAccessRequested: ID ${numericRequestId} from ${professional} to ${patient}`);
        
        await AccessRequest.findOneAndUpdate(
            { requestId: numericRequestId },
            { requestId: numericRequestId, recordIds: recordIds.map(id => Number(id)), professionalAddress: professional.toLowerCase(), patientAddress: patient.toLowerCase(), status: 'pending' },
            { upsert: true, new: true }
        );
    } catch (e) { 
        logger.error(`Error processing ProfessionalAccessRequested (ID: ${requestId}): ${e.message}`, { tx: event.transactionHash }); 
    }
};
    
const handleAccessGranted = async (recordId, owner, grantee, expiration, encryptedDek, event) => {
    try {
        // This method comes from the event object itself and is reliable
        const block = await event.getBlock();
        if (!block) {
            logger.warn(`Could not fetch block for event at hash: ${event.transactionHash}`);
            return;
        }
        const eventTimestamp = new Date(block.timestamp * 1000);

        const numericRecordId = Number(recordId);
        logger.info(`[Event] AccessGranted: Record ID ${numericRecordId} to grantee ${grantee}`);
        
        await AccessGrant.findOneAndUpdate(
            { recordId: numericRecordId, professionalAddress: grantee.toLowerCase() },
            { recordId: numericRecordId, patientAddress: owner.toLowerCase(), professionalAddress: grantee.toLowerCase(), expirationTimestamp: new Date(Number(expiration) * 1000), rewrappedKey: encryptedDek, createdAt: eventTimestamp },
            { upsert: true, new: true }
        );
    } catch (e) { 
        logger.error(`Error processing AccessGranted (ID: ${recordId}): ${e.message}`, { tx: event.transactionHash }); 
    }
};

const handleAccessRevoked = async (patient, professional, recordIds, event) => {
    try {
        const numericRecordIds = recordIds.map(id => Number(id));
        logger.info(`[Event] AccessRevoked: Professional ${professional} from records [${numericRecordIds.join(', ')}]`);
        
        await AccessGrant.deleteMany({
            professionalAddress: professional.toLowerCase(),
            recordId: { $in: numericRecordIds }
        });
    } catch (e) { 
        logger.error(`Error processing AccessRevoked (User: ${professional}): ${e.message}`, { tx: event.transactionHash }); 
    }
};


// --- [MODIFIED] Main startup function ---
const startIndexer = async () => {
    logger.info('Initializing blockchain indexer...');
    
    // [NEW] Initialize the HTTP provider for read calls
    httpProvider = new ethers.JsonRpcProvider(config.providerUrl);
    httpContract = new ethers.Contract(config.contractAddress, MedicalRecordsABI, httpProvider);
    logger.info(`HTTP provider initialized for read calls at: ${config.providerUrl}`);
    logger.info(`Indexer will listen to contract at address: ${config.contractAddress}`);

    // [NEW] Define the WebSocket connection function
    const connectWebSocket = () => {
        let wssProvider;
        let wssContract;

        try {
            logger.info(`Connecting to WebSocket at ${config.polygonAmoyWssUrl}...`);
            // Use the new WSS URL from config
            wssProvider = new ethers.WebSocketProvider(config.polygonAmoyWssUrl);
            wssContract = new ethers.Contract(config.contractAddress, MedicalRecordsABI, wssProvider);

            // --- [THIS IS THE FIX (Third Attempt)] ---
            // We use *only* the public, documented event listeners for ethers v6.
            // We will trust ethers' built-in reconnection logic.
            // We DO NOT access any internal properties like `_websocket`.

            // Log when the provider successfully connects or reconnects
            wssProvider.on("network", (network, oldNetwork) => {
                if (oldNetwork) {
                    // This event fires when a connection is re-established
                    logger.info(`WebSocket re-connected to network: ${network.name}`);
                } else {
                    // This event fires on the first successful connection
                    logger.info(`WebSocket connected to network: ${network.name} (ChainId: ${network.chainId})`);
                }
            });

            // Log any errors from the WebSocket provider
            wssProvider.on("error", (error) => {
                logger.error(`WebSocket Provider Error: ${error.message}`, error);
                // Ethers v6 will automatically attempt to reconnect in the background.
                // We just log the error here. If the connection is dropped,
                // ethers will keep trying, and will fire a "network" event
                // (above) if it succeeds.
            });
            // --- [END OF FIX] ---


            logger.info('WebSocket provider connected. Attaching contract event listeners...');

            // Attach all event listeners to their new handlers
            // (These are unchanged)
            wssContract.on('RegistrationRequested', handleRegistrationRequested);
            wssContract.on('HospitalVerified', handleHospitalVerified);
            wssContract.on('HospitalRevoked', handleHospitalRevoked);
            wssContract.on('RoleAssigned', handleRoleAssigned);
            wssContract.on('RoleRevoked', handleRoleRevoked);
            wssContract.on('PublicKeySaved', handlePublicKeySaved);
            wssContract.on('RecordAdded', handleRecordAdded);
            wssContract.on('ProfessionalAccessRequested', handleProfessionalAccessRequested);
            wssContract.on('AccessGranted', handleAccessGranted);
            wssContract.on('AccessRevoked', handleAccessRevoked);

            logger.info('All contract event listeners attached.');

        } catch (error) {
            // This block catches errors during the *initial instantiation*
            // (e.g., if the wss URL is badly formatted)
            logger.error(`Failed to initialize WebSocket provider: ${error.message}. Retrying in 5 seconds...`);
            if (wssContract) {
                wssContract.removeAllListeners();
            }
            setTimeout(connectWebSocket, 5000);
        }
    };

    // [NEW] Start the initial WebSocket connection
    connectWebSocket();
};

module.exports = startIndexer;