const mongoose = require('mongoose');

const registrationRequestSchema = new mongoose.Schema({
    requestId: {
        type: Number,
        required: true,
        unique: true,
        index: true,
    },
    hospitalName: {
        type: String,
        required: true,
    },
    requesterAddress: {
        type: String,
        required: true,
        lowercase: true,
    },
    // --- [CHANGE] ---
    // Added 'verifying' and 'failed' to the enum to track in-progress transactions.
    status: {
        type: String,
        enum: ['pending', 'verifying', 'approved', 'failed'],
        default: 'pending',
    },
}, { timestamps: true });

const RegistrationRequest = mongoose.model('RegistrationRequest', registrationRequestSchema);

module.exports = RegistrationRequest;
