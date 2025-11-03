const express = require('express');
const router = express.Router();
const Hospital = require('../../models/Hospital');
const User = require('../../models/User');
const logger = require('../../utils/logger');
const ethersService = require('../../services/ethersService');

// [NEW] Import custom error classes
const {
  BadRequestError,
  NotFoundError,
  ConflictError,
  ApiError, // Import ApiError for custom 500-level errors
} = require('../../utils/errors');

// Helper function to extract a readable revert reason from a raw Ethers error
const extractRevertReason = (error) => {
  // Attempt to extract the reason from common Ethers error structures (v5/v6)
  if (error.reason && typeof error.reason === 'string' && error.reason.length > 0) {
    return error.reason;
  }
  if (error.data && error.data.message) {
    // e.g., 'execution reverted: NotHospitalAdmin'
    return error.data.message.replace('execution reverted: ', '').trim();
  }
  if (error.message && error.message.includes('revert')) {
    // Fallback for generic message that might contain the revert reason
    const match = error.message.match(/revert (.*?)(?=[,.]|$)/);
    if (match && match[1]) return match[1].trim();
  }

  // Return a generic error if no specific reason is found
  return 'The smart contract transaction failed with an unknown error.';
};

/**
 * @route   GET /api/hospital-admin/hospitals/search
 * @desc    Search for active hospitals by name (case-insensitive)
 * @access  Public (for professionals during registration)
 */
router.get('/hospitals/search', async (req, res, next) => {
  try {
    const { name } = req.query;
    if (!name || name.trim().length < 2) {
      return res.json({ success: true, hospitals: [] });
    }

    const hospitals = await Hospital.find({
      name: { $regex: name, $options: 'i' }, // Case-insensitive regex search
      status: 'active',
    }).limit(10); // Limit results for performance

    res.json({ success: true, hospitals });
  } catch (error) {
    logger.error(`Error searching for hospitals:`, error);
    next(error);
  }
});

/**
 * @route   GET /api/hospital-admin/requests/:hospitalId
 * @desc    Get all pending professional affiliation requests for the admin's hospital
 * @access  Private (Hospital Admin only)
 */
router.get('/requests/:hospitalId', async (req, res, next) => {
  try {
    const { hospitalId } = req.params;
    const requests = await User.find({
      requestedHospitalId: hospitalId,
      professionalStatus: { $in: ['pending', 'verifying'] },
    }).select('address name role professionalStatus');

    res.json({ success: true, data: requests });
  } catch (error) {
    logger.error(`Error fetching affiliation requests:`, error);
    next(error);
  }
});

/**
 * @route   GET /api/hospital-admin/professionals/:hospitalId
 * @desc    Get all verified professionals for the admin's hospital, excluding the admin themselves.
 * @access  Private (Hospital Admin only)
 */
router.get('/professionals/:hospitalId', async (req, res, next) => {
  try {
    const { hospitalId } = req.params;

    // Step 1: Find the hospital record to get the admin's address.
    const hospital = await Hospital.findOne({ hospitalId: hospitalId });

    // If the hospital doesn't exist, there are no professionals to return.
    if (!hospital) {
      return res.json({ success: true, data: [] });
    }

    // Step 2: Get the admin's address from the hospital document.
    const adminAddress = hospital.adminAddress;

    // Step 3: Construct a query to find all users for this hospital
    // while explicitly excluding the admin's address.
    const query = {
      hospitalId: hospitalId,
      professionalStatus: { $in: ['approved', 'revoking'] },
      address: { $ne: adminAddress }, // Exclude the admin by their specific address
    };

    const professionals = await User.find(query).select(
      'address name role professionalStatus'
    );

    res.json({ success: true, data: professionals });
  } catch (error) {
    logger.error(`Error fetching professionals:`, error);
    next(error);
  }
});

/**
 * @route   POST /api/hospital-admin/verify-professional
 * @desc    Verifies a professional by assigning them a role via the smart contract.
 * @access  Private (Hospital Admin only)
 */
// [MODIFIED] Updated to use next(error) for error handling
router.post('/verify-professional', async (req, res, next) => {
  const { professionalAddress, hospitalId, role } = req.body;

  try {
    if (
      !professionalAddress ||
      hospitalId === undefined ||
      hospitalId === null ||
      !role
    ) {
      throw new BadRequestError(
        'Professional address, hospital ID, and role are required.'
      );
    }

    logger.info(
      `Verification process started for professional: ${professionalAddress}`
    );

    const user = await User.findOneAndUpdate(
      {
        address: professionalAddress,
        requestedHospitalId: hospitalId,
        professionalStatus: 'pending',
      },
      { $set: { professionalStatus: 'verifying' } },
      { new: true }
    );

    if (!user) {
      logger.warn(
        `Professional ${professionalAddress} is not in a pending state for this hospital.`
      );
      throw new ConflictError('Request is not pending or does not exist.');
    }

    // The Smart Contract now allows the Super Admin (signer) to assign the role.
    const tx = await ethersService.assignRole(
      professionalAddress,
      hospitalId,
      role
    );
    logger.info(`Transaction sent. Hash: ${tx.hash}. Waiting for confirmation...`);

    await tx.wait(1);
    logger.info(
      `Transaction confirmed. The indexer will now handle the final 'approved' status.`
    );

    res.json({
      success: true,
      message: 'Professional verification transaction was successfully confirmed.',
    });
  } catch (error) {
    logger.error(
      `On-chain verification failed for professional ${professionalAddress}:`,
      error
    );

    // Revert status on failure
    await User.findOneAndUpdate(
      { address: professionalAddress },
      { $set: { professionalStatus: 'pending' } }
    );

    // Use the new helper to get a specific reason
    const reason = extractRevertReason(error);
    // Pass a 500-level error to the global handler
    next(new ApiError(reason, 500));
  }
});

