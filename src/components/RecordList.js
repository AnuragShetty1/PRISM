"use client";

import { useState, useEffect, useMemo } from 'react';
// CORRECTED: Reverted to alias paths
import { useWeb3 } from '@/context/Web3Context';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
// CORRECTED: Reverted to alias paths
import { hybridDecrypt } from '@/utils/crypto';
import axios from 'axios';
// CORRECTED: Reverted to alias paths
import ShareRecordsModal from '@/components/ShareRecordsModal';
// CORRECTED: Reverted to alias paths
import { fetchFromIPFS } from '@/utils/ipfs';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ShieldPlus,
    TestTube,
    ClipboardList,
    Stethoscope,
    FileShield, // This icon seems to be causing the issue, but we'll leave the import
    Ribbon,
    Download,
    Eye,
    Share2,
    CheckCircle,
    User,
    Calendar,
    Clock,
    ArrowDownUp,
    ListFilter,
    FileWarning,
    Loader2
} from 'lucide-react';

// --- CONFIGURATION (Original, for Badge) ---
const CATEGORIES_MAP = {
    'all': 'All Categories',
    'lab-result': 'Lab Results',
    'prescription': 'Prescriptions',
    'doctor-note': 'Doctor Notes',
    'insurance-claim': 'Insurance',
    'other': 'Other',
};

const getCategoryBadgeStyle = (category) => {
    switch (category) {
        case 'lab-result': return 'bg-blue-100 text-blue-800';
        case 'prescription': return 'bg-green-100 text-green-800';
        case 'doctor-note': return 'bg-yellow-100 text-yellow-800';
        case 'insurance-claim': return 'bg-indigo-100 text-indigo-800';
        default: return 'bg-gray-100 text-gray-800';
    }
};

// --- NEW: Premium Styling Helper ---
const getCategoryStyling = (category) => {
    switch (category) {
        case 'lab-result':
            return { Icon: TestTube, color: "text-blue-600", borderColor: "border-blue-500" };
        case 'prescription':
            return { Icon: ClipboardList, color: "text-green-600", borderColor: "border-green-500" };
        case 'doctor-note':
            return { Icon: Stethoscope, color: "text-yellow-600", borderColor: "border-yellow-500" };
        case 'insurance-claim':
            // --- THIS IS THE FIX ---
            // The 'FileShield' icon seems to be undefined at runtime.
            // We are replacing it with 'ShieldPlus' (which is imported)
            // to prevent the render crash, while keeping the category's color.
            return { Icon: ShieldPlus, color: "text-indigo-600", borderColor: "border-indigo-500" };
        default:
            return { Icon: Ribbon, color: "text-gray-500", borderColor: "border-gray-400" };
    }
};

// --- NEW: Animation Variants ---
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


