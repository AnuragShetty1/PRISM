"use client";

import { useState } from 'react';
import { useWeb3 } from '@/context/Web3Context';
import toast from 'react-hot-toast';

/**
 * InsuranceDashboard component for insurance providers to request access to patient records for claims processing.
 * Features a professional split-screen layout to separate informational content from the interactive form.
 */
export default function InsuranceDashboard() {
    // Web3 context for contract interaction
    const { contract } = useWeb3();

    // State for form inputs and loading status
    const [patientAddress, setPatientAddress] = useState('');
    const [claimId, setClaimId] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    /**
     * Handles the form submission to request access to a patient's records.
     * It performs validation, interacts with the smart contract, and provides user feedback via toasts.
     * @param {React.FormEvent<HTMLFormElement>} e - The form submission event.
     */
    const handleRequest = async (e) => {
        e.preventDefault();
        if (!patientAddress || !claimId || !contract) {
            toast.error("Please fill out all fields.");
            return;
        }

        setIsLoading(true);
        const toastId = toast.loading("Submitting access request transaction...");

        try {
            // Contract interaction
            const tx = await contract.requestAccess(patientAddress, claimId);
            await tx.wait(); // Wait for the transaction to be mined

            // Success feedback
            toast.success(`Successfully requested access for claim: ${claimId}`, { id: toastId });
            
            // Reset form fields
            setPatientAddress('');
            setClaimId('');
        } catch (error) {
            console.error("Request failed:", error);
            // Error feedback
            toast.error("Request failed. Please check the patient address and claim details.", { id: toastId });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
            {/* Left Side: Informational Content */}
            <div className="p-8">
                <div className="flex items-center justify-center md:justify-start mb-6">
                    <div className="bg-indigo-100 p-4 rounded-full">
                        <svg className="w-12 h-12 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75l3 3m0 0l3-3m-3 3v-7.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                </div>
                <h1 className="text-4xl lg:text-5xl font-bold text-slate-800 mb-4">
                    Insurance Claim Portal
                </h1>
                <p className="text-lg text-slate-600 mb-8">
                    Securely request temporary access to a patient's medical records to process an insurance claim. All requests are logged on the blockchain and require patient approval.
                </p>
                <ul className="space-y-4">
                    <li className="flex items-start">
                        <svg className="w-6 h-6 text-indigo-500 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        <div>
                            <h3 className="font-semibold text-slate-700">Patient Consent</h3>
                            <p className="text-slate-500 text-sm">The patient must approve your request before you can view any records.</p>
                        </div>
                    </li>
                    <li className="flex items-start">
                        <svg className="w-6 h-6 text-indigo-500 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        <div>
                            <h3 className="font-semibold text-slate-700">Time-Limited Access</h3>
                            <p className="text-slate-500 text-sm">Access is granted for a specific duration set by the patient, ensuring data privacy.</p>
                        </div>
                    </li>
                </ul>
            </div>

            {/* Right Side: Interactive Form */}
            <div>
                <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-2xl shadow-xl border border-slate-200">
                    <h2 className="text-2xl font-bold text-center text-slate-900">New Access Request</h2>
                    <form onSubmit={handleRequest} className="space-y-6">
                        <div>
                            <label htmlFor="patientAddress" className="block text-sm font-medium text-slate-700 mb-1">
                                Patient's Wallet Address
                            </label>
                            <div className="relative">
                                <svg className="w-6 h-6 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5zm-2.25-2.25v-1.5a2.25 2.25 0 012.25-2.25h15a2.25 2.25 0 012.25 2.25v1.5m-19.5-6.375a2.25 2.25 0 012.25-2.25h15a2.25 2.25 0 012.25 2.25v1.5" />
                                </svg>
                                <input
                                    id="patientAddress"
                                    type="text"
                                    value={patientAddress}
                                    onChange={(e) => setPatientAddress(e.target.value)}
                                    placeholder="0x..."
                                    className="w-full pl-11 pr-4 py-3 border border-slate-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 transition"
                                    required
                                />
                            </div>
                        </div>
                        <div>
                            <label htmlFor="claimId" className="block text-sm font-medium text-slate-700 mb-1">
                                Claim ID
                            </label>
                            <div className="relative">
                                <svg className="w-6 h-6 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-12h5.25M9 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 010-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375z" />
                                </svg>
                                <input
                                    id="claimId"
                                    type="text"
                                    value={claimId}
                                    onChange={(e) => setClaimId(e.target.value)}
                                    placeholder="e.g., claim-12345"
                                    className="w-full pl-11 pr-4 py-3 border border-slate-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 transition"
                                    required
                                />
                            </div>
                        </div>
                        <button type="submit" disabled={isLoading} className="w-full px-4 py-3 font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:bg-slate-400 transition-colors shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                            {isLoading ? 'Processing...' : 'Request Access'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
