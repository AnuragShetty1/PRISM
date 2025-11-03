"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
// CORRECTED: Use relative paths
import { useWeb3 } from '../context/Web3Context';
import toast from 'react-hot-toast';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import {
    LayoutDashboard,
    FileText,
    ShieldCheck,
    Bell,
    // REMOVED: User as UserIcon
    Copy,
    Info,
    Upload,
    Pointer,
    Lock,
    Users,
    Activity,
    Search,
    // REMOVED: ChevronRight
} from 'lucide-react';

// CORRECTED: Use relative paths
import UploadForm from "./UploadForm";
import AccessManagement from "./AccessManagement";
import RequestManager from "./RequestManager";
// REMOVED: Profile import
// import Profile from "./Profile"; 
import RecordList from "./RecordList";
import DashboardSkeleton from './DashboardSkeleton';

// --- NEW: Animation Variants ---
const cardContainerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1,
        },
    },
};

const cardItemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
        opacity: 1,
        y: 0,
        transition: {
            type: "spring",
            stiffness: 100
        }
    },
};

export default function PatientDashboard() {
    // MODIFIED: Removed all profile-related state
    const { userProfile, account, records, accessList, refetchUserProfile } = useWeb3();
    const [activeTab, setActiveTab] = useState('overview');
    const [greeting, setGreeting] = useState('Welcome');
    const [searchQuery, setSearchQuery] = useState('');
    // REMOVED: ipfsProfileData, profileImageUrl, isLoadingProfile states

    const [professionalRequests, setProfessionalRequests] = useState([]);

    const fetchProfessionalRequests = useCallback(async () => {
        if (!account) return;
        try {
            const response = await axios.get(`http://localhost:3001/api/users/access-requests/patient/${account}`);
            if (response.data.success) {
                setProfessionalRequests(response.data.data || []);
            }
        } catch (error) {
            console.error("Failed to fetch professional access requests:", error);
            // [MODIFIED] Add user-facing toast notification on error
            toast.error(error.response?.data?.message || "Could not load access requests.");
        }
    }, [account]);

    // REMOVED: fetchIpfsProfile and its useEffect

    useEffect(() => {
        fetchProfessionalRequests();
        const intervalId = setInterval(fetchProfessionalRequests, 10000);
        return () => clearInterval(intervalId);
    }, [fetchProfessionalRequests]);

    useEffect(() => {
        const hour = new Date().getHours();
        if (hour < 12) setGreeting('Good Morning');
        else if (hour < 18) setGreeting('Good Afternoon');
        else setGreeting('Good Evening');
    }, []);

    // REMOVED: handleRefetchProfile

    const handleCopyAddress = () => {
        if (!userProfile?.walletAddress) return;
        try {
            const tempInput = document.createElement('input');
            tempInput.value = userProfile.walletAddress;
            document.body.appendChild(tempInput);
            tempInput.select();
            document.execCommand('copy');
            document.body.removeChild(tempInput);
            toast.success('Address copied to clipboard!');
        } catch (err) {
            toast.error('Failed to copy address.');
        }
    };

    const handleTabChange = (tab) => {
        setActiveTab(tab);
    };

    // MODIFIED: Removed insuranceRequests logic
    const totalRequestCount = professionalRequests?.length || 0;

    if (!userProfile) {
        return <DashboardSkeleton />;
    }

    const renderActiveTab = () => {
        switch (activeTab) {
            case 'overview':
                return <DashboardOverview
                    records={records || []}
                    accessList={accessList || []}
                    professionalRequests={professionalRequests || []}
                    totalRequests={totalRequestCount}
                    onNavigate={handleTabChange}
                />;
            case 'record-list':
                return <RecordListTabContent
                    searchQuery={searchQuery}
                    setSearchQuery={setSearchQuery}
                />;
            case 'upload':
                return <UploadTabContent />;
            case 'access':
                return <AccessTabContent />;
            case 'requests':
                return (
                    <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 md:p-8">
                        <h2 className="text-3xl font-bold text-gray-900 mb-6">Pending Requests</h2>
                        <RequestManager
                            professionalRequests={professionalRequests}
                            onRequestsUpdate={fetchProfessionalRequests}
                        />
                    </div>
                );
            // REMOVED: 'profile' case
            default:
                return <DashboardOverview
                    records={records || []}
                    accessList={accessList || []}
                    professionalRequests={professionalRequests || []}
                    totalRequests={totalRequestCount}
                    onNavigate={handleTabChange}
                />;
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 p-6 md:p-10">
            <div className="max-w-7xl mx-auto space-y-8">
                {/* --- MODIFIED: Pass new props to DashboardHeader --- */}
                <DashboardHeader
                    userProfile={userProfile}
                    greeting={greeting}
                    onCopyAddress={handleCopyAddress}
                    onNavigate={handleTabChange}
                    totalRequests={totalRequestCount} // Pass totalRequests
                />
                <TabNavigation
                    activeTab={activeTab}
                    onTabChange={handleTabChange}
                    totalRequests={totalRequestCount}
                />
                <main>
                    {/* --- MODIFIED: Fix layout jumps --- */}
                    <AnimatePresence>
                        <motion.div
                            key={activeTab}
                            className="w-full" // Fixes width jump
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.2 }}
                        >
                            {renderActiveTab()}
                        </motion.div>
                    </AnimatePresence>
                </main>
            </div>
        </div>
    );
}

