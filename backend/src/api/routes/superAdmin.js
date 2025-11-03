const express = require('express');
const router = express.Router();
const Hospital = require('../../models/Hospital');
const RegistrationRequest = require('../../models/RegistrationRequest');
const ethersService = require('../../services/ethersService');
const logger = require('../../utils/logger');
const { ethers } = require('ethers'); // [NEW] Import ethers for verification

// [NEW] Import custom error classes
const {
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  ApiError,
} = require('../../utils/errors');

// [NEW] Admin Auth Middleware (Model 2: Web 3.0 Signature)
/**
 * @brief Middleware to verify the request is from the contract owner.
 * It uses a signed message (Web 3.0) instead of a JWT (Web 2.0).
 */
// [MODIFIED] Updated to use next(error) for error handling
const adminAuth = async (req, res, next) => {
  try {
    const { signature, address } = req.body; // 'address' is the target sponsor address

    if (!signature) {
      logger.warn('Admin action denied. Missing signature.');
      throw new UnauthorizedError('Missing required admin signature.');
    }

    // 1. Reconstruct the message that the frontend signed.
    const action = req.path.includes('grant') ? 'GRANT' : 'REVOKE';
    // This message *must* match the frontend (SuperAdminDashboard.js) exactly.
    const message = `Confirming Super Admin Action: ${action} for ${address}`;

    // 2. Recover the address from the signature
    const recoveredAddress = ethers.verifyMessage(message, signature);

    // 3. Get the *actual* owner address from our ethersService.
    // This requires ethersService to expose the owner's address.
    const ownerAddress = await ethersService.getAdminAddress();

    // 4. Compare
    if (recoveredAddress.toLowerCase() !== ownerAddress.toLowerCase()) {
      logger.warn(
        `Admin auth failed. Signer: ${recoveredAddress}, Owner: ${ownerAddress}`
      );
      throw new ForbiddenError('Forbidden: Signer is not the contract owner.');
    }

    // 5. Success
    logger.info(`Admin action by ${recoveredAddress} authenticated.`);
    next(); // Proceed to the route handler
  } catch (error) {
    logger.error('Admin auth middleware error:', error);
    // This often fails if the signature is invalid or the message doesn't match
    // Pass the error to the global handler
    if (error instanceof ApiError) {
      next(error);
    } else {
      next(new UnauthorizedError('Invalid signature or auth error.'));
    }
  }
};

/**
 * @route   GET /api/super-admin/requests
 * @desc    Fetch all pending and in-progress hospital registration requests
 * @access  Public (for now)
 */
router.get('/requests', async (req, res, next) => {
  try {
    const pendingRequests = await RegistrationRequest.find({
      status: { $in: ['pending_hospital', 'verifying'] },
    }).sort({ createdAt: -1 });

    res.json({ success: true, data: pendingRequests });
  } catch (error) { // [FIX] Restored the missing catch block
    logger.error('Error fetching pending requests:', error);
    next(error);
  }
});

/**
 * @route   GET /api/super-admin/hospitals
 * @desc    Fetch all ACTIVE hospitals
 * @access  Public (for now)
 */
router.get('/hospitals', async (req, res, next) => {
  try {
    const verifiedHospitals = await Hospital.find({
      status: 'active',
    }).sort({ createdAt: -1 });
    res.json({ success: true, data: verifiedHospitals });
  } catch (error) { // [FIX] Restored the missing catch block
    logger.error('Error fetching verified hospitals:', error);
    next(error);
  }
});

/**
 * @route   POST /api/super-admin/verify-hospital
 * @desc    Marks a request as 'verifying', sends the transaction, and waits for confirmation.
 * @access  Public (for now) - [UNCHANGED]
 */
// [MODIFIED] Updated to use next(error) for error handling
router.post('/verify-hospital', async (req, res, next) => {
  const { requestId, adminAddress } = req.body;
  const numericRequestId = Number(requestId);

  try {
    if (requestId === undefined || !adminAddress) {
      throw new BadRequestError('A valid Request ID and Admin Address are required.');
    }

    logger.info(`Verification process started for request ID: ${numericRequestId}`);

    const request = await RegistrationRequest.findOneAndUpdate(
      { requestId: numericRequestId, status: 'pending_hospital' },
      { $set: { status: 'verifying' } },
      { new: true }
    );

    if (!request) {
      logger.warn(
        `Request ID ${numericRequestId} is not in a pending state. It may already be processing.`
      );
      throw new ConflictError('Request is not pending or has already been processed.');
    }

    const tx = await ethersService.verifyHospital(numericRequestId, adminAddress);
    logger.info(`Transaction sent. Hash: ${tx.hash}. Waiting for confirmation...`);

    const receipt = await tx.wait(1);
    logger.info(
      `Transaction confirmed in block: ${receipt.blockNumber}. The indexer will now handle the final 'approved' status.`
    );

    res.json({
      success: true,
      message: 'Hospital verification transaction was successfully confirmed on-chain.',
    });
  } catch (error) {
    logger.error(
      `On-chain verification failed for request ID ${numericRequestId}:`,
      error
    );

    await RegistrationRequest.findOneAndUpdate(
      { requestId: numericRequestId },
      { $set: { status: 'failed' } }
    );

    const reason = error.reason || 'An error occurred during the blockchain transaction.';
    // Pass a 500-level error to the global handler
    next(new ApiError(reason, 500));
  }
});

/**
 * @route   POST /api/super-admin/revoke-hospital
 * @desc    Marks a hospital as 'revoking', sends the transaction, and waits for confirmation.
 * @access  Public (for now) - [UNCHANGED]
 */
