"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
// FIX: Using relative path to resolve build error
import { useWeb3 } from '../context/Web3Context.js'; 
import toast from 'react-hot-toast';
import { Check, X, Copy, Users, Hourglass, Building, Loader2, Info, UserCheck, ShieldOff, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// --- ANIMATION VARIANTS (Unchanged) ---
const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 100, damping: 20 } },
};

// --- HELPER COMPONENT: StatusBadge (Unchanged) ---
const StatusBadge = ({ status }) => {
    const statusStyles = {
        pending: 'bg-yellow-100 text-yellow-800 ring-yellow-600/20',
        verifying: 'bg-blue-100 text-blue-800 ring-blue-600/20 animate-pulse',
        approved: 'bg-green-100 text-green-800 ring-green-600/20',
        revoking: 'bg-red-100 text-red-800 ring-red-600/20 animate-pulse',
        rejected: 'bg-gray-100 text-gray-500 ring-gray-400/20',
    };
    return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ring-1 ring-inset ${statusStyles[status] || 'bg-gray-100 text-gray-800'}`}>
            {status.charAt(0).toUpperCase() + status.slice(1)}
        </span>
    );
};

// --- HELPER COMPONENT: ConfirmationModal (Preserved Internal Refactor) ---
const ConfirmationModal = ({ isOpen, onClose, onConfirm, title, message, confirmText, confirmColor, isLoading, actionType }) => {
    if (!isOpen) return null;

    const Icon = actionType === 'verify' ? Info : AlertTriangle;
    const iconBgColor = actionType === 'verify' ? 'bg-blue-100' : 'bg-red-100';
    const iconTextColor = actionType === 'verify' ? 'text-blue-600' : 'text-red-600';

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 overflow-y-auto bg-gray-900 bg-opacity-75 transition-opacity flex justify-center items-center p-4"
            >
                <motion.div
                    initial={{ scale: 0.9, y: 50 }}
                    animate={{ scale: 1, y: 0 }}
                    exit={{ scale: 0.9, y: 50 }}
                    className="w-full max-w-md bg-white rounded-xl shadow-2xl p-6 transform transition-all"
                >
                    <div className="text-center">
                        <div className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full ${iconBgColor}`}>
                            <Icon className={`h-6 w-6 ${iconTextColor}`} aria-hidden="true" />
                        </div>
                        <h3 className="mt-5 text-lg font-bold text-gray-900">{title}</h3>
                        <div className="mt-2">
                            <p className="text-sm text-gray-500">{message}</p>
                        </div>
                    </div>
                    <div className="mt-6 flex justify-end space-x-3">
                        <button
                            type="button"
                            className="inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50"
                            onClick={onClose}
                            disabled={isLoading}
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            className={`inline-flex items-center justify-center gap-2 rounded-md ${confirmColor} px-4 py-2 text-sm font-medium text-white shadow-sm hover:opacity-90 disabled:bg-gray-400 disabled:cursor-wait`}
                            onClick={onConfirm}
                            disabled={isLoading}
                        >
                            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                            {confirmText}
                        </button>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

// --- HELPER COMPONENT: AdminHeader (REFACTORED - Premium Card Style) ---
const AdminHeader = ({ userProfile }) => (
    <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        // REFACTOR: Restored premium card style
        className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 md:p-8 flex items-center gap-6"
    >
        {/* Internal Refactor Preserved */}
        <div className="text-blue-600 flex-shrink-0">
            <Building className="h-10 w-10" />
        </div>
        <div>
            {!userProfile ? (
                <div className="animate-pulse">
                    <div className="h-8 w-64 bg-gray-200 rounded-md"></div>
                    <div className="h-5 w-80 bg-gray-200 rounded-md mt-2"></div>
                </div>
            ) : (
                <>
                    <h1 className="text-2xl font-bold text-gray-900">
                        {userProfile?.hospitalName || 'Hospital Admin'}
                    </h1>
                    <p className="mt-1 text-sm text-gray-500">
                        Staff Credentialing and Access Management Portal
                    </p>
                </>
            )}
        </div>
    </motion.div>
);

// --- HELPER COMPONENT: StatCard (REFACTORED - Premium Card Style) ---
const StatCard = ({ title, count, icon: Icon, colorClass, delay }) => (
    <motion.div
        variants={itemVariants}
        initial="hidden"
        animate="visible"
        transition={{ delay: delay }}
        // REFACTOR: Restored premium card style
        className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100 hover:shadow-xl transition-shadow duration-300"
    >
        {/* Internal Refactor Preserved */}
        <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-500">{title}</p>
            <Icon className={`h-6 w-6 ${colorClass}`} />
        </div>
        <p className="mt-2 text-3xl font-bold text-gray-900">{count}</p>
    </motion.div>
);


