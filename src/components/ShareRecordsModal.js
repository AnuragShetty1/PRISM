"use client";

import { useState, useEffect, useMemo } from 'react';
// CORRECTED: Using relative paths
import { useWeb3 } from '../context/Web3Context';
import axios from 'axios';
import toast from 'react-hot-toast';
import { rewrapSymmetricKey } from '../utils/crypto';
import { fetchFromIPFS } from '../utils/ipfs';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Share, Building, Stethoscope, Loader2 } from 'lucide-react';

export default function ShareRecordsModal({ records, recordsToShare, onClose }) {
    const { contract, keyPair, api } = useWeb3();

    const [hospitals, setHospitals] = useState([]);
    const [professionals, setProfessionals] = useState([]);
    const [selectedHospital, setSelectedHospital] = useState('');
    const [selectedProfessionalAddress, setSelectedProfessionalAddress] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);

    // --- MODIFICATION: Add API_BASE_URL for deployment ---
    const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';

    // Fetch all hospitals when the modal mounts (UNCHANGED LOGIC)
    useEffect(() => {
        const fetchHospitals = async () => {
            try {
                // --- MODIFICATION: Use API_BASE_URL ---
                const response = await axios.get(`${API_BASE_URL}/api/users/hospitals`);
                if (response.data.success) {
                    setHospitals(response.data.data);
                }
            } catch (error) {
                console.error("Failed to fetch hospitals:", error);
                toast.error("Could not fetch hospitals list.");
            }
        };
        fetchHospitals();
    }, [API_BASE_URL]); // --- MODIFICATION: Add API_BASE_URL dependency ---

    // Fetch professionals when a hospital is selected (UNCHANGED LOGIC)
    useEffect(() => {
        const fetchProfessionals = async () => {
            if (!selectedHospital) {
                setProfessionals([]);
                setSelectedProfessionalAddress('');
                return;
            }
            try {
                // --- MODIFICATION: Use API_BASE_URL ---
                const response = await axios.get(`${API_BASE_URL}/api/users/hospitals/${selectedHospital}/professionals`);
                if (response.data.success) {
                    setProfessionals(response.data.data);
                }
            } catch (error) {
                console.error("Failed to fetch professionals:", error);
                toast.error("Could not fetch professionals list.");
            }
        };
        fetchProfessionals();
    }, [selectedHospital, API_BASE_URL]); // --- MODIFICATION: Add API_BASE_URL dependency ---

    // Handle Grant Access Logic (UNCHANGED LOGIC)
    const handleGrantAccess = async () => {
        if (!api || !keyPair?.privateKey || !selectedProfessionalAddress || recordsToShare.length === 0) {
            toast.error("Cannot proceed. Required information (api, key, professional) is missing.");
            return;
        }

        setIsProcessing(true);
        const toastId = toast.loading("Preparing secure access...");

        try {
            const professionalUser = professionals.find(p => p.address === selectedProfessionalAddress);
            if (!professionalUser?.publicKey) {
                throw new Error("Professional's public key not found.");
            }

            toast.loading("Fetching encryption bundles and re-wrapping keys...", { id: toastId });

            const rewrappedKeys = await Promise.all(
                recordsToShare.map(async (recordId) => {
                    const record = records.find(r => r.recordId === recordId);
                    if (!record) throw new Error(`Record with ID ${recordId} not found.`);

                    const metaResponse = await fetchFromIPFS(record.ipfsHash);
                    const metadata = await metaResponse.json();

                    const bundleResponse = await fetchFromIPFS(metadata.encryptedBundleIPFSHash);
                    const encryptedBundle = await bundleResponse.json();

                    return await rewrapSymmetricKey(encryptedBundle, keyPair.privateKey, professionalUser.publicKey);
                })
            );

            toast.loading("Sending sponsored transaction to the backend...", { id: toastId });
            const durationInDays = 30; // Default duration

            await api.grantMultipleRecordAccess(selectedProfessionalAddress, recordsToShare, durationInDays, rewrappedKeys);

            toast.success("Access granted successfully!", { id: toastId });
            onClose(); // Close the modal on success

        } catch (error) {
            console.error("Failed to grant access:", error);
            toast.error(error.message || "An unexpected error occurred.", { id: toastId });
        } finally {
            setIsProcessing(false);
        }
    };

    // --- NEW: Memoized list of record titles for summary ---
    const recordsToShareDetails = useMemo(() => {
        return records
            .filter(r => recordsToShare.includes(r.recordId))
            .map(r => r.title);
    }, [records, recordsToShare]);


    return (
        <AnimatePresence>
            {/* --- REFACTORED: Root and Backdrop --- */}
            <div
                className="relative z-50"
                aria-labelledby="modal-title"
                role="dialog"
                aria-modal="true"
            >
                <motion.div
                    className="fixed inset-0 bg-gray-900/50"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    onClick={!isProcessing ? onClose : undefined}
                />

                <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
                    <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
                        {/* --- REFACTORED: Modal Panel --- */}
                        <motion.div
                            className="relative transform overflow-hidden rounded-2xl bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg"
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            transition={{ duration: 0.2, ease: "easeOut" }}
                        >
                            {/* --- REFACTORED: Header --- */}
                            <div className="flex justify-between items-center p-6 border-b border-gray-200">
                                <h2 className="text-xl font-bold text-gray-900" id="modal-title">
                                    Share Medical Records
                                </h2>
                                <button
                                    onClick={onClose}
                                    disabled={isProcessing}
                                    className="p-1 rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors disabled:opacity-50"
                                >
                                    <X className="w-6 h-6" />
                                </button>
                            </div>

                            {/* --- REFACTORED: Body --- */}
                            <div className="p-6 space-y-6">
                                {/* --- NEW: Record Summary --- */}
                                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-2">
                                    <p className="text-sm font-semibold text-gray-800">
                                        You are about to share {recordsToShare.length} record(s):
                                    </p>
                                    <ul className="list-disc list-inside text-sm text-gray-600 max-h-24 overflow-y-auto">
                                        {recordsToShareDetails.slice(0, 2).map((title, index) => (
                                            <li key={index} className="truncate">{title}</li>
                                        ))}
                                        {recordsToShareDetails.length === 3 && (
                                            <li key={2} className="truncate">{recordsToShareDetails[2]}</li>
                                        )}
                                        {recordsToShareDetails.length > 3 && (
                                            <li className="text-gray-500 italic">...and {recordsToShareDetails.length - 2} more</li>
                                        )}
                                    </ul>
                                </div>

                                {/* --- REFACTORED: Hospital Select --- */}
                                <div>
                                    <label htmlFor="hospital-select" className="block text-sm font-semibold text-gray-700 mb-2">
                                        1. Select a Hospital
                                    </label>
                                    <div className="relative">
                                        <Building className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                                        <select
                                            id="hospital-select"
                                            value={selectedHospital}
                                            onChange={(e) => setSelectedHospital(e.target.value)}
                                            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                        >
                                            <option value="">-- Choose a hospital --</option>
                                            {hospitals.map(hospital => (
                                                <option key={hospital._id} value={hospital.hospitalId}>
                                                    {hospital.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {/* --- REFACTORED: Professional Select --- */}
                                <div>
                                    <label htmlFor="professional-select" className="block text-sm font-semibold text-gray-700 mb-2">
                                        2. Select a Healthcare Professional
                                    </label>
                                    <div className="relative">
                                        <Stethoscope className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                                        <select
                                            id="professional-select"
                                            value={selectedProfessionalAddress}
                                            onChange={(e) => setSelectedProfessionalAddress(e.target.value)}
                                            disabled={!selectedHospital || professionals.length === 0}
                                            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white disabled:bg-gray-100"
                                        >
                                            <option value="">-- Choose a professional --</option>
                                            {professionals.map(prof => (
                                                <option key={prof._id} value={prof.address}>
                                                    {prof.name} ({prof.role})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    {selectedHospital && professionals.length === 0 && (
                                        <p className="text-xs text-gray-500 mt-1">No professionals found for this hospital.</p>
                                    )}
                                </div>
                            </div>

                            {/* --- REFACTORED: Footer --- */}
                            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    disabled={isProcessing}
                                    className="inline-flex w-full justify-center rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:w-auto disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleGrantAccess}
                                    disabled={!selectedProfessionalAddress || isProcessing}
                                    className="inline-flex w-full items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors bg-blue-600 hover:bg-blue-700 sm:w-auto disabled:bg-gray-400"
                                >
                                    {isProcessing ? (
                                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                    ) : (
                                        <Share className="mr-2 h-5 w-5" />
                                    )}
                                    {isProcessing ? 'Processing...' : `Share ${recordsToShare.length} Record(s)`}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                </div>
            </div>
        </AnimatePresence>
    );
}
