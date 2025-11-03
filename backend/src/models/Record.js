const mongoose = require('mongoose');

const recordSchema = new mongoose.Schema({
    recordId: {
        type: Number,
        required: true,
        unique: true,
        index: true,
    },
    owner: { // <-- RENAMED from patientAddress to match event
        type: String,
        required: true,
        lowercase: true,
        index: true,
    },
    title: { // <-- ADDED
        type: String,
        required: true,
        index: true 
    },
    ipfsHash: {
        type: String,
        required: true,
    },
    category: { // <-- ADDED
        type: String,
    },
    isVerified: { // <-- ADDED
        type: Boolean,
        default: false,
    },
    uploadedBy: {
        type: String,
        required: true,
        lowercase: true,
    },
    timestamp: { // <-- ADDED
        type: Date,
        required: true,
    },
}, { timestamps: true });

// For text search functionality on the title
recordSchema.index({ title: 'text' });

const Record = mongoose.model('Record', recordSchema);

module.exports = Record;
