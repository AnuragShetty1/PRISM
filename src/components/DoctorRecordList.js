"use client";

import { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { useWeb3 } from '../context/Web3Context'; // Reverting to single parent relative path
import toast from 'react-hot-toast';
import { unwrapSymmetricKey } from '../utils/crypto'; // Reverting to single parent relative path
import {
    Eye, Loader2,ShieldPlus , AlertTriangle, User, ChevronLeft, Calendar,
    // --- ADDED: DownloadCloud for Download action ---
    DownloadCloud
} from 'lucide-react';
import { fetchFromIPFS } from '../utils/ipfs'; // Reverting to single parent relative path
import { motion, AnimatePresence } from 'framer-motion'; 
// --- (NEW) IMPORTS ---
import { TestTube, ClipboardList, Stethoscope, FileShield, Ribbon } from 'lucide-react';

// --- (NEW) HELPERS ---
const CATEGORIES_MAP = {
    'all': 'All Categories',
    'lab-result': 'Lab Results',
    'prescription': 'Prescriptions',
    'doctor-note': 'Doctor Notes',
    'insurance-claim': 'Insurance', 
    'other': 'Other',
};

// Helper for badge styling
const getCategoryBadgeStyle = (category) => {
    switch (category) {
        case 'lab-result': return 'bg-blue-100 text-blue-800';
        case 'prescription': return 'bg-green-100 text-green-800';
        case 'doctor-note': return 'bg-yellow-100 text-yellow-800';
        case 'insurance-claim': return 'bg-indigo-100 text-indigo-800';
        default: return 'bg-gray-100 text-gray-800';
    }
};

// Use the same icons as the patient's list for consistency
const getCategoryStyling = (category) => {
    switch (category) {
        case 'lab-result':
            return { Icon: TestTube, color: "text-blue-600", borderColor: "border-blue-500" };
        case 'prescription':
            return { Icon: ClipboardList, color: "text-green-600", borderColor: "border-green-500" };
        case 'doctor-note':
            return { Icon: Stethoscope, color: "text-yellow-600", borderColor: "border-yellow-500" };
        case 'insurance-claim':
            return { Icon: ShieldPlus, color: "text-indigo-600", borderColor: "border-indigo-500" };
        default:
            return { Icon: Ribbon, color: "text-gray-500", borderColor: "border-gray-400" };
    }
};

// Animation Variants
const cardContainerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.05,
        },
    },
};

const cardItemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: (i) => ({
        opacity: 1,
        y: 0,
        transition: {
            delay: i * 0.05,
            type: "spring",
            stiffness: 100
        },
    }),
};
// --- (END HELPERS) ---


