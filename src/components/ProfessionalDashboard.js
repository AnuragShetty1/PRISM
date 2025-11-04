"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useWeb3 } from '../context/Web3Context';
import toast from 'react-hot-toast';
import VerifiedUploadForm from './VerifiedUploadForm';
import DoctorRecordList from './DoctorRecordList';
import axios from 'axios';
import {
    Stethoscope, UploadCloud, FileSearch, HeartHandshake, Search, User,
    X as CloseIcon, ChevronDown, Info, Loader2,
    TestTube, ClipboardList, ShieldPlus, Ribbon,
    Beaker,FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';

// --- ROLE CONFIGURATIONS ---
const DOCTOR_CATEGORIES = [
    { value: 'doctor-note', label: "Doctor's Note" },
    { value: 'prescription', label: 'Prescription' },
    { value: 'lab-result', label: 'Lab Result' },
    { value: 'other', label: 'Other' },
];

const LAB_TECHNICIAN_CATEGORIES = [
    { value: 'blood-test', label: 'Blood Test' },
    { value: 'urinalysis', label: 'Urinalysis' },
    { value: 'imaging-report', label: 'Imaging Report' },
    { value: 'biopsy-report', label: 'Biopsy Report' },
    { value: 'microbiology', label: 'Microbiology' },
    { value: 'other', label: 'Other' },
];

// Comprehensive map for RequestAccessSection filtering/display
const CATEGORIES_MAP = {
    'all': 'All Categories',
    'lab-result': 'Lab Results',
    'prescription': 'Prescriptions',
    'doctor-note': 'Doctor Notes',
    'insurance-claim': 'Insurance', 
    'blood-test': 'Blood Test',
    'urinalysis': 'Urinalysis',
    'imaging-report': 'Imaging Report',
    'biopsy-report': 'Biopsy Report',
    'microbiology': 'Microbiology',
    'other': 'Other',
};

export const PROFESSIONAL_CONFIGS = {
    doctor: {
        roleName: 'Doctor',
        themeColor: 'blue',
        themeAccents: { bg: 'bg-blue-100', text: 'text-blue-600', hover: 'hover:bg-blue-700', ring: 'focus:ring-blue-500', tabIndicator: 'bg-blue-600' },
        icon: Stethoscope,
        welcomeMessage: 'Welcome to your clinical workspace.',
        allowedCategories: DOCTOR_CATEGORIES,
    },
    labtechnician: {
        roleName: 'Lab Technician',
        themeColor: 'emerald',
        themeAccents: { bg: 'bg-emerald-100', text: 'text-emerald-600', hover: 'hover:bg-emerald-700', ring: 'focus:ring-emerald-500', tabIndicator: 'bg-emerald-600' },
        icon: Beaker,
        welcomeMessage: 'Welcome to your laboratory workspace.',
        allowedCategories: LAB_TECHNICIAN_CATEGORIES,
    },
};

// --- ANIMATION VARIANTS ---
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

// --- HELPER FUNCTIONS ---
const getCategoryIcon = (category) => {
    switch (category) {
        case 'lab-result':
        case 'blood-test':
        case 'urinalysis':
        case 'imaging-report':
        case 'biopsy-report':
        case 'microbiology':
            return TestTube;
        case 'prescription': return ClipboardList;
        case 'doctor-note': return Stethoscope;
        case 'insurance-claim': return ShieldPlus;
        default: return Ribbon;
    }
};

// --- DYNAMIC HEADER ---
const ProfessionalHeader = ({ userProfile, config }) => {
    const Icon = config.icon;
    const { roleName, welcomeMessage, themeAccents } = config;

    return (
        <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 md:p-8"
        >
            {!userProfile ? (
                <div className="animate-pulse">
                    <div className="flex items-center gap-4">
                        <div className="bg-gray-200 p-3 rounded-lg h-14 w-14"></div>
                        <div>
                            <div className="h-8 w-48 bg-gray-200 rounded-md"></div>
                            <div className="h-5 w-64 bg-gray-200 rounded-md mt-3"></div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="flex items-center gap-4">
                    <div className={`${themeAccents.bg} ${themeAccents.text} p-3 rounded-lg`}>
                        <Icon className="h-8 w-8" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">
                            {roleName === 'Doctor' ? 'Dr. ' : ''}{userProfile.name}
                        </h1>
                        <p className="mt-1 text-lg text-gray-600">
                            {welcomeMessage}
                        </p>
                    </div>
                </div>
            )}
        </motion.div>
    );
};

// --- DYNAMIC TAB NAVIGATION ---
const TabNavigation = ({ activeTab, onTabChange, config }) => {
    const { themeColor, themeAccents } = config;
    const tabs = [
        { id: 'upload', label: 'Upload New Record', icon: UploadCloud },
        { id: 'request', label: 'Request Record Access', icon: HeartHandshake },
        { id: 'review', label: 'Review Shared Records', icon: FileSearch },
    ];

    return (
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-2">
            <nav className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
                {tabs.map((tab) => {
                    const Icon = tab.icon;
                    // Dynamically set text color for active/hover states
                    const activeTextColor = `text-${themeColor}-700`;
                    const inactiveTextColor = 'text-gray-600 hover:text-gray-900 hover:bg-gray-50';

                    return (
                        <button
                            key={tab.id}
                            onClick={() => onTabChange(tab.id)}
                            className={`relative flex-1 flex justify-center items-center gap-2 px-4 py-3 text-sm font-semibold rounded-lg transition-colors ${activeTab === tab.id
                                    ? activeTextColor
                                    : inactiveTextColor
                                }`}
                        >
                            <Icon className="h-5 w-5" />
                            <span>{tab.label}</span>
                            {activeTab === tab.id && (
                                <motion.div
                                    layoutId="professionalTabIndicator"
                                    className={`absolute bottom-0 left-0 right-0 h-1 ${themeAccents.tabIndicator} rounded-full`}
                                />
                            )}
                        </button>
                    );
                })}
            </nav>
        </div>
    );
};

// --- PATIENT SEARCH COLUMN (RETAINING CUSTOM DEBOUNCE LOGIC) ---
const PatientSearchColumn = ({ onPatientSelect }) => {
    const [searchQuery, setSearchQuery] = useState('');
    // Implemented custom debounce logic from original DoctorView.js
    const [debouncedQuery, setDebouncedQuery] = useState(searchQuery);
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [searchMessage, setSearchMessage] = useState('Start typing to find a patient...');

    // --- MODIFICATION: Add API_BASE_URL for deployment ---
    const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';

    // Custom debounce implementation adopted from DoctorView.js
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedQuery(searchQuery);
        }, 300);

        return () => {
            clearTimeout(handler);
        };
    }, [searchQuery]);

    useEffect(() => {
        const searchPatients = async () => {
            if (debouncedQuery.length < 3) {
                setSearchResults([]);
                setIsSearching(false);
                setSearchMessage(debouncedQuery.length > 0 ? 'Keep typing...' : 'Start typing to find a patient...');
                return;
            }
            setIsSearching(true);
            setSearchMessage('');
            try {
                // Note: The original implementation used axios, which is preserved.
                // --- MODIFICATION: Use API_BASE_URL ---
                const response = await axios.get(`${API_BASE_URL}/api/users/search-patients?q=${debouncedQuery}`);
                if (response.data.success) {
                    setSearchResults(response.data.data);
                    if (response.data.data.length === 0) {
                        setSearchMessage(`No patients found for "${debouncedQuery}".`);
                    }
                }
            } catch (error) {
                toast.error(error.response?.data?.message || "Search failed.");
                setSearchMessage("Error during search.");
            } finally {
                setIsSearching(false);
            }
        };
        searchPatients();
    }, [debouncedQuery, API_BASE_URL]); // --- MODIFICATION: Add API_BASE_URL dependency ---

    return (
        <div className="border border-gray-200 rounded-lg bg-gray-50/50 p-4 h-full min-h-[400px] lg:min-h-[500px]">
            <h3 className="font-bold text-gray-800 mb-3 text-lg">Find Patient</h3>
            <div className="relative mb-3">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-5 w-5 text-gray-400" />
                </div>
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Name or wallet address..."
                    // Uses generic blue accent for search input for standardization across professional roles
                    className="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 transition"
                />
                {isSearching && <div className="absolute inset-y-0 right-0 pr-3 flex items-center"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>}
            </div>
            <div className="overflow-y-auto h-[calc(100%-80px)]">
                {searchResults.length > 0 ? (
                    <div className="divide-y divide-gray-200">
                        {searchResults.map((patient) => (
                            <button key={patient.address} onClick={() => onPatientSelect(patient)} className="w-full text-left p-3 hover:bg-blue-50 rounded-md transition-colors flex items-center gap-3">
                                <User className="w-5 h-5 text-blue-500 flex-shrink-0" />
                                <div className="min-w-0">
                                    <p className="font-medium text-gray-800 truncate">{patient.name}</p>
                                    <p className="text-xs text-gray-500 font-mono truncate">{patient.address}</p>
                                </div>
                            </button>
                        ))}
                    </div>
                ) : (
                    <div className="text-center pt-12 text-gray-500">{searchMessage}</div>
                )}
            </div>
        </div>
    );
};

