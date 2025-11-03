"use client";
import { useState } from 'react';
import toast from 'react-hot-toast';
import axios from 'axios';
import AccessManager from './AccessManager';
import ConfirmationModal from './ConfirmationModal';
import { motion, AnimatePresence } from 'framer-motion';
import { Stethoscope, MailOpen, Loader2, Check, X } from 'lucide-react';

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


export default function RequestManager({ professionalRequests, onRequestsUpdate }) {
    // --- STATE (Simplified) ---
    const [isAccessManagerOpen, setIsAccessManagerOpen] = useState(false);
    const [selectedRequestForApproval, setSelectedRequestForApproval] = useState(null);
    const [processingId, setProcessingId] = useState(null);

    // --- MODAL STATE (Unchanged) ---
    const [modalState, setModalState] = useState({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => { },
        confirmText: '',
        confirmColor: 'bg-indigo-600',
    });

    const closeModal = () => {
        if (processingId) return;
        setModalState({ ...modalState, isOpen: false });
    };

    // --- CONFIRM MODAL (Simplified) ---
    const openConfirm = (actionType, item) => {
        if (actionType === 'reject') {
            setModalState({
                isOpen: true,
                title: 'Reject Request',
                message: `Are you sure you want to reject the access request from ${item.professional}? This action cannot be undone.`,
                onConfirm: () => handleProfessionalResponse(item.requestId, 'rejected', undefined),
                confirmText: 'Reject',
                confirmColor: 'bg-red-600'
            });
        }
    };

    // --- PROFESSIONAL REQUEST LOGIC (Unchanged) ---
    const handleProfessionalResponse = async (requestId, response, grants) => {
        setProcessingId(requestId);
        const toastId = toast.loading(`Processing your response...`);
        try {
            const payload = { requestId, response };
            if (response === 'approved' && grants) {
                payload.grants = grants;
            }

            await axios.post('http://localhost:3001/api/users/access-requests/respond', payload);

            toast.success(`Request successfully ${response}!`, { id: toastId });
            onRequestsUpdate();
        } catch (error) {
            console.error(`Failed to ${response} request:`, error);
            const apiErrorMessage = error.response?.data?.message;
            toast.error(apiErrorMessage || `Failed to ${response} request.`, { id: toastId });
        } finally {
            setProcessingId(null);
            closeModal();
        }
    };

    const handleApproveProfessionalClick = (request) => {
        setSelectedRequestForApproval(request);
        setIsAccessManagerOpen(true);
    };

    const onGrantSuccess = (grants) => {
        if (selectedRequestForApproval) {
            handleProfessionalResponse(selectedRequestForApproval.requestId, 'approved', grants);
        }
        setIsAccessManagerOpen(false);
        setSelectedRequestForApproval(null);
    };

    // --- RENDER LOGIC ---
    return (
        <div className="space-y-8">
            {isAccessManagerOpen && selectedRequestForApproval && (
                <AccessManager
                    isOpen={isAccessManagerOpen}
                    onClose={() => setIsAccessManagerOpen(false)}
                    preselectedProfessional={{
                        name: selectedRequestForApproval.professional,
                        address: selectedRequestForApproval.professionalAddress
                    }}
                    preselectedRecords={selectedRequestForApproval.requestedRecords}
                    onGrantSuccess={onGrantSuccess}
                />
            )}

            {/* --- REFACTORED: Main Content Grid --- */}
            <AnimatePresence>
                {/* professionalRequests prop is null while parent fetches */}
                {!professionalRequests ? (
                    <RequestGridSkeleton />
                ) : professionalRequests.length === 0 ? (
                    <EmptyState />
                ) : (
                    <motion.div
                        className="grid grid-cols-1 md:grid-cols-2 gap-6"
                        variants={gridVariants}
                        initial="hidden"
                        animate="visible"
                    >
                        {professionalRequests.map((req, index) => (
                            <RequestCard
                                key={req.requestId}
                                request={req}
                                isLoading={processingId === req.requestId}
                                onReject={() => openConfirm('reject', req)}
                                onApprove={() => handleApproveProfessionalClick(req)}
                                customIndex={index}
                            />
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* --- RENDER THE MODAL (Unchanged) --- */}
            <ConfirmationModal
                isOpen={modalState.isOpen}
                onClose={closeModal}
                onConfirm={modalState.onConfirm}
                title={modalState.title}
                message={modalState.message}
                confirmText={modalState.confirmText}
                confirmColor={modalState.confirmColor}
                isLoading={processingId !== null}
            />
        </div>
    );
}

// --- NEW: Request Card Component ---
const RequestCard = ({ request, isLoading, onReject, onApprove, customIndex }) => {
    return (
        <motion.div
            variants={cardVariants}
            custom={customIndex}
            whileHover={{ scale: 1.03 }}
            className="flex flex-col justify-between bg-white rounded-2xl shadow-xl border border-gray-100 p-5 transition-all duration-300"
        >
            <div>
                {/* Card Header */}
                <div className="flex justify-between items-start gap-4">
                    <div className="flex items-center gap-3">
                        <span className="flex-shrink-0 p-2 bg-blue-100 rounded-lg">
                            <Stethoscope className="h-6 w-6 text-blue-600" />
                        </span>
                        <div>
                            <h3 className="text-lg font-bold text-gray-900 break-words">{request.professional}</h3>
                            <p className="text-sm text-gray-500">{request.hospitalName}</p>
                        </div>
                    </div>
                    <span className="inline-block flex-shrink-0 px-3 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                        Professional
                    </span>
                </div>

                {/* Card Body: Details */}
                <div className="my-4">
                    <p className="text-sm font-semibold text-gray-700 mb-2">Requested Records:</p>
                    <ul className="list-disc list-inside space-y-1 text-sm text-gray-600 pl-2">
                        {(request.requestedRecords || []).map(rec => (
                            <li key={rec.recordId}>{rec.title}</li>
                        ))}
                    </ul>
                </div>
            </div>

            {/* Card Footer: Actions */}
            <div className="flex justify-end gap-3">
                <button
                    onClick={onReject}
                    disabled={isLoading}
                    className="inline-flex items-center justify-center rounded-lg bg-red-100 px-4 py-2 text-sm font-semibold text-red-700 shadow-sm transition-colors hover:bg-red-200 disabled:opacity-50"
                >
                    {isLoading ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                        <X className="h-5 w-5" />
                    )}
                    <span className="ml-2">Reject</span>
                </button>
                <button
                    onClick={onApprove}
                    disabled={isLoading}
                    className="inline-flex items-center justify-center rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-green-700 disabled:bg-gray-400"
                >
                    {isLoading ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                        <Check className="h-5 w-5" />
                    )}
                    <span className="ml-2">Approve</span>
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
        <MailOpen className="h-16 w-16 text-gray-400" />
        <h3 className="mt-4 text-xl font-bold text-gray-900">No Pending Requests</h3>
        <p className="mt-2 text-gray-600">
            You're all caught up!
        </p>
    </motion.div>
);

// --- NEW: Skeleton for Card Grid ---
const RequestGridSkeleton = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[...Array(2)].map((_, i) => (
            <SkeletonCard key={i} />
        ))}
    </div>
);

const SkeletonCard = () => (
    <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-5 animate-pulse">
        <div className="flex justify-between items-start">
            <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-gray-200 rounded-lg"></div>
                <div className="flex-1 space-y-2">
                    <div className="h-5 bg-gray-200 rounded-lg w-3/4"></div>
                    <div className="h-4 bg-gray-200 rounded-lg w-1/2"></div>
                </div>
            </div>
            <div className="h-6 w-24 bg-gray-200 rounded-full"></div>
        </div>
        <div className="space-y-2 mt-4">
            <div className="h-4 bg-gray-200 rounded-lg w-1/3"></div>
            <div className="h-4 bg-gray-200 rounded-lg w-1/2"></div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
            <div className="h-9 w-24 bg-gray-200 rounded-lg"></div>
            <div className="h-9 w-24 bg-gray-200 rounded-lg"></div>
        </div>
    </div>
);