export default function DoctorRecordList({ records }) {
    const { keyPair } = useWeb3();
    const [decryptingId, setDecryptingId] = useState(null);
    const [metadataCache, setMetadataCache] = useState({});
    const [filterCategory, setFilterCategory] = useState('all');
    const [sortBy, setSortBy] = useState('date-desc'); // NEW: Sort state

    // --- NEW STATE: Tracks which patient is currently selected (address) ---
    const [activePatient, setActivePatient] = useState(null);
    // ---

    // --- Group records by patient for the initial selection view ---
    const groupedRecords = useMemo(() => {
        const groups = {};
        for (const record of records) {
            const address = record.patientAddress;
            // Ensure patientAddress is available before grouping
            if (!address || !record.patientName) continue; 
            
            if (!groups[address]) {
                groups[address] = {
                    patientName: record.patientName,
                    patientAddress: record.patientAddress,
                    recordCount: 0,
                    records: [],
                };
            }
            groups[address].recordCount++;
            groups[address].records.push(record);
        }
        
        // Convert map to array for rendering
        const uniqueGroups = Object.values(groups);

        return uniqueGroups;
    }, [records]);

    // Set the active patient if only one is available (UX improvement for single patient view).
    useEffect(() => {
        if (groupedRecords.length === 1 && activePatient === null) {
            setActivePatient(groupedRecords[0].patientAddress);
        }
    }, [groupedRecords, activePatient]);


    // --- CONSOLIDATED METADATA FETCHER (Modified to fetch for all incoming records) ---
    useEffect(() => {
        const fetchAllMetadata = async () => {
            // Create a list of records that are not in the cache
            const recordsToFetch = records.filter(
                (record) => metadataCache[record.recordId] === undefined
            );

            if (recordsToFetch.length === 0) return;

            // Set all to 'loading' to prevent re-fetching
            setMetadataCache(prev => {
                const newCache = { ...prev };
                for (const record of recordsToFetch) {
                    newCache[record.recordId] = 'loading';
                }
                return newCache;
            });

            // Fetch all metadata in parallel
            await Promise.all(
                recordsToFetch.map(async (record) => {
                    try {
                        // Use record.ipfsHash which maps to the metadata JSON
                        const response = await fetchFromIPFS(record.ipfsHash); 
                        const data = await response.json();
                        setMetadataCache(prev => ({ ...prev, [record.recordId]: data || null }));
                    } catch (error) {
                        console.error("Failed to fetch metadata:", error);
                        // [MODIFIED] Add user-facing toast notification
                        toast.error(`Failed to load metadata for record: ${record.title || record.recordId}`);
                        setMetadataCache(prev => ({ ...prev, [record.recordId]: null }));
                    }
                })
            );
        };

        fetchAllMetadata();
        // Run this effect when the list of records or cache status changes
    }, [records, metadataCache]); // [FIX]: Added metadataCache to dependencies
    // --- (END METADATA FETCHER) ---


    // --- MEMO FOR FILTERING/SORTING (Filters based on activePatient) ---
    const filteredAndSortedRecords = useMemo(() => {
        // 1. Determine which subset of records to use (filtered by activePatient)
        // If no patient is active, return an empty array, so no records are rendered on the list screen.
        const currentRecords = activePatient 
            ? records.filter(r => r.patientAddress === activePatient)
            : []; 

        // 2. Filter out records that are loading or failed loading metadata
        let processedRecords = currentRecords.filter(
            record => metadataCache[record.recordId] && metadataCache[record.recordId] !== 'loading'
        );

        // 3. Filter by Category
        if (filterCategory !== 'all') {
            processedRecords = processedRecords.filter(record =>
                metadataCache[record.recordId]?.category === filterCategory
            );
        }

        // 4. Sort
        processedRecords.sort((a, b) => {
            const metaA = metadataCache[a.recordId];
            const metaB = metadataCache[b.recordId];
            // [FIX]: Use record.createdAt (from MongoDB) instead of record.timestamp
            const dateA = new Date(a.createdAt || 0); 
            const dateB = new Date(b.createdAt || 0);

            switch (sortBy) {
                case 'date-asc':
                    return dateA - dateB;
                case 'category':
                    return (metaA?.category || '').localeCompare(metaB?.category || '');
                case 'date-desc':
                default:
                    return dateB - dateA;
            }
        });

        return processedRecords;
    }, [records, metadataCache, filterCategory, sortBy, activePatient]);
    // --- (END MEMO) ---

    // --- MODIFIED: Single function to handle both View and Download ---
    const handleRecordAction = async (record, actionType) => {
        if (!keyPair?.privateKey) return toast.error("Security keys not loaded.");

        const metadata = metadataCache[record.recordId];
        if (!metadata) return toast.error("Record details are still loading.");

        setDecryptingId(record.recordId);
        const toastId = toast.loading(`Preparing for ${actionType}...`);
        
        try {
            const bundleHash = metadata.encryptedBundleIPFSHash;
            if (!bundleHash) throw new Error("Encrypted file hash is missing.");

            const bundleResponse = await fetchFromIPFS(bundleHash); 
            const encryptedBundle = await bundleResponse.json();

            toast.loading("Unwrapping secure key...", { id: toastId });

            const symmetricKey = await unwrapSymmetricKey(record.rewrappedKey, encryptedBundle.iv, keyPair.privateKey);

            toast.loading("Decrypting file...", { id: toastId });
            const decryptedData = await window.crypto.subtle.decrypt(
                { name: 'AES-GCM', iv: new Uint8Array(encryptedBundle.iv) },
                symmetricKey,
                new Uint8Array(encryptedBundle.encryptedData)
            );

            const blob = new Blob([decryptedData], { type: metadata.fileType || 'application/octet-stream' });
            const url = window.URL.createObjectURL(blob);

            if (actionType === 'view') {
                window.open(url, '_blank');
            } else if (actionType === 'download') {
                // Create a temporary link element to trigger the download
                const a = document.createElement('a');
                a.href = url;
                // Generate a clean filename: replace non-alphanumeric/hyphen/dot characters with underscores
                // [FIX] Use metadata.fileName if available, fallback to title
                const cleanFilename = metadata.fileName || metadata.title.replace(/[^a-z0-9\-\.]/gi, '_');
                
                // [FIX] Ensure file extension is present
                const fileExtension = metadata.fileType?.split('/').pop();
                let finalFilename = cleanFilename;
                if (fileExtension && !cleanFilename.endsWith(`.${fileExtension}`)) {
                    // Avoid adding extension if it's already there (e.g., from metadata.fileName)
                    const baseName = cleanFilename.split('.').slice(0,-1).join('.');
                    if (baseName.length > 0 && cleanFilename.endsWith(fileExtension)) {
                         // Looks like it has an extension, trust it
                         finalFilename = cleanFilename;
                    } else if (!cleanFilename.includes('.')) {
                        // No extension at all, add it
                        finalFilename = `${cleanFilename}.${fileExtension}`;
                    }
                    // If it has a different extension, we trust the original filename
                } else if (!cleanFilename.includes('.')) {
                    finalFilename = `${cleanFilename}.dat`; // fallback
                }

                a.download = finalFilename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            }

            setTimeout(() => URL.revokeObjectURL(url), 1000); 

            toast.success(`Record ${actionType === 'view' ? 'opened' : 'downloaded'}!`, { id: toastId });
        } catch (error) {
            console.error("Action error:", error);
            toast.error(error.message || `Could not ${actionType} the record.`, { id: toastId });
        } finally {
            setDecryptingId(null);
        }
    };
    // --- (END MODIFIED LOGIC) ---


    // --- New Component: Patient Selection List ---
    const PatientSelectionList = () => (
        <motion.div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-4"
            variants={cardContainerVariants}
            initial="hidden"
            animate="visible"
        >
            <h2 className="text-xl font-bold text-gray-800 lg:col-span-3 mb-2">Patients Sharing Records ({groupedRecords.length})</h2>
            {groupedRecords.map((group, index) => (
                <motion.button
                    key={group.patientAddress}
                    variants={cardItemVariants}
                    custom={index}
                    onClick={() => {
                        // Reset filters when changing patient
                        setFilterCategory('all');
                        setSortBy('date-desc');
                        setActivePatient(group.patientAddress);
                    }}
                    className="flex flex-col items-start p-5 bg-white rounded-2xl shadow-xl border border-gray-100 hover:bg-blue-50/50 hover:border-blue-200 transition-all duration-300 text-left"
                >
                    <div className="flex items-center space-x-3">
                        <User className="h-6 w-6 text-blue-600 flex-shrink-0" />
                        <h3 className="text-lg font-semibold text-gray-900 truncate">
                            {group.patientName || 'Unknown Patient'}
                        </h3>
                    </div>
                    <p className="text-xs text-gray-500 font-mono mt-1 w-full truncate">
                        {group.patientAddress}
                    </p>
                    <div className="mt-3 text-sm font-medium bg-blue-100 text-blue-800 px-3 py-1 rounded-full">
                        {group.recordCount} Shared Record{group.recordCount !== 1 ? 's' : ''}
                    </div>
                </motion.button>
            ))}
        </motion.div>
    );

    // --- Final Render Logic ---
    if (!records || records.length === 0) {
        return (
            <div className="text-center p-8 text-gray-500 bg-gray-50 rounded-xl">
                <ShieldPlus className="h-10 w-10 mx-auto text-gray-400" />
                <h3 className="text-lg font-semibold text-gray-700 mt-2">No Records Found</h3>
                <p className="mt-1">You have no shared records to review.</p>
            </div>
        );
    }
    
    // Logic to decide between Patient List or Record View
    // REVISED LOGIC: Show the list if activePatient is null. The only exception is the single-patient auto-selection handled by the useEffect.
    const shouldShowPatientList = activePatient === null;

    if (shouldShowPatientList) {
        return <PatientSelectionList />;
    }

    // --- Record View Mode (Renders only if a patient is active) ---
    
    // Find the currently selected patient's details
    const currentPatient = groupedRecords.find(g => g.patientAddress === activePatient) || {};
    const patientName = currentPatient.patientName || activePatient.slice(0, 8) + '...';
    
    return (
        <div className="p-4 bg-gray-50/50 rounded-xl min-h-[500px]">
            {/* Header and Back Button */}
            <div className="flex items-center justify-between mb-6 border-b pb-4">
                <div className="flex items-center gap-3 min-w-0">
                    {/* Only show back button if there is more than one patient to return to */}
                    {groupedRecords.length > 1 && (
                        <button 
                            onClick={() => setActivePatient(null)} 
                            className="p-2 rounded-full bg-gray-200 hover:bg-gray-300 text-gray-700 transition flex-shrink-0"
                            title="Back to Patient List"
                        >
                            <ChevronLeft className="h-6 w-6" />
                        </button>
                    )}
                    <h2 className="text-xl md:text-2xl font-bold text-gray-800 truncate min-w-0">
                        Records for: {patientName}
                    </h2>
                </div>
                
                {/* Control Bar for Filters/Sort (Moved inside Record View Mode) */}
                <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 flex-shrink-0">
                    <select
                        value={filterCategory}
                        onChange={(e) => setFilterCategory(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
                    >
                        {Object.entries(CATEGORIES_MAP).map(([id, name]) => (
                            <option key={id} value={id}>{name}</option>
                        ))}
                    </select>
                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
                    >
                        <option value="date-desc">Shared: Newest</option>
                        <option value="date-asc">Shared: Oldest</option>
                        <option value="category">Category</option>
                    </select>
                </div>
            </div>

            {/* Content Grid */}
            <motion.div
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
                variants={cardContainerVariants}
                initial="hidden"
                animate="visible"
            >
                {/* Skeletons for loading metadata */}
                {records
                    .filter(r => r.patientAddress === activePatient)
                    .filter(r => metadataCache[r.recordId] === 'loading' || metadataCache[r.recordId] === undefined)
                    .map(r => <DoctorRecordCardSkeleton key={r.recordId} />)}

                {/* Filtered & Sorted Records */}
                {filteredAndSortedRecords.length > 0 ? (
                    filteredAndSortedRecords.map((record, index) => (
                        <DoctorRecordCard
                            key={record.recordId}
                            record={record}
                            metadata={metadataCache[record.recordId]}
                            // --- MODIFIED: Pass handler function with action type ---
                            onView={() => handleRecordAction(record, 'view')}
                            onDownload={() => handleRecordAction(record, 'download')}
                            // ---
                            isDecrypting={decryptingId === record.recordId}
                            customIndex={index}
                        />
                    ))
                ) : (
                    <div className="col-span-full">
                        <p className="text-gray-500 text-center py-8">
                            {records.filter(r => r.patientAddress === activePatient && metadataCache[r.recordId] !== 'loading').length === 0
                                ? "No records available for this patient."
                                : "No records match your current filters for this patient."}
                        </p>
                    </div>
                )}

                {/* Error Cards */}
                {records
                    .filter(r => r.patientAddress === activePatient)
                    .filter(r => metadataCache[r.recordId] === null)
                    .map(r => <DoctorRecordCardError key={r.recordId} record={r} />)}
            </motion.div>
        </div>
    );
}

// --- (UNMODIFIED) Card Component, Helpers, and Skeletons ---

const DoctorRecordCard = ({ record, metadata, onView, onDownload, isDecrypting, customIndex }) => {
    const meta = metadata || {};
    const category = meta.category || 'other';
    const title = meta.title || "Record Metadata Missing";

    const { Icon, color, borderColor } = getCategoryStyling(category);

    return (
        <motion.div
            variants={cardItemVariants}
            initial="hidden"
            animate="visible"
            custom={customIndex}
            whileHover={{ scale: 1.03 }}
            className={`flex flex-col justify-between bg-white rounded-2xl shadow-xl border border-gray-100 p-5 ${borderColor} border-t-4 transition-all duration-300`}
        >
            <div>
                {/* Card Header */}
                <div className="flex items-center gap-3">
                    <Icon className={`${color} h-7 w-7 flex-shrink-0`} />
                    <h3 className="text-lg font-bold text-gray-900 break-words truncate">
                        {title}
                    </h3>
                </div>

                {/* Card Body: Details */}
                <div className="space-y-3 mt-4">
                    <InfoRow
                        Icon={User}
                        label="Patient"
                        value={record.patientName || record.patientAddress.slice(0, 6) + '...'}
                        iconColor="text-gray-500"
                    />
                    <InfoRow
                        Icon={Calendar}
                        label="Shared On"
                        // [FIX]: Use record.createdAt (from MongoDB) instead of record.timestamp
                        value={record.createdAt ? format(new Date(record.createdAt), "PP") : "Unknown"}
                    />
                    <div className="mt-2">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getCategoryBadgeStyle(category)}`}>
                            {CATEGORIES_MAP[category] || 'Other'}
                        </span>
                    </div>
                </div>
            </div>

            {/* Card Footer: Actions --- MODIFIED to include two buttons --- */}
            <div className="flex justify-end gap-2 mt-6">
                <button
                    onClick={onDownload}
                    disabled={isDecrypting || !metadata}
                    className="flex items-center gap-1.5 px-3 py-2 text-white bg-green-600 rounded-lg shadow-md hover:bg-green-700 transition-colors disabled:bg-gray-400"
                >
                    {/* [FIX] Use isDecrypting prop */}
                    {isDecrypting ? <Loader2 className="h-5 w-5 animate-spin" /> : <DownloadCloud className="h-5 w-5" />}
                    <span>Download</span>
                </button>
                <button
                    onClick={onView}
                    disabled={isDecrypting || !metadata}
                    className="flex items-center gap-1.5 px-3 py-2 text-white bg-blue-600 rounded-lg shadow-md hover:bg-blue-700 transition-colors disabled:bg-gray-400"
                >
                    {/* [FIX] Use isDecrypting prop */}
                    {isDecrypting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Eye className="h-5 w-5" />}
                    <span>View</span>
                </button>
            </div>
        </motion.div>
    );
};

// --- (UNMODIFIED) InfoRow Helper ---
const InfoRow = ({ Icon, label, value, iconColor = "text-gray-500" }) => (
    <div className="flex items-center gap-2 text-sm">
        <Icon className={`h-4 w-4 ${iconColor} flex-shrink-0`} />
        <span className="text-gray-500">{label}:</span>
        <span className="font-medium text-gray-800 truncate">{value}</span>
    </div>
);

// --- (UNMODIFIED) Skeleton Card ---
const DoctorRecordCardSkeleton = () => (
    <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-5 animate-pulse">
        <div className="flex items-center gap-3">
            <div className="h-7 w-7 bg-gray-200 rounded-lg"></div>
            <div className="h-5 bg-gray-200 rounded-lg w-3/4"></div>
        </div>
        <div className="space-y-3 mt-4">
            <div className="h-4 bg-gray-200 rounded-lg w-1/2"></div>
            <div className="h-4 bg-gray-200 rounded-lg w-2/3"></div>
            <div className="h-5 bg-gray-200 rounded-full w-1/3"></div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
            <div className="h-9 w-20 bg-gray-200 rounded-lg"></div>
            <div className="h-9 w-20 bg-gray-200 rounded-lg"></div>
        </div>
    </div>
);

// --- (UNMODIFIED) Error Card ---
const DoctorRecordCardError = ({ record }) => (
    <div className="flex flex-col justify-between bg-red-50 rounded-2xl shadow-xl border p-5 border-t-4 border-red-500">
        <div>
            <div className="flex items-center gap-3">
                <AlertTriangle className="h-7 w-7 text-red-600 flex-shrink-0" />
                <h3 className="text-lg font-bold text-red-900 break-words">Loading Failed</h3>
            </div>
            <p className="text-sm text-red-700 mt-2">Could not load metadata for this record (ID: ...{record.recordId.slice(-6)}).</p>
        </div>
        <div className="flex justify-end gap-2 mt-6">
            <button
                disabled={true}
                className="flex items-center gap-1.5 px-3 py-2 text-white bg-gray-400 rounded-lg"
            >
                <Eye className="h-5 w-5" />
                <span>View</span>
            </button>
        </div>
    </div>
);

