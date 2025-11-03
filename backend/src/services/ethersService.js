const { ethers } = require('ethers');
const path = require('path');
const config = require('../config');
const logger = require('../utils/logger');
const MedicalRecordsABI = require(path.join(__dirname, '../../../src/contracts/MedicalRecords.json')).abi;

// [NEW] Import the new custom error
const { BlockchainError } = require('../utils/errors');

// [MODIFIED] One contract instance for Admin, one for Sponsor
let adminContract;
let sponsorContract;
let adminSigner;
let sponsorSigner;

// [MODIFIED] Role mapping - REMOVED 'Lab Technician' (with space) for consistency
const ROLE_MAP = {
  'Patient': 0,
  'Doctor': 1,
  'HospitalAdmin': 2,
  'InsuranceProvider': 3,
  'Pharmacist': 4,
  'Researcher': 5,
  'Guardian': 6,
  'LabTechnician': 7, // Canonical string
  'SuperAdmin': 8,
};

// [NEW] Error handling helper for all contract calls
/**
 * @dev Wraps a contract call to provide standardized error logging and re-throwing.
 * @param {string} functionName - The name of the contract function being called (for logging).
 * @param {Promise} contractCallPromise - The promise returned by the ethers.js contract call.
 * @returns {Promise<any>} - Returns the result of the contract call (usually a transaction object).
 * @throws {BlockchainError} - Throws a custom error with a clean message.
 */
const handleContractCall = async (functionName, contractCallPromise) => {
  try {
    // Await the contract call promise
    const tx = await contractCallPromise;
    return tx;
  } catch (error) {
    // Log the detailed error for backend debugging
    logger.error(`Error in contract call '${functionName}': ${error.message}`, {
      reason: error.reason,
      code: error.code,
      // stack: error.stack, // Uncomment for full stack trace
    });

    // Extract a user-friendly reason
    const reason = error.reason || error.message || 'The blockchain transaction failed.';
    
    // Re-throw a standardized error for the API to catch
    throw new BlockchainError(reason.replace('execution reverted: ', ''), functionName);
  }
};


const init = () => {
  // [MODIFIED] Check if already initialized
  if (adminContract && sponsorContract) {
    return;
  }
  try {
    // [MODIFIED] Check for *both* keys
    if (!process.env.SUPER_ADMIN_PRIVATE_KEY) {
      throw new Error('SUPER_ADMIN_PRIVATE_KEY is not set in the .env file. Cannot sign admin transactions.');
    }
    if (!process.env.SPONSOR_WALLET_PRIVATE_KEY) {
      throw new Error('SPONSOR_WALLET_PRIVATE_KEY is not set in the .env file. Cannot sign sponsored transactions.');
    }

    const provider = new ethers.JsonRpcProvider(config.providerUrl);
    
    // [NEW] Setup Admin Signer (for verifying hospitals, etc.)
    adminSigner = new ethers.Wallet(process.env.SUPER_ADMIN_PRIVATE_KEY, provider);
    adminContract = new ethers.Contract(config.contractAddress, MedicalRecordsABI, adminSigner);
    
    // [NEW] Setup Sponsor Signer (for all user-facing transactions)
    sponsorSigner = new ethers.Wallet(process.env.SPONSOR_WALLET_PRIVATE_KEY, provider);
    sponsorContract = new ethers.Contract(config.contractAddress, MedicalRecordsABI, sponsorSigner);

    logger.info(`Ethers service initialized.`);
    logger.info(`Admin Signer Address: ${adminSigner.address}`);
    logger.info(`Sponsor Signer Address: ${sponsorSigner.address}`);

  } catch (error) {
    logger.error(`Failed to initialize ethers service: ${error.message}`);
    process.exit(1);
  }
};

// --- [NEW] ADMIN HELPER FUNCTION ---
/**
 * @dev Returns the address of the admin signer.
 * Used by the adminAuth middleware to verify the signature.
 */