// --- DYNAMIC UPLOAD SECTION ---
const UploadSection = ({ config }) => {
    const [patientProfile, setPatientProfile] = useState(null);
    const { themeColor, allowedCategories } = config;

    // Dynamically constructing classes using string interpolation
    // Note: Tailwind requires full class names to be present in the source code.
    // We use a dynamic approach here, assuming the JIT compiler can infer them, 
    // or rely on explicit full class definitions (which are defined in the config for safety).
    const selectedAccentClass = themeColor === 'blue' ? 'bg-blue-50 border-blue-200' : 'bg-emerald-50 border-emerald-200';
    const textAccentClass = themeColor === 'blue' ? 'text-blue-700' : 'text-emerald-700';
    const buttonTextAccentClass = themeColor === 'blue' ? 'text-blue-600 hover:text-blue-800' : 'text-emerald-600 hover:text-emerald-800';
    const textAccent900 = themeColor === 'blue' ? 'text-blue-900' : 'text-emerald-900';

    return (
        <motion.div
            className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 md:p-8"
            variants={cardItemVariants}
            initial="hidden"
            animate="visible"
        >
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1">
                    <PatientSearchColumn onPatientSelect={setPatientProfile} />
                </div>
                <div className="lg:col-span-2">
                    {patientProfile ? (
                        <div className="space-y-4">
                            <div className={`${selectedAccentClass} p-4 rounded-lg border flex justify-between items-center`}>
                                <div>
                                    <p className={`text-sm ${textAccentClass}`}>Selected Patient:</p>
                                    <p className={`font-bold ${textAccent900}`}>{patientProfile.name}</p>
                                </div>
                                <button onClick={() => setPatientProfile(null)} className={`text-sm font-semibold ${buttonTextAccentClass} flex items-center gap-1`}>
                                    <CloseIcon className="h-4 w-4" /> Clear
                                </button>
                            </div>
                            <VerifiedUploadForm
                                patientProfile={{ ...patientProfile, walletAddress: patientProfile.address }}
                                onUploadSuccess={() => setPatientProfile(null)}
                                allowedCategories={allowedCategories}
                                themeColor={themeColor} // Pass themeColor down
                            />
                        </div>
                    ) : (
                        <div className="h-full min-h-[400px] lg:min-h-[500px] flex flex-col justify-center items-center text-center p-8 bg-gray-50/50 border border-gray-200 rounded-lg">
                            <User className="h-16 w-16 text-gray-300 mb-4" />
                            <h3 className="text-lg font-semibold text-gray-700">Select a Patient</h3>
                            <p className="text-gray-500 mt-1 max-w-xs">Use the search panel on the left to find and select a patient to begin uploading a record.</p>
                        </div>
                    )}
                </div>
            </div>
        </motion.div>
    );
};

