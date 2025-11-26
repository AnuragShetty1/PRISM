"use client";

import { useState, useRef, useEffect } from 'react';
import { useWeb3 } from '@/context/Web3Context';
import toast from 'react-hot-toast';
import HospitalRequestPending from './HospitalRequestPending';
// import HospitalRegistrationForm from './HospitalRegistrationForm'; // No longer needed
import ConfirmationModal from './ConfirmationModal';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    User, 
    Building, 
    Stethoscope, 
    Beaker, 
    Loader2, 
    Check, 
    Circle, 
    ArrowLeft,
    ChevronRight
} from 'lucide-react';

const roles = [
    { id: 0, name: 'Patient', description: 'The owner of the medical records.', icon: User, isProfessional: false },
    { id: 1, name: 'Doctor', description: 'A verified healthcare professional.', icon: Stethoscope, isProfessional: true },
    { id: 7, name: 'Lab Technician', description: 'Uploads verified lab test results.', icon: Beaker, isProfessional: true },
    { id: 'register_hospital', name: 'Register Hospital', description: 'Become a Hospital Administrator for your organization.', icon: Building, isProfessional: false },
];

const professionalRoles = roles.filter(r => r.isProfessional).map(r => r.id);

const Stepper = ({ currentStep }) => {
    const steps = ['Select Role', 'Your Details', 'Confirm & Register'];
    return (
        // --- MODIFICATION: Reduced margin bottom ---
        <nav className="flex items-center justify-center mb-8" aria-label="Progress">
            <ol className="flex items-center space-x-2 sm:space-x-4">
                {steps.map((name, index) => {
                    const stepNumber = index + 1;
                    const isCompleted = stepNumber < currentStep;
                    const isCurrent = stepNumber === currentStep;

                    return (
                        <li key={name} className={`flex items-center ${stepNumber < steps.length ? 'flex-1' : ''}`}>
                            <div className="flex flex-col items-center">
                                <div className={`flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full transition-colors ${
                                    isCompleted ? 'bg-blue-600 text-white' : 
                                    isCurrent ? 'bg-blue-100 text-blue-600 border-2 border-blue-600' : 
                                    'bg-gray-100 text-gray-400 border-2 border-gray-200'
                                }`}>
                                    {isCompleted ? (
                                        <Check className="w-5 h-5 sm:w-6 sm:h-6" />
                                    ) : (
                                        <span className="font-semibold">{stepNumber}</span>
                                    )}
                                </div>
                                <span className={`mt-2 text-xs sm:text-sm font-medium text-center ${
                                    isCurrent ? 'text-blue-600' : 'text-gray-500'
                                }`}>{name}</span>
                            </div>
                            {stepNumber < steps.length && (
                                <ChevronRight className="w-5 h-5 text-gray-300 mx-2 sm:mx-4" />
                            )}
                        </li>
                    );
                })}
            </ol>
        </nav>
    );
};