const getAdminAddress = async () => {
  if (!adminSigner) {
    init(); // Ensure signer is initialized if not already
    if (!adminSigner) { // Double check after init
      throw new Error('Ethers service admin signer is not initialized.');
    }
  }
  return adminSigner.address;
};


// --- [UNCHANGED] SUPER ADMIN FUNCTIONS ---
// These functions use the adminContract to perform high-privilege actions.

// [MODIFIED] All functions below are wrapped with 'handleContractCall'
const verifyHospital = async (hospitalId, adminAddress) => {
  if (!adminContract) throw new Error('Ethers service is not initialized.');
  return handleContractCall(
    'verifyHospital',
    adminContract.verifyHospital(BigInt(hospitalId), adminAddress)
  );
};

const revokeHospital = async (hospitalId) => {
  if (!adminContract) {
    throw new Error('Ethers service is not initialized.');
  }
  return handleContractCall(
    'revokeHospital',
    adminContract.revokeHospital(BigInt(hospitalId))
  );
};

const assignRole = async (professionalAddress, hospitalId, role) => {
  if (!adminContract) throw new Error('Ethers service is not initialized.');
  
  // [FIX] Sanitize role string before lookup
  const canonicalRole = role.replace(/\s/g, '');
  const roleIndex = ROLE_MAP[canonicalRole];
  
  if (roleIndex === undefined) {
    throw new Error(`Invalid role string: ${role}`);
  }
  return handleContractCall(
    'assignRole',
    adminContract.assignRole(professionalAddress, roleIndex, BigInt(hospitalId))
  );
};

const revokeRole = async (professionalAddress, role, hospitalId) => {
  if (!adminContract) throw new Error('Ethers service is not initialized.');

  // [FIX] Sanitize role string before lookup
  const canonicalRole = role.replace(/\s/g, '');
  const roleIndex = ROLE_MAP[canonicalRole];
  
  if (roleIndex === undefined) {
    throw new Error(`Invalid role string: ${role}`);
  }
  return handleContractCall(
    'revokeRole',
    adminContract.revokeRole(professionalAddress, roleIndex, BigInt(hospitalId))
  );
};

// --- [NEW] SPONSOR MANAGEMENT FUNCTIONS (Called by Super Admin) ---
// These functions use the adminContract to manage who is a sponsor.

/**
 * @dev Grants the sponsor role to a wallet. Called by Super Admin.
 * @param {string} sponsorAddress The address to grant the sponsor role to.
 */
const grantSponsorRole = async (sponsorAddress) => {
  if (!adminContract) throw new Error('Ethers service is not initialized.');
  return handleContractCall(
    'grantSponsorRole',
    adminContract.grantSponsorRole(sponsorAddress)
  );
};

/**
 * @dev Revokes the sponsor role from a wallet. Called by Super Admin.
 * @param {string} sponsorAddress The address to revoke the sponsor role from.
 */
const revokeSponsorRole = async (sponsorAddress) => {
  if (!adminContract) throw new Error('Ethers service is not initialized.');
  return handleContractCall(
    'revokeSponsorRole',
    adminContract.revokeSponsorRole(sponsorAddress)
  );
};


// --- [NEW] SPONSORED USER FUNCTIONS ---
// All functions below use the sponsorContract to pay for transactions.
// The user's address is passed as the first argument, verified by API auth.

/**
 * @dev Registers a new user, sponsored by the backend.
 * @param {string} userAddress The user's wallet address.
 * @param {string} name The user's name.
 * @param {string|number} role The user's role (e.g., 'Patient' or 0).
 * @param {number} hospitalId The hospital ID (0 for patients). This is received but NOT passed to the contract.
 */