// --- DYNAMIC REQUEST ACCESS SECTION ---
const RequestAccessSection = ({ config }) => {
    const { api } = useWeb3();
    const [patientProfile, setPatientProfile] = useState(null);
    const [patientRecords, setPatientRecords] = useState([]);
    const [isLoadingRecords, setIsLoadingRecords] = useState(false);
    const [selectedRecords, setSelectedRecords] = useState(new Set());
    const [justification, setJustification] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [filterCategory, setFilterCategory] = useState('all');
    const [sortBy, setSortBy] = useState('date-desc');

    const { themeColor, themeAccents } = config;

    // --- MODIFICATION: Add API_BASE_URL for deployment ---
    const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';

    const filteredAndSortedRecords = useMemo(() => {
        let processedRecords = [...patientRecords];

        // 1. Filter
        if (filterCategory !== 'all') {
            processedRecords = processedRecords.filter(record => record.category === filterCategory);
        }

        // 2. Sort
        processedRecords.sort((a, b) => {
            const dateA = new Date(Number(a.timestamp) * 1000);
            const dateB = new Date(Number(b.timestamp) * 1000);
            switch (sortBy) {
                case 'date-asc':
                    return dateA - dateB;
                case 'category':
                    return (a.category || '').localeCompare(b.category || '');
                case 'date-desc':
                default:
                    return dateB - dateA;
            }
        });

        return processedRecords;
    }, [patientRecords, filterCategory, sortBy]);

    useEffect(() => {
        const fetchPatientRecords = async () => {
            if (!patientProfile) return;
            setIsLoadingRecords(true);
            setPatientRecords([]);
            try {
                // --- MODIFICATION: Use API_BASE_URL ---
                const response = await axios.get(`${API_BASE_URL}/api/users/records/patient/${patientProfile.address}`);
                setPatientRecords(response.data.data);
            } catch (error) {
                toast.error(error.response?.data?.message || "Could not fetch patient's records.");
            } finally {
                setIsLoadingRecords(false);
            }
        };
        fetchPatientRecords();
    }, [patientProfile, API_BASE_URL]); // --- MODIFICATION: Add API_BASE_URL dependency ---

    const handleRecordSelect = (recordId) => {
        setSelectedRecords(prev => {
            const newSet = new Set(prev);
            if (newSet.has(recordId)) newSet.delete(recordId);
            else newSet.add(recordId);
            return newSet;
        });
    };

    const handleSelectAll = (e) => {
        if (e.target.checked) {
            const allFilteredIds = filteredAndSortedRecords.map(r => r.recordId);
            setSelectedRecords(new Set(allFilteredIds));
        } else {
            setSelectedRecords(new Set());
        }
    };

    const handleSubmitRequest = async () => {
        if (selectedRecords.size === 0) return toast.error("Please select at least one record.");
        if (!api || !patientProfile) return toast.error("API service not loaded or patient not selected.");
        if (!justification.trim()) return toast.error("A justification is required to request records.");

        setIsSubmitting(true);
        const toastId = toast.loading("Submitting access request...");
        try {
            await api.requestRecordAccess(
                patientProfile.address,
                Array.from(selectedRecords),
                justification
            );
            toast.success("Access request submitted!", { id: toastId });
            setSelectedRecords(new Set());
            setJustification('');
            setFilterCategory('all');
            setSortBy('date-desc');
        } catch (error) {
            console.error("Failed to submit request:", error);
            toast.error(error.message || "An error occurred.", { id: toastId });
        } finally {
            setIsSubmitting(false);
        }
    };

    // Dynamic Tailwind Classes
    const selectedAccentClass = themeColor === 'blue' ? 'bg-blue-50' : 'bg-emerald-50';
    const textAccentClass = themeColor === 'blue' ? 'text-blue-700' : 'text-emerald-700';
    const buttonTextAccentClass = themeColor === 'blue' ? 'text-blue-600 hover:text-blue-800' : 'text-emerald-600 hover:text-emerald-800';
    const borderAccentClass = themeColor === 'blue' ? 'border-blue-400' : 'border-emerald-400';
    const submitButtonClass = themeColor === 'blue' ? 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500' : 'bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-500';
    const checkboxClass = `h-5 w-5 rounded border-gray-300 text-${themeColor}-600 focus:ring-${themeColor}-500`;
    const textAccent900 = themeColor === 'blue' ? 'text-blue-900' : 'text-emerald-900';

    return (
        <motion.div
            className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 md:p-8"
            variants={cardItemVariants}
            initial="hidden"
            animate="visible"
        >
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1">
                    <PatientSearchColumn onPatientSelect={setPatientProfile} />
                </div>
                <div className="lg:col-span-2">
                    {patientProfile ? (
                        <div className="space-y-4">
                            <div className={`${selectedAccentClass} p-4 rounded-lg border border-${themeColor}-200 flex justify-between items-center`}>
                                <div>
                                    <p className={`text-sm ${textAccentClass}`}>Requesting access for:</p>
                                    <p className={`font-bold ${textAccent900}`}>{patientProfile.name}</p>
                                </div>
                                <button onClick={() => setPatientProfile(null)} className={`text-sm font-semibold ${buttonTextAccentClass} flex items-center gap-1`}>
                                    <CloseIcon className="h-4 w-4" /> Clear
                                </button>
                            </div>
                            <div className="bg-white p-6 border border-gray-200 rounded-lg">
                                <h3 className="text-lg font-bold text-gray-800 mb-4">Select Records to Request</h3>

                                {/* CONTROL BAR */}
                                <div className="flex flex-col sm:flex-row gap-4 justify-between items-center mb-4 p-3 bg-gray-50 rounded-lg border">
                                    <div className="flex items-center">
                                        <input
                                            id="select-all-requests"
                                            type="checkbox"
                                            className={checkboxClass}
                                            onChange={handleSelectAll}
                                            checked={filteredAndSortedRecords.length > 0 && selectedRecords.size === filteredAndSortedRecords.length}
                                            disabled={filteredAndSortedRecords.length === 0}
                                        />
                                        <label htmlFor="select-all-requests" className="ml-2 text-sm font-medium text-gray-700">Select All</label>
                                    </div>
                                    <div className="flex gap-4">
                                        <select
                                            value={filterCategory}
                                            onChange={(e) => setFilterCategory(e.target.value)}
                                            className={`px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 ${themeAccents.ring} bg-white text-sm`}
                                        >
                                            {Object.entries(CATEGORIES_MAP).map(([id, name]) => (
                                                <option key={id} value={id}>{name}</option>
                                            ))}
                                        </select>
                                        <select
                                            value={sortBy}
                                            onChange={(e) => setSortBy(e.target.value)}
                                            className={`px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 ${themeAccents.ring} bg-white text-sm`}
                                        >
                                            <option value="date-desc">Date: Newest</option>
                                            <option value="date-asc">Date: Oldest</option>
                                            <option value="category">Category</option>
                                        </select>
                                    </div>
                                </div>
                                {/* END CONTROL BAR */}

                                {isLoadingRecords ? (
                                    <div className="flex justify-center items-center py-8"><Loader2 className="h-8 w-8 animate-spin text-gray-400" /></div>
                                ) : patientRecords.length === 0 ? (
                                    <p className="text-gray-500 text-center py-8">This patient has no records available to request.</p>
                                ) : filteredAndSortedRecords.length === 0 ? (
                                    <p className="text-gray-500 text-center py-8">No records match your filters.</p>
                                ) : (
                                    <div className="space-y-3 max-h-72 overflow-y-auto pr-2">
                                        {filteredAndSortedRecords.map(record => {
                                            const Icon = getCategoryIcon(record.category);
                                            const isSelected = selectedRecords.has(record.recordId);

                                            const isValidDate = record.timestamp && !isNaN(Number(record.timestamp));
                                            const displayDate = isValidDate ? format(new Date(Number(record.timestamp) * 1000), "PP") : "Invalid Date";

                                            return (
                                                <label
                                                    key={record.recordId}
                                                    className={`flex items-center p-3.5 rounded-lg border cursor-pointer transition-colors
                                                ${isSelected
                                                            ? `${selectedAccentClass} ${borderAccentClass}`
                                                            : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                                                        }
                                              `}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => handleRecordSelect(record.recordId)}
                                                        className={checkboxClass}
                                                    />
                                                    <Icon className="h-5 w-5 text-gray-500 ml-4 mr-3 flex-shrink-0" />
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-medium text-gray-800 truncate">{record.title}</p>
                                                        <p className="text-sm text-gray-500">
                                                            {displayDate}
                                                        </p>
                                                    </div>
                                                    <span className="ml-auto text-xs text-gray-600 bg-gray-200 px-2 py-1 rounded-full whitespace-nowrap">
                                                        {CATEGORIES_MAP[record.category] || 'Other'}
                                                    </span>
                                                </label>
                                            );
                                        })}
                                    </div>
                                )}

                                <div className="pt-6 mt-6 border-t border-gray-200">
                                    <label htmlFor="justification" className="block text-sm font-medium text-gray-700 mb-2">
                                        Reason for Request (Required)
                                    </label>
                                    <textarea
                                        id="justification"
                                        rows="3"
                                        value={justification}
                                        onChange={(e) => setJustification(e.target.value)}
                                        className={`w-full px-3 py-2.5 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 ${themeAccents.ring} transition`}
                                        placeholder="e.g., 'Requesting consultation for follow-up on recent lab results.'"
                                        disabled={isSubmitting}
                                    ></textarea>
                                </div>
                                <div className="pt-6 mt-6 border-t border-gray-200">
                                    <button onClick={handleSubmitRequest} disabled={isSubmitting || selectedRecords.size === 0} className={`w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 font-semibold text-white ${submitButtonClass} rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors shadow-sm`}>
                                        {isSubmitting ? <><Loader2 className="h-5 w-5 animate-spin" /> Submitting...</> : <>Request Access to {selectedRecords.size} Record(s)</>}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="h-full min-h-[400px] lg:min-h-[500px] flex flex-col justify-center items-center text-center p-8 bg-gray-50/50 border border-gray-200 rounded-lg">
                            <User className="h-16 w-16 text-gray-300 mb-4" />
                            <h3 className="text-lg font-semibold text-gray-700">Select a Patient</h3>
                            <p className="text-gray-500 mt-1 max-w-xs">Use the search panel on the left to find a patient and view their available records.</p>
                        </div>
                    )}
                </div>
            </div>
        </motion.div>
    );
};

