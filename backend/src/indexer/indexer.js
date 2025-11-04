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


const startIndexer = async () => {
    logger.info('Initializing blockchain indexer...');
    
    const provider = new ethers.JsonRpcProvider(config.providerUrl);
    const contract = new ethers.Contract(config.contractAddress, MedicalRecordsABI, provider);

    logger.info(`Indexer connected to contract at address: ${config.contractAddress}`);

    // --- MODIFICATION: Add a safety buffer for the initial block ---
    // We start 2 blocks behind `latest` to ensure the block is queryable.
    let lastProcessedBlock = (await provider.getBlockNumber()) - 2;
    // Ensure we don't start from a negative block number on a fresh chain
    if (lastProcessedBlock < 0) lastProcessedBlock = 0;
    
    logger.info(`Starting to process events from block: ${lastProcessedBlock + 1}`);

    const pollInterval = 4000; // Poll every 4 seconds

    const pollEvents = async () => {
        try {
            // --- MODIFICATION: Add 1 block safety buffer to prevent "invalid block range" error ---
            // Get the latest block number
            let latestBlock = await provider.getBlockNumber();

            // Subtract 1 as a safety buffer. This ensures the block is finalized and queryable.
            if (latestBlock > 0) {
                latestBlock = latestBlock - 1;
            }
            // --- END MODIFICATION ---

            if (latestBlock <= lastProcessedBlock) {
                return; // No new blocks to process
            }
            
            // --- Event Processing Logic ---
            
            // RegistrationRequested
            try {
                const events = await contract.queryFilter('RegistrationRequested', lastProcessedBlock + 1, latestBlock);
                for (const event of events) {
                    const [requestId, hospitalName, requesterAddress] = event.args;
                    logger.info(`[Event] RegistrationRequested: ID ${requestId} for ${hospitalName}`);
                    
                    await RegistrationRequest.findOneAndUpdate(
                        { requestId: Number(requestId) },
                        { 
                            requestId: Number(requestId), 
                            hospitalName, 
                            requesterAddress, 
                            status: 'pending_hospital' // Correct status for a pending hospital
                        },
                        { upsert: true, new: true }
                    );
                }
            } catch (e) { logger.error('Error polling RegistrationRequested:', e.message); }

            // HospitalVerified
            try {
                const events = await contract.queryFilter('HospitalVerified', lastProcessedBlock + 1, latestBlock);
                 for (const event of events) {
                    const [hospitalId, adminAddress] = event.args;
                    const numericHospitalId = Number(hospitalId);
                    logger.info(`[Event] HospitalVerified: ID ${numericHospitalId} for admin ${adminAddress}.`);
                    const updatedRequest = await RegistrationRequest.findOneAndUpdate(
                        { requestId: numericHospitalId, status: 'verifying' },
                        { $set: { status: 'approved' } },
                        { new: true }
                    );
                    if (!updatedRequest) {
                        logger.warn(`[Indexer] Did not find a VERIFYING request for ID ${numericHospitalId}.`);
                        continue;
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
                 }
            } catch (e) { logger.error('Error polling HospitalVerified:', e.message); }

            // HospitalRevoked
            try {
                const events = await contract.queryFilter('HospitalRevoked', lastProcessedBlock + 1, latestBlock);
                for (const event of events) {
                    const [hospitalId] = event.args;
                    const numericHospitalId = Number(hospitalId);
                    logger.info(`[Event] HospitalRevoked: ID ${numericHospitalId}.`);
                    
                    // --- MISTAKE ---
                    // The original code only updated the hospital's status but did not handle the professionals
                    // associated with that hospital. This left a security hole where professionals could still
                    // access the system even after their parent institution was revoked.
                    await Hospital.findOneAndUpdate(
                        { hospitalId: numericHospitalId, status: 'revoking' },
                        { $set: { status: 'revoked', isVerified: false } },
                        { new: true }
                    );

                    // --- FIX ---
                    // A new step is added to perform a cascading revocation. After the hospital is marked
                    // as revoked, this code finds all users (professionals and the admin) affiliated with that
                    // hospitalId and updates their `professionalStatus` to 'revoked'. This ensures that all
                    // access for that hospital's staff is immediately and automatically cut off.
                    const updateResult = await User.updateMany(
                        { hospitalId: numericHospitalId },
                        { $set: { professionalStatus: 'revoked', isVerified: false } }
                    );

                    if (updateResult.modifiedCount > 0) {
                        logger.info(`[Cascading Revoke] Revoked ${updateResult.modifiedCount} professionals for Hospital ID ${numericHospitalId}.`);
                    }
                }
            } catch (e) { logger.error('Error polling HospitalRevoked:', e.message); }

            // RoleAssigned
            try {
                const events = await contract.queryFilter('RoleAssigned', lastProcessedBlock + 1, latestBlock);
                for (const event of events) {
                    const [userAddress, role, hospitalId] = event.args;
                    const roleEnumToString = { 1: "Doctor", 7: "LabTechnician" };
                    const roleName = roleEnumToString[Number(role)] || 'Unassigned Professional';
                    logger.info(`[Event] RoleAssigned: ${roleName} to ${userAddress} for Hospital ID ${hospitalId}`);
                    await User.findOneAndUpdate(
                        { address: userAddress.toLowerCase() },
                        { $set: { role: roleName, hospitalId: Number(hospitalId), professionalStatus: 'approved', isVerified: true } },
                        { new: true }
                    );
                }
            } catch (e) { logger.error('Error polling RoleAssigned:', e.message); }

            // RoleRevoked
            try {
                const events = await contract.queryFilter('RoleRevoked', lastProcessedBlock + 1, latestBlock);
                for (const event of events) {
                    const [userAddress] = event.args;
                    logger.info(`[Event] RoleRevoked from ${userAddress}`);
                    await User.findOneAndUpdate(
                        { address: userAddress.toLowerCase() },
                        { $set: { role: 'Patient', professionalStatus: 'revoked', isVerified: false }, $unset: { hospitalId: "", requestedHospitalId: "" } }, 
                        { new: true }
                    );
                }
            } catch (e) { logger.error('Error polling RoleRevoked:', e.message); }

            // PublicKeySaved
            try {
                const events = await contract.queryFilter('PublicKeySaved', lastProcessedBlock + 1, latestBlock);
                for (const event of events) {
                    const [userAddress] = event.args;
                    logger.info(`[Event] PublicKeySaved: for user ${userAddress}`);
                    const userOnChain = await contract.users(userAddress);
                    if (userOnChain.publicKey && userOnChain.publicKey.length > 0) {
                        await User.findOneAndUpdate(
                            { address: userAddress.toLowerCase() },
                            { $set: { publicKey: userOnChain.publicKey } },
                            { new: true }
                        );
                    }
                }
            } catch (e) { logger.error('Error polling PublicKeySaved:', e.message); }
            
            // RecordAdded
            try {
                const events = await contract.queryFilter('RecordAdded', lastProcessedBlock + 1, latestBlock);
                for (const event of events) {
                    const [recordId, owner, title, ipfsHash, category, isVerified, verifiedBy, timestamp] = event.args;
                    const numericRecordId = Number(recordId);
                    logger.info(`[Event] RecordAdded: ID ${numericRecordId} for owner ${owner}`);
                    await Record.findOneAndUpdate(
                        { recordId: numericRecordId },
                        { recordId: numericRecordId, owner: owner.toLowerCase(), title, ipfsHash, category, isVerified, uploadedBy: verifiedBy.toLowerCase(), timestamp: new Date(Number(timestamp) * 1000) },
                        { upsert: true, new: true }
                    );
                }
            } catch (e) { logger.error('Error polling RecordAdded:', e.message); }

            // ProfessionalAccessRequested
            try {
                const events = await contract.queryFilter('ProfessionalAccessRequested', lastProcessedBlock + 1, latestBlock);
                for (const event of events) {
                    const [requestId, recordIds, professional, patient] = event.args;
                    const numericRequestId = Number(requestId);
                    logger.info(`[Event] ProfessionalAccessRequested: ID ${numericRequestId} from ${professional} to ${patient}`);
                    await AccessRequest.findOneAndUpdate(
                        { requestId: numericRequestId },
                        { requestId: numericRequestId, recordIds: recordIds.map(id => Number(id)), professionalAddress: professional.toLowerCase(), patientAddress: patient.toLowerCase(), status: 'pending' },
                        { upsert: true, new: true }
                    );
                }
            } catch (e) { logger.error('Error polling ProfessionalAccessRequested:', e.message); }
            
            // AccessGranted
            try {
                const events = await contract.queryFilter('AccessGranted', lastProcessedBlock + 1, latestBlock);
                for (const event of events) {
                    const block = await event.getBlock();
                    if (!block) {
                        logger.warn(`Could not fetch block for event at hash: ${event.transactionHash}`);
                        continue;
                    }
                    const eventTimestamp = new Date(block.timestamp * 1000);

                    const [recordId, owner, grantee, expiration, encryptedDek] = event.args;
                    const numericRecordId = Number(recordId);
                    logger.info(`[Event] AccessGranted: Record ID ${numericRecordId} to grantee ${grantee}`);
                    await AccessGrant.findOneAndUpdate(
                        { recordId: numericRecordId, professionalAddress: grantee.toLowerCase() },
                        { recordId: numericRecordId, patientAddress: owner.toLowerCase(), professionalAddress: grantee.toLowerCase(), expirationTimestamp: new Date(Number(expiration) * 1000), rewrappedKey: encryptedDek, createdAt: eventTimestamp },
                        { upsert: true, new: true }
                    );
                }
            } catch (e) { logger.error('Error polling AccessGranted:', e.message); }

            // AccessRevoked
            try {
                const events = await contract.queryFilter('AccessRevoked', lastProcessedBlock + 1, latestBlock);
                for (const event of events) {
                    const [patient, professional, recordIds] = event.args;
                    const numericRecordIds = recordIds.map(id => Number(id));
                    logger.info(`[Event] AccessRevoked: Professional ${professional} from records [${numericRecordIds.join(', ')}]`);
                    await AccessGrant.deleteMany({
                        professionalAddress: professional.toLowerCase(),
                        recordId: { $in: numericRecordIds }
                    });
                }
            } catch (e) { logger.error('Error polling AccessRevoked:', e.message); }

            // Update the last processed block
            lastProcessedBlock = latestBlock;

        } catch (error) {
            logger.error(`Major error in event polling loop: ${error.message}`, error);
        }
    };

    setInterval(pollEvents, pollInterval);

    logger.info('Indexer is now polling for blockchain events.');
};

module.exports = startIndexer;