// --- NEW: HeaderQuickActions Component ---
const HeaderQuickActions = ({ onNavigate, totalRequests }) => (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full md:w-auto">
        <button
            onClick={() => onNavigate('upload')}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow-lg hover:bg-blue-700 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
            <Upload className="h-5 w-5" />
            <span>Upload</span>
        </button>
        <button
            onClick={() => onNavigate('access')}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-gray-700 text-white font-semibold rounded-lg shadow-lg hover:bg-gray-800 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-600"
        >
            <Pointer className="h-5 w-5" />
            <span>Grant</span>
        </button>
        <button
            onClick={() => onNavigate('requests')}
            className="w-full sm:w-auto relative flex items-center justify-center gap-2 px-4 py-2 bg-white text-gray-900 font-semibold rounded-lg shadow-lg ring-1 ring-gray-300 hover:bg-gray-50 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
            <Bell className="h-5 w-5" />
            <span>Requests</span>
            {totalRequests > 0 && (
                <span className="absolute -top-2 -right-2 h-5 w-5 bg-red-600 text-white text-xs font-bold rounded-full flex items-center justify-center">
                    {totalRequests}
                </span>
            )}
        </button>
    </div>
);


// --- REFACTORED: DashboardHeader ---
const DashboardHeader = ({
    userProfile,
    greeting,
    onCopyAddress,
    onNavigate,
    totalRequests
}) => (
    <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 md:p-8"
    >
        {/* REFACTORED: 3-Column Layout */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            {/* Column 1: Greeting */}
            <div className="flex-1 w-full md:w-auto">
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{greeting}, {userProfile.name}!</h1>
                <p className="text-lg text-gray-600 mt-1">
                    Welcome to your personal health dashboard.
                </p>
            </div>

            {/* Column 2: Wallet & Status */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3 w-full md:w-auto md:max-w-md flex-shrink-0">
                <div className="flex justify-between items-center gap-4">
                    <span className="font-semibold text-gray-700 text-sm">Status</span>
                    <span className={`px-3 py-1 text-xs font-bold rounded-full ${userProfile.isVerified ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {userProfile.isVerified ? "Verified" : "Not Verified"}
                    </span>
                </div>
                <div className="text-sm text-gray-500">
                    <p className="font-semibold text-gray-700">Wallet Address</p>
                    <div className="flex items-center gap-2 mt-1">
                        <p className="font-mono text-xs text-gray-600 truncate">{userProfile.walletAddress}</p>
                        <button onClick={onCopyAddress} className="text-gray-500 hover:text-blue-600 transition-colors flex-shrink-0">
                            <Copy className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Column 3: Quick Actions */}
            <div className="w-full md:w-auto">
                <HeaderQuickActions onNavigate={onNavigate} totalRequests={totalRequests} />
            </div>
        </div>
    </motion.div>
);

// --- REFACTORED: TabNavigation ---
const TabNavigation = ({ activeTab, onTabChange, totalRequests }) => {
    // REMOVED: Profile tab
    const tabs = [
        { name: 'Overview', key: 'overview', icon: LayoutDashboard },
        { name: 'My Records', key: 'record-list', icon: FileText },
        { name: 'Upload Record', key: 'upload', icon: Upload },
        { name: 'Access Management', key: 'access', icon: ShieldCheck },
        { name: 'Pending Requests', key: 'requests', icon: Bell },
    ];

    return (
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-2">
            <nav className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
                {tabs.map((tab) => (
                    <button
                        key={tab.key}
                        onClick={() => onTabChange(tab.key)}
                        className={`relative flex-1 flex justify-center items-center gap-2 px-4 py-3 text-sm font-semibold rounded-lg transition-colors ${activeTab === tab.key
                                ? 'text-blue-700'
                                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                            }`}
                    >
                        <tab.icon className="h-5 w-5" />
                        <span>{tab.name}</span>
                        {tab.key === 'requests' && totalRequests > 0 && (
                            <span className="absolute top-1 right-1 h-5 w-5 bg-red-600 text-white text-xs font-bold rounded-full flex items-center justify-center">
                                {totalRequests}
                            </span>
                        )}
                        {activeTab === tab.key && (
                            <motion.div
                                layoutId="activeTabIndicator"
                                className="absolute bottom-0 left-0 right-0 h-1 bg-blue-600 rounded-full"
                            />
                        )}
                    </button>
                ))}
            </nav>
        </div>
    );
};

// --- REFACTORED: DashboardOverview ---
const DashboardOverview = ({ records, accessList, professionalRequests, totalRequests, onNavigate }) => (
    <motion.div
        className="grid grid-cols-1 lg:grid-cols-3 gap-6"
        variants={cardContainerVariants}
        initial="hidden"
        animate="visible"
    >
        {/* Left Column - REORDERED */}
        <div className="lg:col-span-1 space-y-6">
            {/* Stat Cards are now first */}
            <StatCard
                title="Total Records"
                value={records?.length || 0}
                icon={<FileText className="text-blue-600" />}
                color="blue"
            />
            <StatCard
                title="Active Permissions"
                value={accessList?.length || 0}
                icon={<ShieldCheck className="text-green-600" />}
                color="green"
            />
            <StatCard
                title="Pending Requests"
                value={totalRequests || 0}
                icon={<Bell className={totalRequests > 0 ? "text-red-600" : "text-gray-500"} />}
                highlight={totalRequests > 0}
                color="red"
            />
            {/* QuickActionsCard is removed from here */}
        </div>

        {/* Right Column */}
        <motion.div className="lg:col-span-2" variants={cardItemVariants}>
            <RecentActivityFeed
                records={records || []}
                accessList={accessList || []}
                professionalRequests={professionalRequests || []}
            />
        </motion.div>
    </motion.div>
);

// --- REFACTORED: StatCard ---
const StatCard = ({ title, value, icon, highlight = false, color = 'blue' }) => {
    const colors = {
        blue: 'border-blue-500',
        green: 'border-green-500',
        red: 'border-red-500',
    };
    return (
        <motion.div
            variants={cardItemVariants}
            whileHover={{ scale: 1.03 }}
            className={`p-6 rounded-2xl shadow-xl border border-gray-100 bg-white border-l-4 ${colors[color]}`}
            animate={highlight ? { scale: [1, 1.01, 1], transition: { duration: 1.5, repeat: Infinity } } : {}}
        >
            <div className="flex justify-between items-start">
                <div>
                    <div className="p-3 rounded-lg bg-gray-100 w-max mb-2">
                        {icon}
                    </div>
                    <p className="text-sm font-medium text-gray-600">{title}</p>
                </div>
                <p className="text-5xl font-bold text-gray-900">{value}</p>
            </div>
        </motion.div>
    );
}

// REMOVED: Old QuickActions / NewQuickActions component

// --- REFACTORED: RecentActivityFeed ---
const RecentActivityFeed = ({ records, accessList, professionalRequests }) => {

    const activity = useMemo(() => {
        const recordActivities = (records || []).map(r => ({
            type: 'Record Added',
            description: r.title || `New record uploaded.`,
            timestamp: new Date(Number(r.timestamp) * 1000),
            icon: Upload,
            color: 'text-blue-600',
            bgColor: 'bg-blue-100'
        }));

        const accessActivities = (accessList || []).map((user, index) => ({
            type: 'Access Granted',
            description: `Access granted to ${user.name || 'a provider'}.`,
            timestamp: new Date(Date.now() - index * 100000), // Faked for demo
            icon: ShieldCheck,
            color: 'text-green-600',
            bgColor: 'bg-green-100'
        }));

        // MODIFIED: Use professionalRequests
        const requestActivities = (professionalRequests || []).map((req, index) => ({
            type: 'Request Received',
            description: `Access request from ${req.professional}.`,
            timestamp: new Date(req.createdAt || (Date.now() - index * 100000)), // Use real timestamp if available
            icon: Bell,
            color: 'text-yellow-600',
            bgColor: 'bg-yellow-100'
        }));

        const allActivities = [...recordActivities, ...accessActivities, ...requestActivities];
        allActivities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

        return allActivities.slice(0, 5);
    }, [records, accessList, professionalRequests]);

    return (
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 h-full">
            <h3 className="text-xl font-bold text-gray-900 p-6 border-b border-gray-200">Recent Activity</h3>
            {activity.length === 0 ? (
                <div className="p-6 h-full flex flex-col items-center justify-center text-gray-500 min-h-[300px]">
                    <Activity className="h-16 w-16 text-gray-300" />
                    <p className="mt-4 font-semibold">No recent activity</p>
                    <p className="text-sm">Upload records or grant access to get started.</p>
                </div>
            ) : (
                <ul className="p-6 space-y-6">
                    {activity.map((item, index) => {
                        const Icon = item.icon;
                        return (
                            <li key={index} className="flex gap-4">
                                <div className={`relative flex-shrink-0 p-3 rounded-full h-12 w-12 flex items-center justify-center ${item.bgColor} ${item.color}`}>
                                    <Icon className="h-6 w-6" />
                                    {/* Timeline connector */}
                                    {index < activity.length - 1 && (
                                        <div className="absolute left-1/2 -bottom-6 h-6 w-0.5 bg-gray-200" />
                                    )}
                                </div>
                                <div className="flex-1">
                                    <p className="font-semibold text-gray-800">{item.type}</p>
                                    <p className="text-sm text-gray-600">{item.description}</p>
                                    <p className="text-xs text-gray-400 mt-1">
                                        {formatDistanceToNow(item.timestamp, { addSuffix: true })}
                                    </p>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
};


// --- UNMODIFIED: Tab Content Wrappers ---
const UploadTabContent = () => (
    <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden p-6 md:p-8">
        <div className="flex items-center gap-3 mb-6">
            <div className="bg-blue-100 text-blue-700 p-3 rounded-lg">
                <Upload className="h-6 w-6" />
            </div>
            <div>
                <h3 className="text-2xl font-bold text-gray-900">Upload New Record</h3>
                <p className="text-gray-600">Add a new document to your encrypted health profile.</p>
            </div>
        </div>

        <div className="p-6 bg-gray-50/50 rounded-lg border border-gray-200">
            <UploadForm />
        </div>
    </div>
);

const RecordListTabContent = ({ searchQuery, setSearchQuery }) => (
    <div className="p-6 md:p-8 bg-white rounded-2xl shadow-xl border border-gray-100">
        <h3 className="text-2xl font-bold text-gray-900 mb-6">My Record History</h3>
        <div className="relative">
            <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search records by title, type, or provider..."
                className="w-full px-4 py-3 pl-10 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 transition"
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
        </div>
        <div className="mt-6">
            <RecordList searchQuery={searchQuery} />
        </div>
    </div>
);


const AccessTabContent = () => (
    <div className="space-y-8">
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 space-y-4">
            <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-100 text-blue-700 rounded-lg">
                    <Info className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold text-gray-900">How It Works</h3>
            </div>
            <p className="text-sm text-gray-600">
                You are in complete control. Your records are end-to-end encrypted. Granting access creates a temporary, on-chain permission for a *specific* provider.
            </p>
            <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                    <Lock className="h-4 w-4 text-green-600 flex-shrink-0" />
                    <span>Only providers you approve can see your data.</span>
                </li>
                <li className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-blue-600 flex-shrink-0" />
                    <span>You can revoke access at any time, instantly.</span>
                </li>
                <li className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-purple-600 flex-shrink-0" />
                    <span>Every action is logged on the blockchain for full transparency.</span>
                </li>
            </ul>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 md:p-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-6">Manage Provider Access</h2>
            <AccessManagement />
        </div>
    </div>
);