const registerUser = async (userAddress, name, role, hospitalId) => {
  if (!sponsorContract) throw new Error('Ethers service is not initialized.');
  
  let roleIndex;
  
  // [FIX] Check if the role is already a number (like 1)
  if (typeof role === 'number') {
    roleIndex = role;
  } else {
    // [FIX] Sanitize role string before lookup
    const canonicalRole = role.replace(/\s/g, '');
    // If it's a string (like "Doctor"), look it up
    roleIndex = ROLE_MAP[canonicalRole];
  }
  
  // [FIX] Check all valid role indices
  if (roleIndex === undefined || roleIndex < 0 || roleIndex > 8) {
    throw new Error(`Invalid role: ${role}`);
  }

  // [FIX] REMOVED hospitalId from the contract call.
  // The contract (per your plan) only takes (address, name, role).
  // The hospitalId is handled by the off-chain API call.
  return handleContractCall(
    'registerUser',
    sponsorContract.registerUser(userAddress, name, roleIndex)
  );
};

/**
 * @dev Saves a user's public key, sponsored by the backend.
 * @param {string} userAddress The user's wallet address.
 * @param {string} publicKey The user's public encryption key.
 */
const savePublicKey = async (userAddress, publicKey) => {
  if (!sponsorContract) throw new Error('Ethers service is not initialized.');
  return handleContractCall(
    'savePublicKey',
    sponsorContract.savePublicKey(userAddress, publicKey)
  );
};

/**
 * @dev Updates a user's profile, sponsored by the backend.
 * @param {string} userAddress The user's wallet address.
 * @param {string} name User's name.
 * @param {string} contactInfo User's contact info.
 * @param {string} profileMetadataURI URI for profile metadata.
 */
const updateUserProfile = async (userAddress, name, contactInfo, profileMetadataURI) => {
  if (!sponsorContract) throw new Error('Ethers service is not initialized.');
  return handleContractCall(
    'updateUserProfile',
    sponsorContract.updateUserProfile(userAddress, name, contactInfo, profileMetadataURI)
  );
};

/**
 * @dev Submits a hospital registration request, sponsored by the backend.
 * @param {string} requesterAddress The user's wallet address.
 * @param {string} hospitalName The name of the hospital.
 */
const requestRegistration = async (requesterAddress, hospitalName) => {
  if (!sponsorContract) throw new Error('Ethers service is not initialized.');
  return handleContractCall(
    'requestRegistration',
    sponsorContract.requestRegistration(requesterAddress, hospitalName)
  );
};

/**
 * @dev Grants record access, sponsored by the backend on behalf of the patient.
 * @param {string} patientAddress The patient's wallet address (owner).
 * @param {string|number} recordId The record ID.
 * @param {string} grantee The address of the professional receiving access.
 * @param {number} durationInDays The duration of access.
 * @param {object} encryptedDek The encrypted data key for the grantee (as a JS object).
 */
const grantRecordAccess = async (patientAddress, recordId, grantee, durationInDays, encryptedDek) => {
  if (!sponsorContract) throw new Error('Ethers service is not initialized.');
  try {
    // Convert the JS object into a JSON string, *then* convert to bytes.
    const encryptedDekBytes = ethers.toUtf8Bytes(JSON.stringify(encryptedDek));

    return handleContractCall(
      'grantRecordAccess',
      sponsorContract.grantRecordAccess(patientAddress, BigInt(recordId), grantee, BigInt(durationInDays), encryptedDekBytes)
    );
  } catch (error) {
    // Catch errors from JSON.stringify or toUtf8Bytes
    logger.error(`Error encoding encrypted DEK for grantRecordAccess: ${error.message}`);
    throw new Error(`Failed to encode encryption key: ${error.message}`);
  }
};

/**
 * @dev Grants access to multiple records, sponsored by the backend.
 * @param {string} patientAddress The patient's wallet address (owner).
 * @param {Array<string|number>} recordIds Array of record IDs.
 * @param {string} grantee The address of the professional receiving access.
 * @param {number} durationInDays The duration of access.
 * @param {Array<object>} encryptedDeks Array of encrypted data keys (as JS objects).
 */
