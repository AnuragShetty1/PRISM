"use client";
import { useState, useEffect, useRef } from 'react';
// CORRECTED: Using relative paths
import { useWeb3 } from '../context/Web3Context';
import toast from 'react-hot-toast';
import { ethers } from 'ethers';
import { rewrapSymmetricKey } from '../utils/crypto';
import { fetchFromIPFS } from '../utils/ipfs';
import ConfirmationModal from './ConfirmationModal';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, X, User, Clock, Loader2 } from 'lucide-react';

export default function AccessManager({
    isOpen,
    onClose,
    onGrantSuccess,
    records: initialRecords,
    preselectedRecords,
    preselectedProfessional
}) {
    // --- ALL LOGIC AND STATE UNCHANGED ---
    const { contract, keyPair, api } = useWeb3();

    const [granteeAddress, setGranteeAddress] = useState(preselectedProfessional?.address || '');
    const [duration, setDuration] = useState('30');
    const [customDuration, setCustomDuration] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const records = preselectedRecords || initialRecords || [];
    const finalDuration = duration === 'custom' ? Number(customDuration) : Number(duration);

    const [modalState, setModalState] = useState({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => { },
        confirmText: '',
        confirmColor: 'bg-indigo-600',
    });

    const closeModal = () => {
        if (isLoading) return;
        setModalState({ ...modalState, isOpen: false });
    };

    const openConfirm = () => {
        if (!ethers.isAddress(granteeAddress)) {
            toast.error("Please enter a valid Ethereum wallet address.");
            return;
        }
        if (!records || records.length === 0 || !contract || !keyPair || !api) {
            toast.error("Required context (records, contract, api, or key pair) is missing. Please reconnect wallet and try again.");
            return;
        }
        if (duration === 'custom' && (!customDuration || Number(customDuration) <= 0)) {
            toast.error("Please enter a valid number of days for the custom duration.");
            return;
        }

        const professionalName = preselectedProfessional?.name || granteeAddress;

        setModalState({
            isOpen: true,
            title: 'Confirm Access Grant',
            message: `Are you sure you want to grant access to ${records.length} record(s) for ${professionalName} for ${finalDuration} days?`,
            onConfirm: confirmGrantAccess,
            confirmText: 'Grant Access',
            confirmColor: 'bg-blue-600' // Use premium blue color
        });
    };

    const confirmGrantAccess = async () => {
        setIsLoading(true);
        const toastId = toast.loading("Verifying professional and checking permissions...");

        let recordIdsToGrant;
        let encryptedDeks;

        try {
            const professional = await contract.users(granteeAddress);
            if (professional.walletAddress === ethers.ZeroAddress || !professional.isVerified) {
                throw new Error("This address does not belong to a verified professional.");
            }
            if (Number(professional.role) === 0) {
                throw new Error("Cannot grant access to a patient.");
            }
            if (!professional.publicKey) {
                throw new Error("This professional has not set up their encryption key.");
            }

            toast.loading("Fetching encrypted data and preparing secure keys...", { id: toastId });

            const professionalPublicKey = professional.publicKey;
            recordIdsToGrant = records.map(r => r.recordId);

            encryptedDeks = await Promise.all(
                records.map(async (record) => {
                    const fullRecordData = await contract.records(record.recordId);
                    const ipfsHash = fullRecordData.ipfsHash;

                    if (!ipfsHash) {
                        throw new Error(`Critical error: Cannot find IPFS hash for record ${record.recordId}.`);
                    }
                    const response = await fetchFromIPFS(ipfsHash);
                    const metadata = await response.json();
                    const bundleHash = metadata.encryptedBundleIPFSHash;
                    const bundleResponse = await fetchFromIPFS(bundleHash);
                    const encryptedBundle = await bundleResponse.json();

                    const rewrappedDek = await rewrapSymmetricKey(
                        encryptedBundle,
                        keyPair.privateKey,
                        professionalPublicKey
                    );
                    return rewrappedDek;
                })
            );

            toast.loading("Sending sponsored transaction to the backend...", { id: toastId });

            // Use the correct API call based on record count
            if (records.length > 1) {
                await api.grantMultipleRecordAccess(granteeAddress, recordIdsToGrant, finalDuration, encryptedDeks);
            } else {
                await api.grantRecordAccess(granteeAddress, recordIdsToGrant[0], finalDuration, encryptedDeks[0]);
            }


            toast.success(`Access granted successfully for ${finalDuration} days!`, { id: toastId });

            const expirationTimestamp = new Date();
            expirationTimestamp.setDate(expirationTimestamp.getDate() + finalDuration);

            const grants = recordIdsToGrant.map((id, index) => ({
                recordId: id,
                rewrappedKey: encryptedDeks[index],
                expirationTimestamp: expirationTimestamp.toISOString(),
            }));

            if (onGrantSuccess) {
                onGrantSuccess(grants);
            } else {
                onClose();
            }
            closeModal();

        } catch (error) {
            console.error("Failed to grant access:", error);
            let errorMessage = "An unexpected error occurred.";
            if (error.reason) {
                errorMessage = error.reason;
            } else if (error.message) {
                errorMessage = error.message;
            }
            toast.error(errorMessage, { id: toastId });
        } finally {
            setIsLoading(false);
        }
    };

    const handleGrantAccessSubmit = async (e) => {
        e.preventDefault();
        openConfirm();
    };
    // --- END OF UNCHANGED LOGIC ---


    // --- REFACTORED: Render with framer-motion ---
    return (
        <>
            <AnimatePresence>
                {isOpen && (
                    <div
                        className="relative z-50"
                        aria-labelledby="modal-title"
                        role="dialog"
                        aria-modal="true"
                    >
                        {/* --- REFACTORED: Backdrop --- */}
                        <motion.div
                            className="fixed inset-0 bg-gray-900/50"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2, ease: "easeOut" }}
                            onClick={!isLoading ? onClose : undefined}
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
                                        <div className="flex items-center gap-3">
                                            <span className="flex-shrink-0 p-2 bg-blue-100 rounded-lg">
                                                <ShieldCheck className="h-6 w-6 text-blue-600" />
                                            </span>
                                            <h2 className="text-xl font-bold text-gray-900" id="modal-title">
                                                Approve Access
                                            </h2>
                                        </div>
                                        <button
                                            onClick={onClose}
                                            disabled={isLoading}
                                            className="p-1 rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors disabled:opacity-50"
                                        >
                                            <X className="w-6 h-6" />
                                        </button>
                                    </div>

                                    {/* --- REFACTORED: Body --- */}
                                    <form onSubmit={handleGrantAccessSubmit}>
                                        <div className="p-6 space-y-6">
                                            {/* --- NEW: Record Summary --- */}
                                            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-2">
                                                <p className="text-sm font-semibold text-gray-800">
                                                    You are approving access for:
                                                </p>
                                                <ul className="list-disc list-inside text-sm text-gray-600 max-h-24 overflow-y-auto">
                                                    {records.map((record, index) => (
                                                        <li key={record.recordId || `fallback-${index}`} className="truncate" title={record.title}>
                                                            {record.title || `Record ID: ${record.recordId}`}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>

                                            {/* --- REFACTORED: Grantee Address Input --- */}
                                            <div>
                                                <label htmlFor="granteeAddress" className="block text-sm font-semibold text-gray-700 mb-2">
                                                    Professionals Wallet Address
                                                </label>
                                                <div className="relative">
                                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                                                    <input
                                                        id="granteeAddress"
                                                        type="text"
                                                        value={granteeAddress}
                                                        onChange={(e) => setGranteeAddress(e.target.value)}
                                                        placeholder="Enter wallet address (0x...)"
                                                        className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 transition bg-gray-100"
                                                        required
                                                        disabled={true} // Always disabled in this flow
                                                    />
                                                </div>
                                            </div>

                                            {/* --- REFACTORED: Duration Select --- */}
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <div>
                                                    <label htmlFor="duration" className="block text-sm font-semibold text-gray-700 mb-2">
                                                        Grant Access For
                                                    </label>
                                                    <div className="relative">
                                                        <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                                                        <select
                                                            id="duration"
                                                            value={duration}
                                                            onChange={(e) => setDuration(e.target.value)}
                                                            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white disabled:bg-gray-100"
                                                            disabled={isLoading}
                                                        >
                                                            <option value={30}>30 Days</option>
                                                            <option value={90}>90 Days</option>
                                                            <option value={365}>1 Year</option>
                                                            <option value="custom">Custom...</option>
                                                        </select>
                                                    </div>
                                                </div>
                                                {duration === 'custom' && (
                                                    <div className="animate-fade-in">
                                                        <label htmlFor="customDuration" className="block text-sm font-semibold text-gray-700 mb-2">
                                                            Custom Days
                                                        </label>
                                                        <input
                                                            id="customDuration"
                                                            type="number"
                                                            min="1"
                                                            value={customDuration}
                                                            onChange={(e) => setCustomDuration(e.target.value)}
                                                            placeholder="e.g., 7"
                                                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                                                            required
                                                            disabled={isLoading}
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* --- REFACTORED: Footer --- */}
                                        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
                                            <button
                                                type="button"
                                                onClick={onClose}
                                                disabled={isLoading}
                                                className="inline-flex w-full justify-center rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:w-auto disabled:opacity-50"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                type="submit"
                                                disabled={isLoading}
                                                className="inline-flex w-full items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors bg-blue-600 hover:bg-blue-700 sm:w-auto disabled:bg-gray-400"
                                            >
                                                {isLoading ? (
                                                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                                ) : (
                                                    <ShieldCheck className="mr-2 h-5 w-5" />
                                                )}
                                                {isLoading ? 'Processing...' : 'Grant Access'}
                                            </button>
                                        </div>
                                    </form>
                                </motion.div>
                            </div>
                        </div>
                    </div>
                )}
            </AnimatePresence>

            {/* --- Confirmation Modal (Unchanged) --- */}
            <ConfirmationModal
                isOpen={modalState.isOpen}
                onClose={closeModal}
                onConfirm={modalState.onConfirm}
                title={modalState.title}
                message={modalState.message}
                confirmText={modalState.confirmText}
                confirmColor={modalState.confirmColor}
                isLoading={isLoading}
            />
        </>
    );
}

// Simple fade-in animation for custom duration
// Adding this style block as it's not part of the original file
if (typeof window === 'object') {
    const style = document.createElement('style');
    style.innerHTML = `
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        .animate-fade-in {
            animation: fadeIn 0.3s ease-out forwards;
        }
    `;
    document.head.appendChild(style);
}
