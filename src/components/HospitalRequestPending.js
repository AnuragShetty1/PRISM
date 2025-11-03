"use client";

import { useEffect, useState } from 'react';
import { useWeb3 } from '@/context/Web3Context';
import axios from 'axios';
import toast from 'react-hot-toast';

// --- ICONS ---
const ClockIcon = () => (
    <svg className="mx-auto h-16 w-16 text-teal-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);
const RejectedIcon = () => (
    <svg className="mx-auto h-16 w-16 text-red-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
    </svg>
);
const Spinner = () => <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-slate-400"></div>;
const ButtonSpinner = () => <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>;


export default function HospitalRequestPending() {
    const { userStatus, refetchUserProfile, account } = useWeb3();
    const [isResetting, setIsResetting] = useState(false);

    useEffect(() => {
        const intervalId = setInterval(() => {
            if (userStatus === 'pending_hospital') {
                refetchUserProfile();
            }
        }, 5000); 

        return () => clearInterval(intervalId);

    // --- MISTAKE ---
    // A typo was introduced in the dependency array. The function is named `refetchUserProfile`,
    // but it was misspelled as `refectchUserProfile`. This caused a ReferenceError,
    // crashing the component.
    // }, [userStatus, refectchUserProfile]);

    // --- FIX ---
    // The typo in the function name has been corrected to `refetchUserProfile`, matching
    // the name of the function provided by the Web3Context. This resolves the crash.
    }, [userStatus, refetchUserProfile]);

    const handleResetRequest = async () => {
        setIsResetting(true);
        const toastId = toast.loading("Resetting your registration status...");
        try {
            await axios.post('http://localhost:3001/api/users/reset-hospital-request', {
                address: account 
            });
            toast.success("You can now submit a new registration request.", { id: toastId });
            await refetchUserProfile();
        } catch (error) {
            console.error("Failed to reset hospital request:", error);
            toast.error(error.response?.data?.message || "Could not reset your request.", { id: toastId });
        } finally {
            setIsResetting(false);
        }
    };

    if (userStatus === 'rejected') {
        return (
            <div className="w-full max-w-lg mx-auto bg-white p-8 sm:p-12 rounded-2xl shadow-xl border border-red-200 text-center">
                <RejectedIcon />
                <h2 className="mt-6 text-2xl font-bold text-slate-900">Registration Request Rejected</h2>
                <p className="mt-3 text-md text-slate-600">
                    Unfortunately, your request to register a new hospital was not approved by the Super Admin at this time.
                </p>
                <button
                    onClick={handleResetRequest}
                    disabled={isResetting}
                    className="mt-8 w-full flex items-center justify-center bg-teal-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-teal-700 focus:outline-none transition-colors disabled:bg-slate-400"
                >
                    {isResetting ? <><ButtonSpinner /> Resetting...</> : 'Submit a New Request'}
                </button>
            </div>
        );
    }

    return (
        <div className="w-full max-w-lg mx-auto bg-white p-8 sm:p-12 rounded-2xl shadow-xl border border-slate-200 text-center">
            <ClockIcon />
            <h2 className="mt-6 text-2xl font-bold text-slate-900">Request Submitted for Review</h2>
            <p className="mt-3 text-md text-slate-600">
                Your request to register a new hospital is now pending approval from a Super Admin. 
                This page will automatically update once your request has been reviewed.
            </p>
            <div className="mt-8 flex justify-center items-center gap-3 text-sm text-slate-500">
                <Spinner />
                <span>Checking for updates...</span>
            </div>
        </div>
    );
}