const grantMultipleRecordAccess = async (patientAddress, recordIds, grantee, durationInDays, encryptedDeks) => {
  if (!sponsorContract) throw new Error('Ethers service is not initialized.');
  try {
    const recordIdsBigInt = recordIds.map(id => BigInt(id));
    
    // Convert the JS objects into JSON strings, *then* convert to bytes.
    const encryptedDeksBytes = encryptedDeks.map(keyObject => ethers.toUtf8Bytes(JSON.stringify(keyObject)));
    
    return handleContractCall(
      'grantMultipleRecordAccess',
      sponsorContract.grantMultipleRecordAccess(patientAddress, recordIdsBigInt, grantee, BigInt(durationInDays), encryptedDeksBytes)
    );
  } catch (error) {
    // Catch errors from JSON.stringify or toUtf8Bytes
    logger.error(`Error encoding encrypted DEKs for grantMultipleRecordAccess: ${error.message}`);
    throw new Error(`Failed to encode encryption keys: ${error.message}`);
  }
};

/**
 * @dev Revokes access from multiple records, sponsored by the backend.
 * @param {string} patientAddress The patient's wallet address (owner).
 * @param {string} professional The address of the professional losing access.
 * @param {Array<string|number>} recordIds Array of record IDs to revoke.
 */
const revokeMultipleRecordAccess = async (patientAddress, professional, recordIds) => {
  if (!sponsorContract) throw new Error('Ethers service is not initialized.');
  const recordIdsBigInt = recordIds.map(id => BigInt(id));
  return handleContractCall(
    'revokeMultipleRecordAccess',
    sponsorContract.revokeMultipleRecordAccess(patientAddress, professional, recordIdsBigInt)
  );
};

/**
 * @dev Submits an access request from an insurance provider, sponsored by the backend.
 * @param {string} providerAddress The provider's wallet address.
 * @param {string} patientAddress The patient's wallet address.
 * @param {string} claimId The claim ID.
 */
const requestAccess = async (providerAddress, patientAddress, claimId) => {
  if (!sponsorContract) throw new Error('Ethers service is not initialized.');
  return handleContractCall(
    'requestAccess',
    sponsorContract.requestAccess(providerAddress, patientAddress, claimId)
  );
};

/**
 * @dev Approves an insurance request, sponsored by the backend on behalf of the patient.
 * @param {string} patientAddress The patient's wallet address.
 * @param {string|number} requestId The request ID.
 * @param {number} durationInDays The duration of access.
 */
const approveRequest = async (patientAddress, requestId, durationInDays) => {
  if (!sponsorContract) throw new Error('Ethers service is not initialized.');
  return handleContractCall(
    'approveRequest',
    sponsorContract.approveRequest(patientAddress, BigInt(requestId), BigInt(durationInDays))
  );
};

/**
 * @dev Submits a record access request from a professional, sponsored by the backend.
 * @param {string} professionalAddress The professional's wallet address.
 * @param {string} patientAddress The patient's wallet address.
 * @param {Array<string|number>} recordIds Array of record IDs being requested.
 */
const requestRecordAccess = async (professionalAddress, patientAddress, recordIds) => {
  if (!sponsorContract) throw new Error('Ethers service is not initialized.');
  const recordIdsBigInt = recordIds.map(id => BigInt(id));
  return handleContractCall(
    'requestRecordAccess',
    sponsorContract.requestRecordAccess(professionalAddress, patientAddress, recordIdsBigInt)
  );
};

/**
 * @dev Adds a self-uploaded record, sponsored by the backend.
 * @param {string} patientAddress The patient's wallet address.
 * @param {string} ipfsHash IPFS hash of the record.
 * @param {string} title Title of the record.
 * @param {string} category Category of the record.
 */
const addSelfUploadedRecord = async (patientAddress, ipfsHash, title, category) => {
  if (!sponsorContract) throw new Error('Ethers service is not initialized.');
  return handleContractCall(
    'addSelfUploadedRecord',
    sponsorContract.addSelfUploadedRecord(patientAddress, ipfsHash, title, category)
  );
};

/**
 * @dev Adds a verified record, sponsored by the backend.
 * @param {string} professionalAddress The professional's wallet address.
 * @param {string} patient The patient's wallet address.
 * @param {string} ipfsHash IPFS hash.
 * @param {string} title Title.
 * @param {string} category Category.
 * @param {string} encryptedKeyForPatient Encrypted key for the patient.
 * @param {string} encryptedKeyForHospital Encrypted key for the hospital.
 */