// --- REVIEW SECTION (No role-specific changes needed, uses DoctorRecordList which expects patient context) ---
const ReviewSection = () => {
    const { account } = useWeb3();
    const [patientGroups, setPatientGroups] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    // --- MODIFICATION: Add API_BASE_URL for deployment ---
    const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';

    const fetchSharedRecords = useCallback(async () => {
        if (!account) {
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        try {
            // --- MODIFICATION: Use API_BASE_URL ---
            const response = await axios.get(`${API_BASE_URL}/api/users/records/professional/${account}`);
            if (response.data.success) {
                // Sorting for consistent display
                const sortedGroups = response.data.data.sort((a, b) => 
                    (a.patient.name || '').localeCompare(b.patient.name || '')
                );
                setPatientGroups(sortedGroups);
            } else {
                setPatientGroups([]);
            }
        } catch (error) {
            console.error("Error fetching shared records:", error);
            // [MODIFIED] Add user-facing toast notification
            toast.error(error.response?.data?.message || "Could not fetch shared records.");
            setPatientGroups([]);
        } finally {
            setIsLoading(false);
        }
    }, [account, API_BASE_URL]); // --- MODIFICATION: Add API_BASE_URL dependency ---

    useEffect(() => {
        fetchSharedRecords();
    }, [fetchSharedRecords]);

    const allRecords = useMemo(() => {
        return patientGroups.flatMap(group => {
            if (group.patient && group.records) {
                return group.records.map(record => ({
                    ...record,
                    patientName: group.patient.name,
                    patientAddress: group.patient.address,
                }));
            }
            return [];
        });
    }, [patientGroups]);

    if (isLoading) {
        return (
            <motion.div
                className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 md:p-8 flex justify-center items-center min-h-[300px]"
                variants={cardItemVariants}
                initial="hidden"
                animate="visible"
            >
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                <p className="ml-4 text-gray-500">Loading shared records...</p>
            </motion.div>
        );
    }

    if (allRecords.length === 0) {
        return (
            <motion.div
                className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 md:p-8 flex flex-col justify-center items-center text-center min-h-[300px]"
                variants={cardItemVariants}
                initial="hidden"
                animate="visible"
            >
                <Info className="h-12 w-12 mx-auto text-gray-400" />
                <h3 className="mt-4 text-xl font-bold text-gray-800">No Records Found</h3>
                <p className="mt-1 text-gray-500">Patients who share records with you will appear here.</p>
            </motion.div>
        );
    }

    return (
        <motion.div
            className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 md:p-8"
            variants={cardItemVariants}
            initial="hidden"
            animate="visible"
        >
            {/* The DoctorRecordList component is used here as it handles the logic for viewing records shared by a patient. */}
            <DoctorRecordList records={allRecords} isFlattenedView={true} />
        </motion.div>
    );
};

// --- MAIN PROFESSIONAL DASHBOARD COMPONENT ---
export default function ProfessionalDashboard({ role }) {
    const { userProfile } = useWeb3();
    const [activeTab, setActiveTab] = useState('upload');

    // Default to doctor if role is undefined or invalid
    const config = PROFESSIONAL_CONFIGS[role] || PROFESSIONAL_CONFIGS.doctor;

    return (
        <div className="min-h-screen bg-gray-50 p-6 md:p-10">
            <div className="w-full max-w-7xl mx-auto space-y-8">
                <ProfessionalHeader userProfile={userProfile} config={config} />

                <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} config={config} />

                <main>
                    <AnimatePresence>
                        <motion.div
                            key={activeTab}
                            className="w-full"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.2 }}
                        >
                            {activeTab === 'upload' && <UploadSection config={config} />}
                            {activeTab === 'request' && <RequestAccessSection config={config} />}
                            {activeTab === 'review' && <ReviewSection />}
                        </motion.div>
                    </AnimatePresence>
                </main>
            </div>
        </div>
    );
}
