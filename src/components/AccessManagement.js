"use client";

import { useState, useEffect } from 'react';
import { useWeb3 } from '../context/Web3Context';
import axios from 'axios';
import toast from 'react-hot-toast';
import ConfirmationModal from './ConfirmationModal';
import { motion, AnimatePresence } from 'framer-motion';
import { Stethoscope, Copy, Users, Loader2, ShieldCheck } from 'lucide-react';

// --- ANIMATION VARIANTS (from theme) ---
const gridVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.05,
        },
    },
};

const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: (i) => ({
        opacity: 1,
        y: 0,
        transition: {
            delay: i * 0.05,
        },
    }),
};

export default function AccessManagement() {
    // --- STATE AND LOGIC (UNCHANGED) ---
    const { account, contract, api } = useWeb3();
    const [grants, setGrants] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRevoking, setIsRevoking] = useState(null);

    const [modalState, setModalState] = useState({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => { },
        confirmText: '',
        confirmColor: 'bg-indigo-600',
    });

    const closeModal = () => {
        if (isRevoking) return;
        setModalState({ ...modalState, isOpen: false });
    };

    const openConfirm = (grant) => {
        setModalState({
            isOpen: true,
            title: 'Revoke Access',
            message: `Are you sure you want to revoke access for ${grant.professionalName} (${grant.hospitalName}) to ${grant.recordIds.length} record(s)? This action cannot be undone.`,
            onConfirm: () => handleRevoke(grant.professionalAddress, grant.recordIds),
            confirmText: 'Revoke Access',
            confirmColor: 'bg-red-600'
        });
    };

    const fetchGrants = async () => {
        if (!account) return;
        setIsLoading(true);
        try {
            const response = await axios.get(`http://localhost:3001/api/users/access-grants/patient/${account}`);
            if (response.data.success) {
                const sortedGrants = (response.data.data || []).sort((a, b) => a.professionalName.localeCompare(b.professionalName));
                setGrants(sortedGrants);
            }
        } catch (error) {
            console.error("Failed to fetch access grants:", error);
            toast.error("Could not fetch your active grants.");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (account) fetchGrants();
    }, [account]);

    const handleRevoke = async (professionalAddress, recordIds) => {
        if (!api) {
            toast.error("API service not available.");
            return;
        }
        setIsRevoking(professionalAddress);
        const toastId = toast.loading("Preparing revocation transaction...");
        try {
            await api.revokeRecordAccess(professionalAddress, recordIds);
            toast.success("Access successfully revoked! The list will update shortly.", { id: toastId });
            setTimeout(fetchGrants, 4000);
        } catch (error) {
            console.error("Revocation failed:", error);
            toast.error(error.message || "Revocation transaction failed.", { id: toastId });
        } finally {
            setIsRevoking(null);
            closeModal();
        }
    };
    // --- END OF LOGIC ---

    // --- NEW: Handle Copy for Address ---
    const handleCopyAddress = (address) => {
        try {
            const tempInput = document.createElement('input');
            tempInput.value = address;
            document.body.appendChild(tempInput);
            tempInput.select();
            document.execCommand('copy');
            document.body.removeChild(tempInput);
            toast.success('Address copied to clipboard!');
        } catch (err) {
            toast.error('Failed to copy address.');
        }
    };


    return (
        <div className="p-0"> {/* Removed parent padding, handled by Dashboard tab */}
            {/* --- REFACTORED: Header --- */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
                <div>
                    {/* Title and description are now provided by AccessTabContent */}
                </div>
            </div>

            {/* --- REFACTORED: Main Content (Grid) --- */}
            <AnimatePresence>
                {isLoading ? (
                    <AccessGridSkeleton />
                ) : grants.length === 0 ? (
                    <EmptyState />
                ) : (
                    <motion.div
                        className="grid grid-cols-1 md:grid-cols-2 gap-6"
                        variants={gridVariants}
                        initial="hidden"
                        animate="visible"
                    >
                        {grants.map((grant, index) => (
                            <AccessCard
                                key={grant.professionalAddress}
                                grant={grant}
                                isRevoking={isRevoking === grant.professionalAddress}
                                onRevoke={() => openConfirm(grant)}
                                onCopy={() => handleCopyAddress(grant.professionalAddress)}
                                customIndex={index}
                            />
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* --- UNCHANGED: Modal Render --- */}
            <ConfirmationModal
                isOpen={modalState.isOpen}
                onClose={closeModal}
                onConfirm={modalState.onConfirm}
                title={modalState.title}
                message={modalState.message}
                confirmText={modalState.confirmText}
                confirmColor={modalState.confirmColor}
                isLoading={isRevoking !== null}
            />
        </div>
    );
}

// --- NEW: Access Card Component ---
const AccessCard = ({ grant, isRevoking, onRevoke, onCopy, customIndex }) => {
    return (
        <motion.div
            variants={cardVariants}
            custom={customIndex}
            whileHover={{ scale: 1.03 }}
            className="flex flex-col justify-between bg-white rounded-2xl shadow-xl border border-gray-100 p-5 transition-all duration-300"
        >
            <div>
                {/* Card Header */}
                <div className="flex items-center gap-3">
                    <span className="flex-shrink-0 p-2 bg-blue-100 rounded-lg">
                        <Stethoscope className="h-6 w-6 text-blue-600" />
                    </span>
                    <div>
                        <h3 className="text-lg font-bold text-gray-900 break-words">{grant.professionalName}</h3>
                        <p className="text-sm text-gray-500">{grant.hospitalName}</p>
                    </div>
                </div>

                {/* Card Body: Details */}
                <div className="space-y-4 mt-4">
                    <div className="flex items-center">
                        <span className="px-3 py-1 text-sm font-semibold text-teal-800 bg-teal-100 rounded-full">
                            {grant.recordIds.length} Record(s) Shared
                        </span>
                    </div>

                    <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <label className="text-xs font-medium text-gray-500">Professionals Address</label>
                        <div className="flex items-center justify-between gap-2 mt-1">
                            <p className="font-mono text-sm text-gray-700 truncate">{grant.professionalAddress}</p>
                            <button
                                onClick={onCopy}
                                className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-gray-200 rounded-md transition-colors flex-shrink-0"
                                title="Copy Address"
                            >
                                <Copy className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Card Footer: Actions */}
            <div className="flex justify-end gap-2 mt-6">
                <button
                    onClick={onRevoke}
                    disabled={isRevoking}
                    className="flex items-center justify-center w-full sm:w-auto px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-lg shadow-md hover:bg-red-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                    {isRevoking ? (
                        <>
                            <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                            Revoking...
                        </>
                    ) : (
                        <ShieldCheck className="h-5 w-5 mr-1.5" />
                    )}
                    <span>{isRevoking ? "" : "Revoke Access"}</span>
                </button>
            </div>
        </motion.div>
    );
};


// --- NEW: Empty State Component ---
const EmptyState = () => (
    <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl shadow-xl border border-gray-100"
    >
        <Users className="h-16 w-16 text-gray-400" />
        <h3 className="mt-4 text-xl font-bold text-gray-900">No Active Permissions</h3>
        <p className="mt-2 text-gray-600">
            You havent shared your records with any professionals yet.
        </p>
    </motion.div>
);

// --- NEW: Skeleton for Card Grid ---
const AccessGridSkeleton = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[...Array(2)].map((_, i) => (
            <SkeletonCard key={i} />
        ))}
    </div>
);

const SkeletonCard = () => (
    <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-5 animate-pulse">
        <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-gray-200 rounded-lg"></div>
            <div className="flex-1 space-y-2">
                <div className="h-5 bg-gray-200 rounded-lg w-3/4"></div>
                <div className="h-4 bg-gray-200 rounded-lg w-1/2"></div>
            </div>
        </div>
        <div className="space-y-3 mt-4">
            <div className="h-6 bg-gray-200 rounded-full w-1/3"></div>
            <div className="h-12 bg-gray-200 rounded-lg w-full"></div>
        </div>
        <div className="flex justify-end mt-6">
            <div className="h-9 w-28 bg-gray-200 rounded-lg"></div>
        </div>
    </div>
);