export default function RegistrationForm() {
    // --- MERGE: Added refetchUserProfile ---
    const { account, checkUserRegistration, userStatus, api, refetchUserProfile } = useWeb3();
    
    // --- FIX: ADD API_BASE_URL TO FIX HARDCODED LOCALHOST ---
    const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';

    const [step, setStep] = useState(1); 
    
    // State for User/Professional Registration
    const [name, setName] = useState('');
    const [selectedHospital, setSelectedHospital] = useState('');
    const [hospitalSearch, setHospitalSearch] = useState('');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const hospitalDropdownRef = useRef(null);

    // --- MERGE: State for Hospital Registration ---
    const [hospitalName, setHospitalName] = useState('');

    // Shared State
    const [selectedRole, setSelectedRole] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [hospitals, setHospitals] = useState([]);
    const [modalState, setModalState] = useState({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => { },
        confirmText: '',
        confirmColor: 'bg-indigo-600',
    });

    // --- FIX: MOVED HOOKS BEFORE EARLY RETURN ---
    // Fetch existing hospitals (for professionals to select)
    useEffect(() => {
        const fetchHospitals = async () => {
            try {
                // --- FIX: Replaced hardcoded localhost ---
                const response = await fetch(`${API_BASE_URL}/api/super-admin/hospitals`);
                if (!response.ok) throw new Error('Failed to fetch hospitals');
                const data = await response.json();
                setHospitals(data.data || []);
            } catch (error) {
                console.error("Error fetching hospitals:", error);
                toast.error("Could not load hospital list.");
            }
        };
        fetchHospitals();
    }, [API_BASE_URL]); // Added API_BASE_URL as dependency

    // Dropdown click outside logic
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (hospitalDropdownRef.current && !hospitalDropdownRef.current.contains(event.target)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);
    // --- END OF MOVED HOOKS ---

    // --- SHARED MODAL LOGIC ---
    const closeModal = () => {
        if (isLoading) return;
        setModalState({ ...modalState, isOpen: false });
    };

    // --- LOGIC FOR USER/PROFESSIONAL REGISTRATION ---
    const openUserConfirm = () => {
        if (!account) { toast.error('Please connect your wallet first.'); return; }
        if (!name) { toast.error('Please enter your full name.'); return; }
        if (selectedRole === null) { toast.error('Please select a role.'); return; }

        const roleObject = roles.find(r => r.id === selectedRole);
        if (!roleObject) { toast.error('Invalid role selected.'); return; }

        const isProfessional = professionalRoles.includes(selectedRole);
        if (isProfessional && selectedHospital === '') {
            toast.error('Please select a hospital to affiliate with.');
            return;
        }

        const selectedHospitalName = isProfessional ? hospitals.find(h => h.hospitalId === selectedHospital)?.name : null;
        const confirmMessage = isProfessional
            ? `Are you sure you want to register as a ${roleObject.name} and request affiliation with ${selectedHospitalName}?`
            : `Are you sure you want to register as a ${roleObject.name}?`;

        setModalState({
            isOpen: true,
            title: 'Confirm Registration',
            message: confirmMessage,
            onConfirm: confirmUserSubmit, // Renamed function
            confirmText: 'Register',
            confirmColor: 'bg-blue-600' 
        });
    };
    
    // --- MERGE: LOGIC FOR HOSPITAL REGISTRATION ---
    const openHospitalConfirm = () => {
        if (!api) {
            toast.error("Please connect your wallet first.");
            return;
        }
        if (!hospitalName) {
            toast.error("Please enter a hospital name.");
            return;
        }

        setModalState({
            isOpen: true,
            title: 'Confirm Hospital Registration Request',
            message: `Are you sure you want to submit a registration request for "${hospitalName}"? Your current wallet address will be proposed as the administrator.`,
            onConfirm: confirmHospitalSubmit, // New function
            confirmText: 'Submit Request',
            confirmColor: 'bg-blue-600'
        });
    };

    // --- THIS IS THE EARLY RETURN THAT CAUSED THE ERROR ---
    if (userStatus === 'pending_hospital' || userStatus === 'rejected') {
        return <HospitalRequestPending />;
    }
    // --- THE HOOKS ARE NO LONGER BELOW THIS LINE ---

    // --- USER/PROFESSIONAL SUBMIT LOGIC ---
    const confirmUserSubmit = async () => {
        setIsLoading(true);
        const toastId = toast.loading('Processing registration...');
        
        setStep(3); // Move to final step (visual)

        try {
            const isProfessional = professionalRoles.includes(selectedRole);

            if (isProfessional) {
                toast.loading('Step 1/2: Creating on-chain identity...', { id: toastId });
                if (!api) { throw new Error('API service not initialized.'); }
                
                await api.registerUser(name, selectedRole, selectedHospital);
                
                toast.success('On-chain identity created!', { id: toastId });

                toast.loading('Step 2/2: Submitting affiliation request...', { id: toastId });
                const roleObject = roles.find(r => r.id === selectedRole);
                if (!roleObject) {
                    throw new Error("Selected role is invalid.");
                }

                // --- FIX: Replaced hardcoded localhost ---
                const response = await fetch(`${API_BASE_URL}/api/users/request-association`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: name,
                        address: account,
                        role: roleObject.name,
                        requestedHospitalId: selectedHospital
                    }),
                });

                const data = await response.json();
                if (!response.ok) {
                    throw new Error(data.message || `HTTP error! Status: ${response.status}`);
                }

                toast.success('Request submitted! Please wait for admin approval.', { id: toastId });

            } else { // Patient Registration
                toast.loading('Step 1/2: Creating on-chain identity...', { id: toastId });
                if (!api) { throw new Error('API service not initialized.'); }

                await api.registerUser(name, selectedRole, 0);

                toast.success('On-chain identity created!', { id: toastId });

                toast.loading('Step 2/2: Setting up your account...', { id: toastId });
                // --- FIX: Replaced hardcoded localhost ---
                const response = await fetch(`${API_BASE_URL}/api/users/register-patient`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: name,
                        address: account,
                    }),
                });

                const data = await response.json();
                if (!response.ok) {
                    throw new Error(data.message || `HTTP error! Status: ${response.status}`);
                }
                toast.success('Account setup complete! Redirecting...', { id: toastId });
            }

            await checkUserRegistration(); // Refetch user status (for users)

        } catch (error) {
            console.error("Registration failed:", error);
            toast.error(error.message || "Registration failed.", { id: toastId });
            setStep(2); // On error, send back to Step 2
        } finally {
            setIsLoading(false);
            closeModal();
        }
    };

    // --- MERGE: HOSPITAL SUBMIT LOGIC ---
    const confirmHospitalSubmit = async () => {
        setIsLoading(true);
        const toastId = toast.loading("Submitting hospital registration request...");

        setStep(3); // Move to final step (visual)

        try {
            await api.requestRegistration(hospitalName);

            toast.success("Request submitted successfully! A Super Admin will review it shortly.", { id: toastId, duration: 5000 });
            setHospitalName(''); // Clear form on success

            // --- THIS IS THE FIX ---
            // The line `await checkUserRegistration()` has been removed.
            // The optimistic update in `Web3Context.js` will now correctly
            // set the state to 'pending_hospital' without being overwritten.
            // --- END OF FIX ---

        } catch (error) {
            console.error("Hospital registration request failed:", error);
            toast.error(error.message || "An error occurred.", { id: toastId });
            setStep(2); // On error, send back to Step 2
        } finally {
            setIsLoading(false);
            closeModal();
        }
    };

    // This handler is only for the User/Professional form
    const handleSubmit = (e) => {
        e.preventDefault();
        openUserConfirm();
    };

    // This handler is only for the Hospital form
    const handleHospitalSubmit = (e) => {
        e.preventDefault();
        openHospitalConfirm();
    };


    const handleRoleSelect = (roleId) => {
        setSelectedRole(roleId);
        setStep(2);
    };

    const isProfessionalRoleSelected = selectedRole !== null && professionalRoles.includes(selectedRole);
    const filteredHospitals = hospitals.filter(h => h.name.toLowerCase().includes(hospitalSearch.toLowerCase()));

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1,
            },
        },
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0 },
    };

    return (
        <div className="w-full max-w-5xl mx-auto py-8 px-4">
            <Stepper currentStep={step} />

            <AnimatePresence mode="wait">
                
                {step === 1 && (
                    <motion.div
                        key="step1"
                        initial={{ opacity: 0, x: -50 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 50 }}
                        transition={{ duration: 0.3, ease: "easeInOut" }}
                    >
                        <h2 className="text-3xl font-bold text-center text-gray-900 mb-4">Step 1: Select Your Role</h2>
                        <p className="text-lg text-center text-gray-600 mb-8">Choose your primary role or action in the ecosystem.</p>
                        
                        <motion.div 
                            className="grid grid-cols-1 md:grid-cols-2 gap-6"
                            variants={containerVariants}
                            initial="hidden"
                            animate="visible"
                        >
                            {roles.map((role) => {
                                const Icon = role.icon;
                                return (
                                    <motion.button
                                        key={role.id}
                                        type="button"
                                        onClick={() => handleRoleSelect(role.id)}
                                        className={`flex flex-col items-center text-center p-6 bg-white rounded-2xl shadow-lg border-2 transition-all duration-200 hover:shadow-xl hover:-translate-y-1 ${
                                            selectedRole === role.id ? 'border-blue-600 ring-4 ring-blue-100' : 'border-gray-100 hover:border-gray-200'
                                        }`}
                                        variants={itemVariants}
                                    >
                                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-100 text-blue-600 mb-3">
                                            <Icon className="h-7 w-7" />
                                        </div>
                                        <h3 className="text-2xl font-semibold text-gray-900">{role.name}</h3>
                                        <p className="mt-2 text-base text-gray-600">{role.description}</p>
                                    </motion.button>
                                );
                            })}
                        </motion.div>
                    </motion.div>
                )}

                {step === 2 && (
                    <motion.div
                        key="step2"
                        initial={{ opacity: 0, x: 50 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -50 }}
                        transition={{ duration: 0.3, ease: "easeInOut" }}
                    >
                        <div className="flex items-center mb-6">
                            <button 
                                onClick={() => setStep(1)} 
                                className="flex items-center text-sm font-medium text-gray-600 hover:text-gray-900"
                            >
                                <ArrowLeft className="w-4 h-4 mr-2" />
                                Back to Role Selection
                            </button>
                        </div>

                        <h2 className="text-3xl font-bold text-center text-gray-900 mb-4">Step 2: Your Details</h2>
                        <p className="text-lg text-center text-gray-600 mb-8">Please provide the required information for your chosen role.</p>

                        {/* --- MERGE: TERNARY LOGIC --- */}
                        {selectedRole === 'register_hospital' ? (
                            // --- MERGE: HOSPITAL FORM MARKUP ---
                            <form onSubmit={handleHospitalSubmit} className="space-y-4 pt-4 max-w-lg mx-auto">
                                <motion.div
                                    className="relative"
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.5, delay: 0.1 }}
                                >
                                    <label htmlFor="hospitalName" className="block text-sm font-medium text-gray-700 mb-1">
                                        Hospital Name
                                    </label>
                                    <div className="relative">
                                        <Building className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
                                        <input
                                            id="hospitalName"
                                            type="text"
                                            value={hospitalName}
                                            onChange={(e) => setHospitalName(e.target.value)}
                                            placeholder="e.g., City General Hospital"
                                            className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
                                            required
                                            disabled={isLoading}
                                        />
                                    </div>
                                </motion.div>
                                
                                <p className="text-xs text-center text-gray-500 pt-2">
                                    Your current wallet address will be proposed as the Hospital Administrator.
                                </p>

                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.5, delay: 0.2 }}
                                >
                                    <button type="submit" disabled={isLoading} className={`w-full flex justify-center items-center px-4 py-3 font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400 transition-colors shadow-lg hover:shadow-xl`}>
                                        {isLoading ? (
                                            <Loader2 className="w-6 h-6 animate-spin" />
                                        ) : (
                                            'Confirm & Request Registration'
                                        )}
                                    </button>
                                </motion.div>
                            </form>
                        ) : (
                            // --- EXISTING USER/PROFESSIONAL FORM ---
                            <form onSubmit={handleSubmit} className="space-y-4 pt-4 max-w-lg mx-auto">
                                <motion.div 
                                    className="relative"
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.5, delay: 0.1 }}
                                >
                                    <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                                    <div className="relative">
                                        <User className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
                                        <input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)}
                                            className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
                                            placeholder="Enter your full name" required disabled={isLoading}/>
                                    </div>
                                </motion.div>

                                {isProfessionalRoleSelected && (
                                    <motion.div 
                                        className="relative" 
                                        ref={hospitalDropdownRef}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.5, delay: 0.2 }}
                                    >
                                        <label htmlFor="hospital" className="block text-sm font-medium text-gray-700 mb-1">Affiliated Hospital</label>
                                        <div className="relative">
                                            <Building className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2 z-10" />
                                            <input type="text" id="hospital" value={hospitalSearch}
                                                onChange={(e) => { setHospitalSearch(e.target.value); setSelectedHospital(''); setIsDropdownOpen(true); }}
                                                onFocus={() => setIsDropdownOpen(true)}
                                                placeholder="Search and select your hospital"
                                                className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white"
                                                disabled={isLoading} />
                                        </div>
                                        {isDropdownOpen && (
                                            <div className="absolute z-20 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                                                {filteredHospitals.length > 0 ? (
                                                    filteredHospitals.map((hospital) => (
                                                        <button key={hospital._id} type="button" className="w-full text-left px-4 py-2 hover:bg-blue-50"
                                                            onClick={() => { setHospitalSearch(hospital.name); setSelectedHospital(hospital.hospitalId); setIsDropdownOpen(false); }}>
                                                            {hospital.name}
                                                        </button>
                                                    ))
                                                ) : ( <p className="px-4 py-2 text-gray-500">No hospitals found.</p> )}
                                            </div>
                                        )}
                                    </motion.div>
                                )}

                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.5, delay: 0.3 }}
                                >
                                    <button type="submit" disabled={isLoading || selectedRole === null} className={`w-full flex justify-center items-center px-4 py-3 font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400 transition-colors shadow-lg hover:shadow-xl`}>
                                        {isLoading ? (
                                            <Loader2 className="w-6 h-6 animate-spin" />
                                        ) : (
                                            'Confirm & Register'
                                        )}
                                    </button>
                                </motion.div>
                            </form>
                        )}
                    </motion.div>
                )}

            </AnimatePresence>

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
        </div>
    );
}

