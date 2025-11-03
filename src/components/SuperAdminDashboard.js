"use client";
import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { useWeb3 } from "../context/Web3Context.js";
import ConfirmationModal from './ConfirmationModal.js';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import {
    LayoutDashboard,
    BellRing,
    ShieldCheck,
    List,
    Server,
    CheckCircle2,
    XCircle,
    ShieldClose,
    Shield,
    Loader2,
    AlertTriangle,
    FileText,
    Users
} from 'lucide-react';

// --- [REFACTORED] Light-themed Dashboard Loader ---
const DashboardLoader = () => (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center text-center p-8 font-sans">
        <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
        <h2 className="text-xl font-semibold text-gray-900 mt-4">Initializing Command Center...</h2>
        <p className="text-gray-600 text-sm mt-1">Fetching system status and requests.</p>
    </div>
);

export default function SuperAdminDashboard() {
    const { setTheme, signer } = useWeb3();
    const [pendingRequests, setPendingRequests] = useState([]);
    const [verifiedHospitals, setVerifiedHospitals] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [actionStates, setActionStates] = useState({});
    const [activityLog, setActivityLog] = useState([]);
    const prevDataRef = useRef();

    const [sponsorAddress, setSponsorAddress] = useState('');
    const [isSponsorLoading, setIsSponsorLoading] = useState(false);

    // --- [NEW] State for Tab Navigation ---
    const [activeTab, setActiveTab] = useState('overview');

    const [modalState, setModalState] = useState({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => { },
        confirmText: 'Confirm',
        confirmColor: 'bg-indigo-600',
        isLoading: false
    });

    // --- [MODIFIED] Set theme to 'default' (light) ---
    useEffect(() => {
        if (setTheme) setTheme('default');
        return () => {
            if (setTheme) setTheme('default');
        };
    }, [setTheme]);


    const API_URL = 'http://localhost:3001/api/super-admin';

    // --- ALL STATE AND LOGIC FUNCTIONS (UNCHANGED) ---
    
    const setActionState = (key, state) => {
        setActionStates(prev => ({ ...prev, [key]: state }));
    };

    const fetchRequestsAndHospitals = useCallback(async () => {
        try {
            const requestsResponse = await axios.get(`${API_URL}/requests`);
            const hospitalsResponse = await axios.get(`${API_URL}/hospitals`);
            setPendingRequests(requestsResponse.data.data || []);
            setVerifiedHospitals(hospitalsResponse.data.data || []);
            setError('');
        } catch (err) {
            console.error("Error fetching data:", err);
            setError(err.response?.data?.message || 'Failed to fetch data. The server might be down.');
        } finally {
            if (isLoading) {
                setIsLoading(false);
            }
        }
    }, [isLoading]);

    useEffect(() => {
        fetchRequestsAndHospitals();
        const intervalId = setInterval(fetchRequestsAndHospitals, 5000);
        return () => clearInterval(intervalId);
    }, [fetchRequestsAndHospitals]);

    useEffect(() => {
        if (prevDataRef.current) {
            const { prevPending, prevVerified } = prevDataRef.current;
            const newLogs = [];

            prevPending.forEach(oldReq => {
                const stillPending = pendingRequests.some(newReq => newReq.requestId === oldReq.requestId);
                if (!stillPending) {
                    const wasVerified = verifiedHospitals.some(h => h.adminAddress === oldReq.requesterAddress);
                    const log = {
                        timestamp: new Date().toLocaleTimeString(),
                        message: `${oldReq.hospitalName} request was ${wasVerified ? 'VERIFIED' : 'REJECTED'}.`,
                        type: wasVerified ? 'success' : 'warning'
                    };
                    newLogs.push(log);
                }
            });

            prevVerified.forEach(oldHospital => {
                const stillVerified = verifiedHospitals.some(newH => newH.hospitalId === oldHospital.hospitalId);
                if (!stillVerified) {
                    const log = {
                        timestamp: new Date().toLocaleTimeString(),
                        message: `Access for ${oldHospital.name} was REVOKED.`,
                        type: 'error'
                    };
                    newLogs.push(log);
                }
            });

            if (newLogs.length > 0) {
                setActivityLog(prev => [...newLogs, ...prev].slice(0, 10));
            }
        }
        prevDataRef.current = { prevPending: pendingRequests, prevVerified: verifiedHospitals };
    }, [pendingRequests, verifiedHospitals]);

    const handleVerify = async (requestId, adminAddress) => {
        setError('');
        setActionState(`verify_${requestId}`, true);
        setModalState(prev => ({ ...prev, isLoading: true }));
        try {
            await axios.post(`${API_URL}/verify-hospital`, { requestId, adminAddress });
            await fetchRequestsAndHospitals();
        } catch (err) {
            console.error("Error verifying hospital:", err);
            setError(err.response?.data?.message || 'A critical error occurred during verification.');
            setActionState(`verify_${requestId}`, false);
        } finally {
            closeModal();
        }
    };

    const handleReject = async (requestId) => {
        setError('');
        setActionState(`reject_${requestId}`, true);
        setModalState(prev => ({ ...prev, isLoading: true }));
        try {
            await axios.post(`${API_URL}/reject-hospital`, { requestId });
            await fetchRequestsAndHospitals();
        } catch (err) {
            console.error("Error rejecting hospital:", err);
            setError(err.response?.data?.message || 'A critical error occurred during rejection.');
            setActionState(`reject_${requestId}`, false);
        } finally {
            closeModal();
        }
    };

    const handleRevoke = async (hospitalId) => {
        setError('');
        setActionState(`revoke_${hospitalId}`, true);
        setModalState(prev => ({ ...prev, isLoading: true }));
        try {
            await axios.post(`${API_URL}/revoke-hospital`, { hospitalId });
            await fetchRequestsAndHospitals();
        } catch (err) {
            console.error("Error revoking hospital:", err);
            setError(err.response?.data?.message || 'A critical error occurred during revocation.');
            setActionState(`revoke_${hospitalId}`, false);
        } finally {
            closeModal();
        }
    };

    const openVerifyModal = (requestId, requesterAddress, hospitalName) => {
        setModalState({
            isOpen: true,
            title: 'Confirm Hospital Verification',
            message: `Are you sure you want to verify ${hospitalName} (${requesterAddress})? This will allow them to access the system.`,
            onConfirm: () => handleVerify(requestId, requesterAddress),
            confirmText: 'Verify',
            confirmColor: 'bg-blue-600',
            isLoading: false
        });
    };

    const openRejectModal = (requestId, hospitalName) => {
        setModalState({
            isOpen: true,
            title: 'Confirm Hospital Rejection',
            message: `Are you sure you want to reject ${hospitalName}? They will not be able to access the system.`,
            onConfirm: () => handleReject(requestId),
            confirmText: 'Reject',
            confirmColor: 'bg-red-600',
            isLoading: false
        });
    };

    const openRevokeModal = (hospitalId, hospitalName) => {
        setModalState({
            isOpen: true,
            title: 'Confirm Hospital Revocation',
            message: `Are you sure you want to REVOKE access for ${hospitalName}? This is a destructive action and will immediately lock them out.`,
            onConfirm: () => handleRevoke(hospitalId),
            confirmText: 'Yes, Revoke Access',
            confirmColor: 'bg-red-800',
            isLoading: false
        });
    };

    const closeModal = () => {
        setModalState({ isOpen: false, onConfirm: () => { }, isLoading: false });
    };

    const executeSponsorAction = async (action) => {
        if (!signer) {
            toast.error("Signer (MetaMask) not found. Please ensure you are connected.");
            return;
        }
        if (!sponsorAddress) {
            toast.error("Please enter a wallet address.");
            return;
        }

        setIsSponsorLoading(true);
        const toastId = toast.loading("Waiting for wallet signature...");

        try {
            const message = `Confirming Super Admin Action: ${action} for ${sponsorAddress}`;
            const signature = await signer.signMessage(message);
            toast.loading("Signature received. Processing on backend...", { id: toastId });

            const endpoint = action === 'GRANT' ? 'grant-sponsor' : 'revoke-sponsor';
            await axios.post(`${API_URL}/${endpoint}`, {
                address: sponsorAddress,
                signature: signature
            });

            toast.success(`Sponsor role ${action.toLowerCase()}ed successfully!`, { id: toastId });
            setSponsorAddress('');

        } catch (err) {
            if (err.code === 4001) {
                toast.error("Action rejected. Signature was cancelled.", { id: toastId });
            } else {
                console.error(`Error during ${action} sponsor:`, err);
                const message = err.response?.data?.message || "An unknown error occurred.";
                toast.error(`Failed: ${message}`, { id: toastId });
            }
        } finally {
            setIsSponsorLoading(false);
        }
    };
    // --- END OF UNCHANGED LOGIC ---


    if (isLoading) {
        return <DashboardLoader />;
    }

    // --- [NEW] Refactored Render ---
    return (
        <div className="min-h-screen w-full bg-gray-50 p-4 md:p-8 font-sans">
            <div className="max-w-7xl mx-auto space-y-8">
                
                {/* [REFACTORED] Page Header */}
                <div>
                    <h1 className="text-4xl font-bold tracking-tight text-gray-900">
                        System Command Center
                    </h1>
                    <p className="mt-2 text-lg text-gray-600">
                        Oversee and manage all hospital network participants.
                    </p>
                </div>

                {/* [REFACTORED] Error Banner */}
                {error && (
                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg relative" role="alert">
                        <strong className="font-bold">Error: </strong>
                        <span className="block sm:inline">{error}</span>
                    </div>
                )}

                {/* [NEW] Tab Navigation */}
                <TabNavigation activeTab={activeTab} setActiveTab={setActiveTab} />

                {/* [NEW] Tab Content */}
                <main>
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={activeTab}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ duration: 0.2 }}
                        >
                            {activeTab === 'overview' && (
                                <OverviewSection
                                    verifiedHospitals={verifiedHospitals.length}
                                    pendingRequests={pendingRequests.length}
                                />
                            )}
                            {activeTab === 'pending' && (
                                <PendingRequestsSection
                                    pendingRequests={pendingRequests}
                                    openVerifyModal={openVerifyModal}
                                    openRejectModal={openRejectModal}
                                    actionStates={actionStates}
                                />
                            )}
                            {activeTab === 'manage' && (
                                <ManageHospitalsSection
                                    verifiedHospitals={verifiedHospitals}
                                    openRevokeModal={openRevokeModal}
                                    actionStates={actionStates}
                                />
                            )}
                            {activeTab === 'sponsor' && (
                                <SponsorManagementSection
                                    sponsorAddress={sponsorAddress}
                                    setSponsorAddress={setSponsorAddress}
                                    isSponsorLoading={isSponsorLoading}
                                    executeSponsorAction={executeSponsorAction}
                                />
                            )}
                            {activeTab === 'logs' && (
                                <ActivityLogSection activityLog={activityLog} />
                            )}
                        </motion.div>
                    </AnimatePresence>
                </main>

            </div>

            {/* Modal (Logic Unchanged) */}
            <ConfirmationModal
                isOpen={modalState.isOpen}
                onClose={closeModal}
                onConfirm={() => {
                    modalState.onConfirm();
                }}
                title={modalState.title}
                message={modalState.message}
                confirmText={modalState.confirmText}
                confirmColor={modalState.confirmColor}
                isLoading={modalState.isLoading}
            />
        </div>
    );
}

