"use client";

import { useEffect, useState } from "react";
import { useWeb3 } from "@/context/Web3Context";
import toast from 'react-hot-toast';

// --- NEW ICONS (from HospitalRequestPending) ---
const ClockIcon = () => (
    <svg className="mx-auto h-16 w-16 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);
const RejectedIcon = () => (
    <svg className="mx-auto h-16 w-16 text-red-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
    </svg>
);
const ButtonSpinner = () => <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>;
const Spinner = () => <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-slate-400"></div>;
// --- END ICONS ---


export default function PendingVerification() {
    // --- MODIFICATION: Destructure 'api' and get 'userStatus' directly ---
    const { userProfile, userStatus, refetchUserProfile, api } = useWeb3();
    const [isResetting, setIsResetting] = useState(false);

    useEffect(() => {
        const interval = setInterval(() => {
            // --- MODIFICATION: Check for *all* pending statuses ---
            if (userStatus === 'pending' || userStatus === 'pending_hospital') {
                refetchUserProfile();
            }
        }, 5000); 

        return () => clearInterval(interval);
    }, [userStatus, refetchUserProfile]);

    // --- MODIFIED FUNCTION ---
    // This function is now "smarter" and calls the correct API based on the user's role.
    const handleResetRequest = async () => {
        setIsResetting(true);
        const toastId = toast.loading("Resetting your registration status...");
        try {
            
            // --- THIS IS THE FIX ---
            // Check if userProfile and userProfile.role exist.
            // Professionals (Doctor, etc.) will have a role. Hospital Admins will not (profile is null).
            if (userProfile && userProfile.role) {
                // This is a Professional. Call the new function to delete their on-chain data.
                await api.resetProfessionalRegistration();
            } else {
                // This is a Hospital Admin. Call the original function to delete the off-chain request.
                await api.resetRegistration();
            }
            // --- END OF FIX ---
            
            // The context will automatically set userStatus to 'unregistered'
            // which will cause page.js to show the RegistrationForm
            toast.success("You can now submit a new registration request.", { id: toastId });
        } catch (error) {
            console.error("Failed to reset registration:", error);
            toast.error(error.message || "Could not reset your request.", { id: toastId });
        } finally {
            setIsResetting(false);
        }
    };
    // --- END MODIFIED FUNCTION ---

    // --- NEW REJECTED STATE ---
    if (userStatus === 'rejected') {
        return (
            <div className="w-full max-w-lg mx-auto bg-white p-8 sm:p-12 rounded-2xl shadow-xl border border-red-200 text-center">
                <RejectedIcon />
                <h2 className="mt-6 text-2xl font-bold text-slate-900">Registration Request Rejected</h2>
                <p className="mt-3 text-md text-slate-600">
                    Unfortunately, your registration request was not approved at this time.
                </p>
                <button
                    onClick={handleResetRequest}
                    disabled={isResetting}
                    className="mt-8 w-full flex items-center justify-center bg-blue-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-700 focus:outline-none transition-colors disabled:bg-slate-400"
                >
                    {isResetting ? <ButtonSpinner /> : null}
                    {isResetting ? 'Resetting...' : 'Submit a New Request'}
                </button>
            </div>
        );
    }
    // --- END REJECTED STATE ---

    // --- DYNAMIC PENDING STATE ---
    // Determine the correct role name to display
    let roleName = "User"; // Default
    if (userProfile?.role) {
        roleName = userProfile.role;
    } else if (userStatus === 'pending_hospital') {
        roleName = "Hospital Administrator";
    }

    // Determine the correct message based on status
    const message = userStatus === 'pending_hospital'
        ? "Your request to register a new hospital is now pending approval from a Super Admin."
        : `Your account requires verification from your hospital's administrator. This is a security measure to ensure the integrity of our network.`;

    return (
        <div className="flex items-center justify-center min-h-[calc(100vh-128px)] w-full bg-slate-50 p-4">
            <div className="w-full max-w-2xl p-8 text-center bg-white rounded-2xl shadow-xl border border-slate-200">
                <div className="flex items-center justify-center mb-6">
                    <div className="bg-blue-100 p-4 rounded-full">
                        <ClockIcon />
                    </div>
                </div>
                <h1 className="text-3xl lg:text-4xl font-bold text-slate-800 mb-4">
                    Verification Pending
                </h1>
                <p className="text-lg text-slate-600 mb-2">
                    Thank you for registering as a <span className="font-semibold text-slate-700">{roleName}</span>.
                </p>
                <p className="text-slate-500 max-w-md mx-auto">
                    {message}
                </p>
                <div className="mt-8 bg-slate-50 p-4 rounded-lg border border-slate-200 flex items-center justify-center gap-3">
                    <Spinner />
                    <p className="text-sm text-slate-700 font-medium">
                        No further action is needed. This page will update automatically.
                    </p>
                </div>
            </div>
        </div>
    );
}