export default function RecordList({ searchQuery }) {
    const { account, keyPair } = useWeb3();
    const [records, setRecords] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [decryptionStates, setDecryptionStates] = useState({});
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [sortBy, setSortBy] = useState('date-desc'); // NEW: Sort state

    const [selectedRecordsForSharing, setSelectedRecordsForSharing] = useState([]);
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);

    // --- MODIFICATION: Add API_BASE_URL for deployment ---
    const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';

    // --- Core Logic: Fetching and Polling (Unchanged) ---
    useEffect(() => {
        const fetchRecords = async (showLoader = true) => {
            if (!account) return;
            if (showLoader) setIsLoading(true);
            try {
                const params = { q: searchQuery || '' };
                // --- MODIFICATION: Use API_BASE_URL ---
                const response = await axios.get(`${API_BASE_URL}/api/users/records/patient/${account}`, { params });
                setRecords(response.data.success ? response.data.data || [] : []);
            } catch (error) {
                console.error("Failed to fetch records:", error);
                toast.error("Could not get records.");
            } finally {
                if (showLoader) setIsLoading(false);
            }
        };

        const debounceFetch = setTimeout(() => fetchRecords(true), 300);
        return () => clearTimeout(debounceFetch);
        // --- MODIFICATION: Add API_BASE_URL to dependency array ---
    }, [account, searchQuery, API_BASE_URL]);

    useEffect(() => {
        const pollRecords = async () => {
            if (!account) return;
            try {
                const params = { q: searchQuery || '' };
                // --- MODIFICATION: Use API_BASE_URL ---
                const response = await axios.get(`${API_BASE_URL}/api/users/records/patient/${account}`, { params });
                if (response.data.success) {
                    setRecords(response.data.data || []);
                }
            } catch (error) {
                console.error("Background poll failed:", error);
            }
        };
        const intervalId = setInterval(pollRecords, 10000);
        return () => clearInterval(intervalId);
        // --- MODIFICATION: Add API_BASE_URL to dependency array ---
    }, [account, searchQuery, API_BASE_URL]);

    // --- UPDATED: useMemo now includes sorting logic ---
    const filteredRecords = useMemo(() => {
        let processedRecords = [...records];

        // 1. Filter by Category
        if (selectedCategory !== 'all') {
            processedRecords = processedRecords.filter(record => record.category === selectedCategory);
        }

        // 2. Sort
        processedRecords.sort((a, b) => {
            switch (sortBy) {
                case 'date-asc':
                    return new Date(a.timestamp) - new Date(b.timestamp);
                case 'category':
                    return (a.category || '').localeCompare(b.category || '');
                case 'date-desc':
                default:
                    return new Date(b.timestamp) - new Date(a.timestamp);
            }
        });

        return processedRecords;
    }, [records, selectedCategory, sortBy]); // Added sortBy dependency

    // --- Selection Handlers (Unchanged) ---
    const handleRecordSelectToggle = (recordId) => {
        setSelectedRecordsForSharing(prevSelected => {
            if (prevSelected.includes(recordId)) {
                return prevSelected.filter(id => id !== recordId);
            } else {
                return [...prevSelected, recordId];
            }
        });
    };

    const handleSelectAll = (e) => {
        if (e.target.checked) {
            setSelectedRecordsForSharing(filteredRecords.map(r => r.recordId));
        } else {
            setSelectedRecordsForSharing([]);
        }
    };

    // --- NEW: Share handler for single card ---
    const handleShareOneRecord = (recordId) => {
        setSelectedRecordsForSharing([recordId]);
        setIsShareModalOpen(true);
    };

    // --- UPDATED: Unified handler for Decrypt/View and Download ---
    const handleDecryptAndAct = async (record, action = 'view') => {
        if (!keyPair?.privateKey) {
            toast.error("Your security key is not available. Cannot decrypt.");
            return;
        }

        const stateKey = `${record.recordId}-${action}`; // Unique key for view/download
        setDecryptionStates(prev => ({ ...prev, [stateKey]: 'pending' }));
        const toastId = toast.loading("Fetching encrypted data...");

        try {
            const metaResponse = await fetchFromIPFS(record.ipfsHash);
            const metadata = await metaResponse.json();
            const bundleHash = metadata.encryptedBundleIPFSHash;
            if (!bundleHash) throw new Error("Invalid metadata: Encrypted file hash is missing.");

            const bundleResponse = await fetchFromIPFS(bundleHash);
            const encryptedBundle = await bundleResponse.json();

            toast.loading("Decrypting file...", { id: toastId });
            const decryptedData = await hybridDecrypt(encryptedBundle, keyPair.privateKey);

            toast.loading(action === 'view' ? "Opening file..." : "Downloading file...", { id: toastId });

            const blob = new Blob([decryptedData], { type: metadata.fileType || 'application/octet-stream' });
            const url = window.URL.createObjectURL(blob);

            if (action === 'view') {
                window.open(url, '_blank');
            } else { // action === 'download'
                const a = document.createElement('a');
                a.href = url;
                a.download = metadata.fileName || record.title.replace(/ /g, '_') || 'download';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            }

            // Use timeout to ensure resources are released
            setTimeout(() => window.URL.revokeObjectURL(url), 1000);

            toast.success(`File ${action === 'view' ? 'opened' : 'downloaded'} successfully!`, { id: toastId });
            setDecryptionStates(prev => ({ ...prev, [stateKey]: 'success' }));
        } catch (error) {
            console.error("Decryption failed:", error);
            const errorMessage = error instanceof Error ? error.message : "An unknown decryption error occurred.";
            toast.error(errorMessage, { id: toastId });
            setDecryptionStates(prev => ({ ...prev, [stateKey]: 'error' }));
        }
    };

    // --- NEW: Premium loading skeleton ---
    if (isLoading) {
        return <RecordGridSkeleton />;
    }

    return (
        <div>
            {/* --- NEW: Premium Control Bar --- */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">

                {/* Left Side: Filters */}
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <input
                            id="checkbox-all"
                            type="checkbox"
                            className="w-5 h-5 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                            onChange={handleSelectAll}
                            checked={filteredRecords.length > 0 && selectedRecordsForSharing.length === filteredRecords.length}
                        />
                        <label htmlFor="checkbox-all" className="text-sm font-medium text-gray-700">Select All</label>
                    </div>

                    <div className="relative">
                        <ListFilter className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <select
                            id="category-filter"
                            value={selectedCategory}
                            onChange={(e) => setSelectedCategory(e.target.value)}
                            className="w-full md:w-auto pl-10 pr-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white transition"
                        >
                            {Object.entries(CATEGORIES_MAP).map(([id, name]) => (
                                <option key={id} value={id}>{name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Right Side: Sort & Share */}
                <div className="flex items-center gap-4">
                    <div className="relative">
                        <ArrowDownUp className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <select
                            id="sort-by"
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                            className="w-full md:w-auto pl-10 pr-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white transition"
                        >
                            <option value="date-desc">Date: Newest</option>
                            <option value="date-asc">Date: Oldest</option>
                            <option value="category">Category</option>
                        </select>
                    </div>
                    <button
                        onClick={() => setIsShareModalOpen(true)}
                        disabled={selectedRecordsForSharing.length === 0}
                        className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg shadow-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all"
                    >
                        <Share2 className="h-4 w-4" />
                        Share ({selectedRecordsForSharing.length})
                    </button>
                </div>
            </div>

            {/* --- NEW: Card Grid --- */}
            <AnimatePresence>
                {filteredRecords.length === 0 ? (
                    <EmptyState query={searchQuery} category={selectedCategory} />
                ) : (
                    <motion.div
                        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                        variants={gridVariants}
                        initial="hidden"
                        animate="visible"
                    >
                        {filteredRecords.map((record, index) => (
                            <RecordCard
                                key={record.recordId}
                                record={record}
                                isSelected={selectedRecordsForSharing.includes(record.recordId)}
                                decryptionStates={decryptionStates}
                                onToggleSelect={() => handleRecordSelectToggle(record.recordId)}
                                onDecrypt={() => handleDecryptAndAct(record, 'view')}
                                onDownload={() => handleDecryptAndAct(record, 'download')}
                                onShare={() => handleShareOneRecord(record.recordId)}
                                customIndex={index}
                            />
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>

            {isShareModalOpen && (
                <ShareRecordsModal
                    records={records}
                    recordsToShare={selectedRecordsForSharing}
                    onClose={() => {
                        setIsShareModalOpen(false);
                        setSelectedRecordsForSharing([]);
                    }}
                />
            )}
        </div>
    );
}

// --- NEW: Record Card Component ---
const RecordCard = ({ record, isSelected, onToggleSelect, decryptionStates, onDecrypt, onDownload, onShare, customIndex }) => {
    // --- THIS IS THE FIX ---
    // We add a fallback to the default 'other' category styling.
    // This prevents a crash if `record.category` is null or undefined, which would cause `getCategoryStyling` to return `undefined`.
    const { Icon, color, borderColor } = getCategoryStyling(record.category) || getCategoryStyling('other');
    const viewState = decryptionStates[`${record.recordId}-view`] || 'idle';
    const downloadState = decryptionStates[`${record.recordId}-download`] || 'idle';
    const isDecrypting = viewState === 'pending' || downloadState === 'pending';

    return (
        <motion.div
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            custom={customIndex}
            whileHover={{ scale: 1.03 }}
            className={`flex flex-col justify-between bg-white rounded-2xl shadow-xl border border-gray-100 p-5 ${borderColor} border-t-4 transition-all duration-300`}
        >
            <div>
                {/* Card Header */}
                <div className="flex justify-between items-start gap-4">
                    <div className="flex items-center gap-3">
                        <Icon className={`${color} h-7 w-7 flex-shrink-0`} />
                        <h3 className="text-lg font-bold text-gray-900 break-words">{record.title}</h3>
                    </div>
                    <input
                        type="checkbox"
                        className="w-5 h-5 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 mt-1 flex-shrink-0"
                        checked={isSelected}
                        onChange={onToggleSelect}
                    />
                </div>

                {/* Card Body: Details */}
                <div className="space-y-3 mt-4">
                    <InfoRow
                        Icon={record.isVerified ? CheckCircle : User}
                        label="Upload Type"
                        value={record.isVerified ? "Verified" : "Self Uploaded"}
                        iconColor={record.isVerified ? "text-green-600" : "text-gray-500"}
                    />
                    <InfoRow
                        Icon={Calendar}
                        label="Date"
                        value={format(new Date(record.timestamp), "PP")}
                    />
                    <InfoRow
                        Icon={Clock}
                        label="Time"
                        value={format(new Date(record.timestamp), "p")}
                    />
                    <div className="flex items-center">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getCategoryBadgeStyle(record.category)}`}>
                            {CATEGORIES_MAP[record.category] || 'Other'}
                        </span>
                    </div>
                </div>
            </div>

            {/* Card Footer: Actions */}
            <div className="flex justify-end gap-2 mt-6">
                <button
                    onClick={onShare}
                    className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Share"
                >
                    <Share2 className="h-5 w-5" />
                </button>
                <button
                    onClick={onDownload}
                    disabled={isDecrypting}
                    className="flex items-center gap-1 p-2 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Download"
                >
                    {downloadState === 'pending' ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}
                </button>
                <button
                    onClick={onDecrypt}
                    disabled={isDecrypting}
                    className="flex items-center gap-1.5 px-3 py-2 text-white bg-blue-600 rounded-lg shadow-md hover:bg-blue-700 transition-colors disabled:bg-gray-400"
                >
                    {viewState === 'pending' ? <Loader2 className="h-5 w-5 animate-spin" /> : <Eye className="h-5 w-5" />}
                    <span>View</span>
                </button>
            </div>
        </motion.div>
    );
};

// --- NEW: Helper for card details ---
const InfoRow = ({ Icon, label, value, iconColor = "text-gray-500" }) => (
    <div className="flex items-center gap-2 text-sm">
        <Icon className={`h-4 w-4 ${iconColor} flex-shrink-0`} />
        <span className="text-gray-500">{label}:</span>
        <span className="font-medium text-gray-800">{value}</span>
    </div>
);

// --- NEW: Empty State Component ---
const EmptyState = ({ query, category }) => (
    <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl shadow-xl border border-gray-100"
    >
        <FileWarning className="h-16 w-16 text-gray-400" />
        <h3 className="mt-4 text-xl font-bold text-gray-900">No Records Found</h3>
        <p className="mt-2 text-gray-600">
            {query ? "Try adjusting your search query." : (category !== 'all' ? "Try a different category." : "You haven't uploaded any records yet.")}
        </p>
    </motion.div>
);

// --- NEW: Skeleton for Card Grid ---
const RecordGridSkeleton = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(6)].map((_, i) => (
            <SkeletonCard key={i} />
        ))}
    </div>
);

const SkeletonCard = () => (
    <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-5 animate-pulse">
        <div className="flex justify-between items-start">
            <div className="flex items-center gap-3">
                <div className="h-7 w-7 bg-gray-200 rounded-lg"></div>
                <div className="h-5 bg-gray-200 rounded-lg w-32"></div>
            </div>
            <div className="h-5 w-5 bg-gray-200 rounded"></div>
        </div>
        <div className="space-y-3 mt-4">
            <div className="h-4 bg-gray-200 rounded-lg w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded-lg w-1/2"></div>
            <div className="h-4 bg-gray-200 rounded-lg w-2/3"></div>
            <div className="h-5 bg-gray-200 rounded-full w-1/3"></div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
            <div className="h-9 w-9 bg-gray-200 rounded-lg"></div>
            <div className="h-9 w-9 bg-gray-200 rounded-lg"></div>
            <div className="h-9 w-20 bg-gray-200 rounded-lg"></div>
        </div>
    </div>
);