/**
 * @route   POST /api/hospital-admin/revoke-professional
 * @desc    Revokes a professional's role via the smart contract.
 * @access  Private (Hospital Admin only)
 */
// [MODIFIED] Updated to use next(error) for error handling
router.post('/revoke-professional', async (req, res, next) => {
  // FIX: Destructure hospitalId from the request body, which is now sent by the frontend.
  const { professionalAddress, hospitalId } = req.body;

  try {
    // FIX: Validate hospitalId.
    if (!professionalAddress || hospitalId === undefined || hospitalId === null) {
      throw new BadRequestError(
        'Professional address and hospital ID are required.'
      );
    }

    logger.info(
      `Revocation process started for professional: ${professionalAddress} at hospital ${hospitalId}`
    );

    // FIX: Add hospitalId to the query to ensure the professional belongs to the admin's hospital.
    const user = await User.findOne({
      address: professionalAddress,
      professionalStatus: 'approved',
      hospitalId: hospitalId,
    });

    // FIX: Update the check and error message to be more specific.
    if (!user || user.role === 'Patient') {
      logger.warn(
        `Professional ${professionalAddress} is not in an approved state for hospital ${hospitalId}.`
      );
      throw new ConflictError(
        'Professional is not approved or does not exist for this hospital.'
      );
    }

    // The role and hospitalId from the user document are now reliably correct.
    const { role } = user;

    // Transition status to revoking in MongoDB
    await User.updateOne(
      { _id: user._id },
      { $set: { professionalStatus: 'revoking' } }
    );

    // The Smart Contract now allows the Super Admin (signer) to revoke the role.
    const tx = await ethersService.revokeRole(
      professionalAddress,
      role,
      user.hospitalId
    );
    logger.info(`Transaction sent. Hash: ${tx.hash}. Waiting for confirmation...`);

    await tx.wait(1);
    logger.info(
      `Transaction confirmed. The indexer will now handle the final 'revoked' status.`
    );

    res.json({
      success: true,
      message: 'Professional revocation transaction was successfully confirmed.',
    });
  } catch (error) {
    logger.error(
      `On-chain revocation failed for professional ${professionalAddress}:`,
      error
    );

    // Revert status on failure
    // FIX: Make the revert query specific to the user at that hospital.
    await User.findOneAndUpdate(
      { address: professionalAddress, hospitalId: hospitalId },
      { $set: { professionalStatus: 'approved' } }
    );

    const reason = extractRevertReason(error);
    // Pass a 500-level error to the global handler
    next(new ApiError(reason, 500));
  }
});

/**
 * @route   POST /api/hospital-admin/reject-professional
 * @desc    Rejects a professional's affiliation request by updating their status.
 * @access  Private (Hospital Admin only)
 */
// [MODIFIED] Updated to use next(error) for error handling
router.post('/reject-professional', async (req, res, next) => {
  const { professionalAddress, hospitalId } = req.body;

  try {
    if (!professionalAddress || hospitalId === undefined || hospitalId === null) {
      throw new BadRequestError(
        'Professional address and hospital ID are required.'
      );
    }

    logger.info(
      `Rejection process started for professional: ${professionalAddress} at hospital ${hospitalId}`
    );

    const user = await User.findOneAndUpdate(
      {
        address: professionalAddress,
        requestedHospitalId: hospitalId,
        professionalStatus: 'pending',
      },
      {
        $set: { professionalStatus: 'rejected' },
      },
      { new: true }
    );

    if (!user) {
      logger.warn(
        `Attempted to reject a non-pending or non-existent request for ${professionalAddress}.`
      );
      throw new NotFoundError(
        'No pending request found for this professional at this hospital.'
      );
    }

    logger.info(
      `Successfully rejected professional ${professionalAddress} for hospital ${hospitalId}.`
    );
    res.json({
      success: true,
      message: 'Professional affiliation request has been rejected.',
    });
  } catch (error) {
    logger.error(`Failed to reject professional ${professionalAddress}:`, error);
    next(error);
  }
});

module.exports = router;
