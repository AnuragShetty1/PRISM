const mongoose = require('mongoose');

const accessGrantSchema = new mongoose.Schema({
    recordId: {
        type: Number,
        required: true,
        index: true,
    },
    patientAddress: {
        type: String,
        required: true,
        lowercase: true,
    },
    professionalAddress: {
        type: String,
        required: true,
        lowercase: true,
        index: true,
    },
    // FIX: This field is required to store the decrypted key for the professional.
    rewrappedKey: {
        type: String,
        required: true,
    },
    // FIX: This field is required to know when the access expires.
    expirationTimestamp: {
        type: Date,
        required: true,
    }
}, { 
    timestamps: { createdAt: true, updatedAt: false }
});

// FIX: This ensures a professional cannot have duplicate access grants for the same record.
accessGrantSchema.index({ recordId: 1, professionalAddress: 1 }, { unique: true });


const AccessGrant = mongoose.model('AccessGrant', accessGrantSchema);

module.exports = AccessGrant;