const addVerifiedRecord = async (professionalAddress, patient, ipfsHash, title, category, encryptedKeyForPatient, encryptedKeyForHospital) => {
  if (!sponsorContract) throw new Error('Ethers service is not initialized.');
  return handleContractCall(
    'addVerifiedRecord',
    sponsorContract.addVerifiedRecord(professionalAddress, patient, ipfsHash, title, category, encryptedKeyForPatient, encryptedKeyForHospital)
  );
};

/**
 * @dev Adds a batch of self-uploaded records, sponsored by the backend.
 * @param {string} patientAddress The patient's wallet address.
 * @param {Array<string>} ipfsHashes Array of IPFS hashes.
 * @param {Array<string>} titles Array of titles.
 * @param {Array<string>} categories Array of categories.
 */
const addSelfUploadedRecordsBatch = async (patientAddress, ipfsHashes, titles, categories) => {
  if (!sponsorContract) throw new Error('Ethers service is not initialized.');
  return handleContractCall(
    'addSelfUploadedRecordsBatch',
    sponsorContract.addSelfUploadedRecordsBatch(patientAddress, ipfsHashes, titles, categories)
  );
};

/**
 * @dev Adds a batch of verified records, sponsored by the backend.
 * @param {string} professionalAddress The professional's wallet address.
 * @param {string} patient The patient's wallet address.
 * @param {Array<string>} ipfsHashes Array of IPFS hashes.
 * @param {Array<string>} titles Array of titles.
 * @param {Array<string>} categories Array of categories.
 *S* @param {Array<string>} encryptedKeysForPatient Array of encrypted keys for the patient (as JSON strings).
 * @param {Array<string>} encryptedKeysForHospital Array of encrypted keys for the hospital (as JSON strings).
 */
const addVerifiedRecordsBatch = async (professionalAddress, patient, ipfsHashes, titles, categories, encryptedKeysForPatient, encryptedKeysForHospital) => {
  if (!sponsorContract) throw new Error('Ethers service is not initialized.');
  try {
    // --- [THIS IS THE FIX] ---
    // Convert the JSON strings back into bytes before sending to the contract.
    const keysForPatientBytes = encryptedKeysForPatient.map(keyString => ethers.toUtf8Bytes(keyString));
    const keysForHospitalBytes = encryptedKeysForHospital.map(keyString => ethers.toUtf8Bytes(keyString));
    // --- [END OF FIX] ---

    return handleContractCall(
      'addVerifiedRecordsBatch',
      sponsorContract.addVerifiedRecordsBatch(
        professionalAddress, 
        patient, 
        ipfsHashes, 
        titles, 
        categories, 
        keysForPatientBytes,  // Pass the converted bytes
        keysForHospitalBytes // Pass the converted bytes
      )
    );
  } catch (error) {
    // Catch errors from JSON.stringify or toUtf8Bytes
    logger.error(`Error encoding encrypted DEKs for addVerifiedRecordsBatch: ${error.message}`);
    throw new Error(`Failed to encode encryption keys: ${error.message}`);
  }
};


// [UNCHANGED] Initialize the service on load
init();

// [MODIFIED] Export all functions (Admin and new Sponsor functions)
// [FIX] Add 'ethers' and 'getAdminAddress' to exports
module.exports = {
  ethers, // Export ethers for the admin route
  getAdminAddress, // Export the admin address getter

  // Admin functions
  verifyHospital,
  revokeHospital,
  assignRole, 
  revokeRole,
  grantSponsorRole,
  revokeSponsorRole,

  // Sponsored User functions
  registerUser,
  savePublicKey,
  updateUserProfile,
  requestRegistration,
  grantRecordAccess,
  grantMultipleRecordAccess,
  revokeMultipleRecordAccess,
  requestAccess,
  approveRequest,
  requestRecordAccess,
  addSelfUploadedRecord,
  addVerifiedRecord,
  addSelfUploadedRecordsBatch,
  addVerifiedRecordsBatch,
};