// [MODIFIED] Updated to use next(error) for error handling
router.post('/revoke-hospital', async (req, res, next) => {
  const { hospitalId } = req.body;
  const numericHospitalId = Number(hospitalId);

  try {
    if (hospitalId === undefined) {
      throw new BadRequestError('A valid Hospital ID is required.');
    }

    logger.info(`Revocation process started for hospital ID: ${numericHospitalId}`);

    const hospital = await Hospital.findOneAndUpdate(
      { hospitalId: numericHospitalId, status: 'active' },
      { $set: { status: 'revoking' } },
      { new: true }
    );

    if (!hospital) {
      logger.warn(`Hospital ID ${numericHospitalId} is not in an active state.`);
      throw new ConflictError('Hospital is not active or has already been revoked.');
    }

    const tx = await ethersService.revokeHospital(numericHospitalId);
    logger.info(`Transaction sent. Hash: ${tx.hash}. Waiting for confirmation...`);

    await tx.wait(1);
    logger.info(
      `Transaction confirmed. The indexer will now handle the final 'revoked' status.`
    );

    res.json({
      success: true,
      message: 'Hospital revocation transaction was successfully confirmed on-chain.',
    });
  } catch (error) {
    logger.error(
      `On-chain revocation failed for hospital ID ${numericHospitalId}:`,
      error
    );

    await Hospital.findOneAndUpdate(
      { hospitalId: numericHospitalId },
      { $set: { status: 'active' } }
    );

    const reason = error.reason || 'An error occurred during the blockchain transaction.';
    // Pass a 500-level error to the global handler
    next(new ApiError(reason, 500));
  }
});

/**
 * @route   POST /api/super-admin/reject-hospital
 * @desc    Rejects a pending hospital registration request.
 * @access  Public (for now) - [UNCHANGED]
 */
// [MODIFIED] Updated to use next(error) for error handling
router.post('/reject-hospital', async (req, res, next) => {
  const { requestId } = req.body;
  const numericRequestId = Number(requestId);

  try {
    if (requestId === undefined) {
      throw new BadRequestError('A valid Request ID is required.');
    }

    logger.info(`Rejection process started for request ID: ${numericRequestId}`);

    const request = await RegistrationRequest.findOneAndUpdate(
      { requestId: numericRequestId, status: 'pending_hospital' },
      { $set: { status: 'rejected' } },
      { new: true }
    );

    if (!request) {
      logger.warn(
        `Request ID ${numericRequestId} not found or not in a pending state.`
      );
      throw new NotFoundError('Request not found or it is not in a pending state.');
    }

    logger.info(`Successfully rejected request ID: ${numericRequestId}`);
    res.json({
      success: true,
      message: 'Hospital request has been rejected.',
    });
  } catch (error) {
    logger.error(`Failed to reject request ID ${numericRequestId}:`, error);
    next(error);
  }
});

// --- [NEW] SPONSOR MANAGEMENT ROUTES ---

/**
 * @route   POST /api/super-admin/grant-sponsor
 * @desc    Grants the sponsor role to a wallet address.
 * @access  Super Admin (Signature-Verified)
 */
// [MODIFIED] Added the adminAuth middleware and updated to use next(error)
router.post('/grant-sponsor', adminAuth, async (req, res, next) => {
  const { address } = req.body;
  try {
    if (!address || !ethersService.ethers.isAddress(address)) {
      throw new BadRequestError('A valid sponsor wallet address is required.');
    }

    logger.info(`Attempting to grant sponsor role to: ${address}`);

    const tx = await ethersService.grantSponsorRole(address);
    logger.info(
      `Grant sponsor transaction sent. Hash: ${tx.hash}. Waiting for confirmation...`
    );

    await tx.wait(1);
    logger.info(`Transaction confirmed. Sponsor role granted to ${address}.`);

    res.json({
      success: true,
      message: `Sponsor role successfully granted to ${address}.`,
    });
  } catch (error) {
    logger.error(`Failed to grant sponsor role to ${address}:`, error);
    const reason = error.reason || 'An error occurred during the blockchain transaction.';
    // Pass a 500-level error to the global handler
    next(new ApiError(reason, 500));
  }
});

/**
 * @route   POST /api/super-admin/revoke-sponsor
 * @desc    Revokes the sponsor role from a wallet address.
 * @access  Super Admin (Signature-Verified)
 */
// [MODIFIED] Added the adminAuth middleware and updated to use next(error)
router.post('/revoke-sponsor', adminAuth, async (req, res, next) => {
  const { address } = req.body;
  try {
    if (!address || !ethersService.ethers.isAddress(address)) {
      // [FIX] Corrected '4M00' to '400'
      throw new BadRequestError('A valid sponsor wallet address is required.');
    }

    logger.info(`Attempting to revoke sponsor role from: ${address}`);

    const tx = await ethersService.revokeSponsorRole(address);
    logger.info(
      `Revoke sponsor transaction sent. Hash: ${tx.hash}. Waiting for confirmation...`
    );

    await tx.wait(1);
    logger.info(`Transaction confirmed. Sponsor role revoked from ${address}.`);

    res.json({
      success: true,
      message: `Sponsor role successfully revoked from ${address}.`,
    });
  } catch (error) {
    logger.error(`Failed to revoke sponsor role from ${address}:`, error);
    const reason = error.reason || 'An error occurred during the blockchain transaction.';
    // [FIX] Corrected '5D00' to '500'
    // Pass a 500-level error to the global handler
    next(new ApiError(reason, 500));
  }
});

module.exports = router;