// --- [NEW] Tab Navigation Component ---
const tabs = [
    { id: 'overview', name: 'Overview', icon: LayoutDashboard },
    { id: 'pending', name: 'Pending Requests', icon: BellRing },
    { id: 'manage', name: 'Manage Hospitals', icon: ShieldCheck },
    { id: 'sponsor', name: 'Sponsor Management', icon: Users },
    { id: 'logs', name: 'Activity Log', icon: FileText },
];

function TabNavigation({ activeTab, setActiveTab }) {
    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-2">
            <nav className="flex flex-wrap gap-2">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`
                            flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors
                            ${activeTab === tab.id
                                ? 'bg-blue-600 text-white'
                                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                            }
                        `}
                    >
                        <tab.icon className="h-5 w-5" />
                        <span>{tab.name}</span>
                    </button>
                ))}
            </nav>
        </div>
    );
}

// --- [NEW] Overview Section ---
function OverviewSection({ verifiedHospitals, pendingRequests }) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StatCard
                title="Verified Hospitals"
                value={verifiedHospitals}
                icon={ShieldCheck}
                color="blue"
            />
            <StatCard
                title="Pending Requests"
                value={pendingRequests}
                icon={BellRing}
                color="amber"
            />
            <StatCard
                title="System Status"
                value="Operational"
                icon={Server}
                color="green"
            />
        </div>
    );
}

