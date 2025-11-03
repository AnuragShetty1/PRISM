const mongoose = require('mongoose');

const accessRequestSchema = new mongoose.Schema({
    requestId: {
        type: Number,
        required: true,
        unique: true,
        index: true,
    },
    recordIds: [{
        type: Number,
        required: true,
    }],
    professionalAddress: {
        type: String,
        required: true,
        trim: true,
        index: true,
    },
    patientAddress: {
        type: String,
        required: true,
        trim: true,
        index: true,
    },
    status: {
        type: String,
        required: true,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending',
    },
}, { timestamps: true });

// FIX: Changed from 'export default' to 'module.exports' to align with CommonJS imports in the indexer.
module.exports = mongoose.model('AccessRequest', accessRequestSchema);