// --- MAIN COMPONENT: AdminDashboard ---
export default function AdminDashboard() {
    const { userProfile } = useWeb3(); 
    const [requests, setRequests] = useState([]);
    const [professionals, setProfessionals] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [processingId, setProcessingId] = useState(null);
    const [activeTab, setActiveTab] = useState('pending');

    // --- MODAL STATE (Preserved Internal Refactor) ---
    const [modalState, setModalState] = useState({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => { },
        confirmText: '',
        confirmColor: 'bg-indigo-600 hover:bg-indigo-700',
        actionType: 'verify', 
    });

    // --- MODIFICATION: Use Environment Variable for API URL ---
    const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';
    const API_URL = `${API_BASE_URL}/api/hospital-admin`;
    // --- END MODIFICATION ---

    const closeModal = () => {
        if (processingId) return;
        setModalState({ ...modalState, isOpen: false });
    };

    const openConfirm = (actionType, item) => {
        let title, message, onConfirm, confirmText, confirmColor;

        switch (actionType) {
            case 'verify':
                title = 'Approve Professional';
                message = `Are you sure you want to approve ${item.name}? This will grant them access as a ${item.role}.`;
                onConfirm = () => handleVerify(item);
                confirmText = 'Approve';
                confirmColor = 'bg-blue-600 hover:bg-blue-700'; 
                break;
            case 'reject':
                title = 'Reject Request';
                message = `Are you sure you want to reject the request from ${item.name}? This action cannot be undone.`;
                onConfirm = () => handleReject(item);
                confirmText = 'Reject';
                confirmColor = 'bg-red-600 hover:bg-red-700';
                break;
            case 'revoke':
                title = 'Revoke Access';
                message = `Are you sure you want to revoke all access for ${item.name}? They will be immediately disconnected.`;
                onConfirm = () => handleRevoke(item);
                confirmText = 'Revoke Access';
                confirmColor = 'bg-red-600 hover:bg-red-700';
                break;
            default:
                return;
        }

        setModalState({
            isOpen: true,
            title,
            message,
            onConfirm,
            confirmText,
            confirmColor,
            actionType 
        });
    };
    // --- END OF MODAL STATE ---


    // --- DATA FETCHING (Logic Preserved) ---
    // --- MODIFICATION: Add API_URL to dependency array ---
    const fetchData = useCallback(async () => {
        if (userProfile?.hospitalId === null || userProfile?.hospitalId === undefined) {
            setIsLoading(false);
            return;
        }

        if (requests.length === 0 && professionals.length === 0) {
            setIsLoading(true);
        }

        try {
            const [requestsRes, professionalsRes] = await Promise.all([
                // --- MODIFICATION: Use API_URL ---
                fetch(`${API_URL}/requests/${userProfile.hospitalId}`),
                fetch(`${API_URL}/professionals/${userProfile.hospitalId}`),
            ]);

            if (!requestsRes.ok || !professionalsRes.ok) {
                const errorData = await Promise.all([requestsRes.json(), professionalsRes.json()]);
                throw new Error(errorData[0].message || errorData[1].message || 'Failed to fetch hospital data.');
            }

            const requestsData = await requestsRes.json();
            const professionalsData = await professionalsRes.json();

            setRequests(requestsData.data || []);
            setProfessionals(professionalsData.data || []);
        } catch (error) {
            console.error("Failed to fetch data:", error);
            toast.error(error.message || "Could not fetch dashboard data.");
        } finally {
            setIsLoading(false);
        }
    }, [userProfile, requests.length, professionals.length, API_URL]); // <-- Added API_URL

    useEffect(() => {
        fetchData();
        const intervalId = setInterval(fetchData, 5000);
        return () => clearInterval(intervalId);
    }, [fetchData]);

    // --- TRANSACTION HANDLERS (Logic Preserved) ---
    const handleVerify = async (request) => {
        setProcessingId(request.address);
        const toastId = toast.loading(`Initiating verification for ${request.name}...`);
        try {
            // --- MODIFICATION: Use API_URL ---
            const response = await fetch(`${API_URL}/verify-professional`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    professionalAddress: request.address,
                    hospitalId: userProfile.hospitalId,
                    role: request.role,
                }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message);
            toast.success(`Verification process started for ${request.name}.`, { id: toastId });
            await fetchData();
        } catch (error) {
            console.error("Verification failed:", error);
            toast.error(error.message || "Verification failed.", { id: toastId });
        } finally {
            setProcessingId(null);
            closeModal();
        }
    };

    const handleRevoke = async (professional) => {
        setProcessingId(professional.address);
        const toastId = toast.loading(`Initiating revocation for ${professional.name}...`);
        try {
            // --- MODIFICATION: Use API_URL ---
            const response = await fetch(`${API_URL}/revoke-professional`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    professionalAddress: professional.address,
                    hospitalId: userProfile.hospitalId,
                    role: professional.role,
                }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message);
            toast.success(`Revocation process started for ${professional.name}.`, { id: toastId });
            await fetchData();
        } catch (error) {
            console.error("Revocation failed:", error);
            toast.error(error.message || "Revocation failed.", { id: toastId });
        } finally {
            setProcessingId(null);
            closeModal();
        }
    };

    const handleReject = async (request) => {
        setProcessingId(request.address);
        const toastId = toast.loading(`Rejecting request for ${request.name}...`);
        try {
            // --- MODIFICATION: Use API_URL ---
            const response = await fetch(`${API_URL}/reject-professional`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    professionalAddress: request.address,
                    hospitalId: userProfile.hospitalId,
                }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message);
            toast.success(`Request for ${request.name} has been rejected.`, { id: toastId });
            await fetchData();
        } catch (error) {
            console.error("Rejection failed:", error);
            toast.error(error.message || "Rejection failed.", { id: toastId });
        } finally {
            setProcessingId(null);
            closeModal();
        }
    };
    // --- END OF TRANSACTION HANDLERS ---

    // --- UTILITY (Logic Preserved) ---
    const handleCopyAddress = (address) => {
        const el = document.createElement('textarea');
        el.value = address;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
        toast.success('Address copied!');
    };

    // --- RENDER LIST (Preserved Internal Refactor) ---
    const renderList = (items, isPendingList) => {
        if (isLoading && items.length === 0) return (
            <div className="p-10 text-center text-gray-500">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400 mx-auto" />
                <p className="mt-4">Loading professionals...</p>
            </div>
        );

        if (items.length === 0) return (
            <div className="p-12 text-center text-gray-500 bg-gray-50 rounded-b-2xl">
                <div className="flex justify-center mb-4">
                    {isPendingList ? <Hourglass size={48} className="text-gray-300" /> : <Users size={48} className="text-gray-300" />}
                </div>
                <p className="font-semibold text-xl text-gray-800">{isPendingList ? "No Pending Requests" : "No Verified Professionals"}</p>
                <p className="text-sm mt-1">{isPendingList ? "New professionals seeking affiliation will appear here." : "Approved staff members with access are listed here."}</p>
            </div>
        );

        return (
            <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="overflow-x-auto"
            >
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-white">
                        <tr>
                            <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider border-b-2 border-gray-200">Professional</th>
                            <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider border-b-2 border-gray-200">Role & Status</th>
                            <th scope="col" className="relative px-6 py-4 border-b-2 border-gray-200">
                                <span className="sr-only">Actions</span>
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100">
                        {items.map((item, index) => {
                            const isProcessing = processingId === item.address;
                            return (
                                <motion.tr 
                                    key={item.address} 
                                    variants={itemVariants}
                                    className="transition-colors duration-200 hover:bg-gray-50"
                                >
                                    <td className="px-6 py-5 whitespace-nowrap">
                                        <div className="font-medium text-gray-900">{item.name}</div>
                                        <div className="flex items-center gap-2 mt-1">
                                            <p className="font-mono text-sm text-gray-500">{`${item.address.substring(0, 6)}...${item.address.substring(item.address.length - 4)}`}</p>
                                            <button 
                                                onClick={() => handleCopyAddress(item.address)} 
                                                className="text-gray-400 hover:text-blue-600 transition-colors"
                                                aria-label="Copy Address"
                                            >
                                                <Copy size={14} />
                                            </button>
                                        </div>
                                    </td>
                                    <td className="px-6 py-5 whitespace-nowrap">
                                        <div className="text-sm text-gray-500">Role: <span className="font-medium text-gray-900">{item.role}</span></div>
                                        <div className="mt-1">
                                            <StatusBadge status={item.professionalStatus} />
                                        </div>
                                    </td>
                                    <td className="px-6 py-5 whitespace-nowrap text-right text-sm font-medium">
                                        {isPendingList ? (
                                            <div className="flex justify-end gap-3">
                                                <button
                                                    onClick={() => openConfirm('reject', item)}
                                                    disabled={isProcessing || item.professionalStatus === 'verifying'}
                                                    className="flex items-center justify-center gap-1.5 px-3 py-2 font-semibold text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-wait transition-all shadow-sm"
                                                >
                                                    {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <X size={16} />}
                                                    Reject
                                                </button>
                                                <button
                                                    onClick={() => openConfirm('verify', item)}
                                                    disabled={isProcessing || item.professionalStatus === 'verifying'}
                                                    className="flex items-center justify-center gap-1.5 px-3 py-2 font-semibold text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-wait transition-all shadow-sm"
                                                >
                                                    {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                                                    {item.professionalStatus === 'verifying' ? 'Verifying...' : 'Approve'}
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => openConfirm('revoke', item)}
                                                disabled={isProcessing || item.professionalStatus === 'revoking'}
                                                className="flex items-center justify-center gap-1.5 px-3 py-2 font-semibold text-sm text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-wait transition-all shadow-sm ml-auto"
                                            >
                                                {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <ShieldOff size={16} />}
                                                {item.professionalStatus === 'revoking' ? 'Revoking...' : 'Revoke Access'}
                                            </button>
                                        )}
                                    </td>
                                </motion.tr>
                            );
                        })}
                    </tbody>
                </table>
            </motion.div>
        );
    };

    return (
        // REFACTOR: Removed padding, min-height, and background.
        // This component will now fill its parent, which is responsible
        // for layout, padding, and background.
        <div className="w-full">
            {/* This div remains w-full to fill the parent container */}
            <div className="w-full space-y-8">
                
                <AdminHeader userProfile={userProfile} />

                <motion.div
                    className="grid grid-cols-1 md:grid-cols-2 gap-6"
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                >
                    <StatCard 
                        title="Pending Verification" 
                        count={requests.length} 
                        icon={Hourglass} 
                        colorClass="text-yellow-600"
                        delay={0.1}
                    />
                    <StatCard 
                        title="Verified Professionals" 
                        count={professionals.length} 
                        icon={UserCheck} 
                        colorClass="text-green-600"
                        delay={0.2}
                    />
                </motion.div>

                {/* REFACTOR: Restored premium card style */}
                <motion.div
                    className="bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden"
                    variants={itemVariants}
                    initial="hidden"
                    animate="visible"
                    transition={{ delay: 0.3 }}
                >
                    {/* Tab Navigation (Preserved Internal Refactor) */}
                    <div className="border-b border-gray-200">
                        <nav className="flex gap-6 px-6 sm:px-8">
                            {['pending', 'verified'].map(tabId => {
                                const Icon = tabId === 'pending' ? Hourglass : Users;
                                const label = tabId === 'pending' ? 'Pending Requests' : 'Verified Professionals';
                                
                                return (
                                    <button 
                                        key={tabId} 
                                        onClick={() => setActiveTab(tabId)} 
                                        className={`py-4 px-1 border-b-2 font-semibold text-base flex items-center gap-2 transition-colors relative ${activeTab === tabId 
                                            ? 'border-blue-600 text-blue-600' 
                                            : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300'}`}
                                    >
                                        <Icon size={18} />
                                        {label}
                                        {activeTab === tabId && (
                                            <motion.div
                                                layoutId="adminTabIndicator"
                                                className="absolute bottom-[-1px] left-0 right-0 h-0.5 bg-blue-600"
                                                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                            />
                                        )}
                                    </button>
                                );
                            })}
                        </nav>
                    </div>

                    {/* Content Area (Preserved Internal Refactor) */}
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={activeTab}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.2 }}
                        >
                            {activeTab === 'pending' ? renderList(requests, true) : renderList(professionals, false)}
                        </motion.div>
                    </AnimatePresence>

                </motion.div>
            </div>

            {/* CONFIRMATION MODAL (Preserved Internal Refactor) */}
            <ConfirmationModal
                isOpen={modalState.isOpen}
                onClose={closeModal}
                onConfirm={modalState.onConfirm}
                title={modalState.title}
                message={modalState.message}
                confirmText={modalState.confirmText}
                confirmColor={modalState.confirmColor}
                isLoading={processingId !== null} 
                actionType={modalState.actionType}
            />
        </div>
    );
}