function StatCard({ title, value, icon: Icon, color }) {
    const colors = {
        blue: 'text-blue-600 bg-blue-100',
        amber: 'text-amber-600 bg-amber-100',
        green: 'text-green-600 bg-green-100',
    };

    return (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 flex items-center gap-6">
            <div className={`flex-shrink-0 h-16 w-16 flex items-center justify-center rounded-full ${colors[color]}`}>
                <Icon className="h-8 w-8" />
            </div>
            <div>
                <p className="text-sm font-medium text-gray-500">{title}</p>
                <p className="text-3xl font-bold text-gray-900">{value}</p>
            </div>
        </div>
    );
}

// --- [NEW] Pending Requests Section ---
function PendingRequestsSection({ pendingRequests, openVerifyModal, openRejectModal, actionStates }) {
    if (pendingRequests.length === 0) {
        return (
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 text-center">
                <p className="text-gray-500 italic">No pending requests at the moment.</p>
            </div>
        );
    }
    
    return (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hospital Name</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Wallet Address</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Request ID</th>
                        <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {pendingRequests.map((req) => (
                        <tr key={req.requestId}>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm font-medium text-gray-900">{req.hospitalName}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-500 font-mono">{req.requesterAddress}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-500 font-mono">{req.requestId}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                                <button
                                    onClick={() => openVerifyModal(req.requestId, req.requesterAddress, req.hospitalName)}
                                    disabled={actionStates[`verify_${req.requestId}`] || actionStates[`reject_${req.requestId}`]}
                                    className="inline-flex items-center gap-2 justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-300 disabled:cursor-not-allowed"
                                >
                                    {actionStates[`verify_${req.requestId}`] ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                                    Verify
                                </button>
                                <button
                                    onClick={() => openRejectModal(req.requestId, req.hospitalName)}
                                    disabled={actionStates[`verify_${req.requestId}`] || actionStates[`reject_${req.requestId}`]}
                                    className="inline-flex items-center gap-2 justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-300 disabled:cursor-not-allowed"
                                >
                                    {actionStates[`reject_${req.requestId}`] ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                                    Reject
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

// --- [NEW] Manage Hospitals Section ---
function ManageHospitalsSection({ verifiedHospitals, openRevokeModal, actionStates }) {
    if (verifiedHospitals.length === 0) {
        return (
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 text-center">
                <p className="text-gray-500 italic">No hospitals have been verified yet.</p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hospital Name</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Wallet Address</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {verifiedHospitals.map((hospital) => (
                        <tr key={hospital.hospitalId}>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm font-medium text-gray-900">{hospital.name}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-500 font-mono">{hospital.adminAddress}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                                    Verified
                                </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                <button
                                    onClick={() => openRevokeModal(hospital.hospitalId, hospital.name)}
                                    disabled={actionStates[`revoke_${hospital.hospitalId}`]}
                                    className="inline-flex items-center gap-2 justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:bg-gray-300 disabled:cursor-not-allowed"
                                >
                                    {actionStates[`revoke_${hospital.hospitalId}`] ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldClose className="h-4 w-4" />}
                                    Revoke Access
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

// --- [NEW] Sponsor Management Section ---
function SponsorManagementSection({ sponsorAddress, setSponsorAddress, isSponsorLoading, executeSponsorAction }) {
    return (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 max-w-2xl mx-auto">
            <h3 className="text-2xl font-semibold text-gray-900">Sponsor Wallet Management</h3>
            <p className="text-sm text-gray-600 mt-2 mb-6">
                Authorize or revoke a wallet address to act as a "Sponsor" (i.e., pay gas fees) for user transactions. This is a high-privilege action.
            </p>
            <div className="space-y-4">
                <div>
                    <label htmlFor="sponsor_address" className="block text-sm font-medium text-gray-700">
                        Sponsor Wallet Address
                    </label>
                    <input
                        type="text"
                        id="sponsor_address"
                        value={sponsorAddress}
                        onChange={(e) => setSponsorAddress(e.target.value)}
                        placeholder="0x..."
                        className="mt-1 block w-full px-4 py-2 bg-white border border-gray-300 rounded-lg shadow-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono disabled:bg-gray-100"
                        disabled={isSponsorLoading}
                    />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <button
                        onClick={() => executeSponsorAction('GRANT')}
                        disabled={isSponsorLoading}
                        className="inline-flex items-center justify-center gap-2 w-full px-4 py-3 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-300 disabled:cursor-not-allowed"
                    >
                        {isSponsorLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ShieldCheck className="h-5 w-5" />}
                        Grant Role
                    </button>
                    <button
                        onClick={() => executeSponsorAction('REVOKE')}
                        disabled={isSponsorLoading}
                        className="inline-flex items-center justify-center gap-2 w-full px-4 py-3 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:bg-gray-300 disabled:cursor-not-allowed"
                    >
                        {isSponsorLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ShieldClose className="h-5 w-5" />}
                        Revoke Role
                    </button>
                </div>
            </div>
        </div>
    );
}

// --- [NEW] Activity Log Section ---
function ActivityLogSection({ activityLog }) {
    if (activityLog.length === 0) {
        return (
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 text-center">
                <p className="text-gray-500 italic">No recent system activity.</p>
            </div>
        );
    }
    
    return (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 space-y-4 max-w-3xl mx-auto">
            {activityLog.map((log, index) => (
                <ActivityLogItem key={index} log={log} />
            ))}
        </div>
    );
}

// --- [REFACTORED] ActivityLogItem ---
const ActivityLogItem = ({ log }) => {
    const styles = {
        success: {
            bg: 'bg-green-50',
            text: 'text-green-700',
            icon: <CheckCircle2 className="h-5 w-5 text-green-500" />
        },
        warning: {
            bg: 'bg-amber-50',
            text: 'text-amber-700',
            icon: <XCircle className="h-5 w-5 text-amber-500" />
        },
        error: {
            bg: 'bg-red-50',
            text: 'text-red-700',
            icon: <AlertTriangle className="h-5 w-5 text-red-500" />
        },
    };
    
    const style = styles[log.type] || styles.warning;

    return (
        <div className={`flex items-start gap-4 p-4 rounded-lg ${style.bg} ${style.text}`}>
            <div className="flex-shrink-0 mt-0.5">
                {style.icon}
            </div>
            <div className="flex-grow">
                <p className="text-sm font-medium">{log.message}</p>
                <span className="text-xs font-mono text-gray-500">{log.timestamp}</span>
            </div>
        </div>
    );
};

