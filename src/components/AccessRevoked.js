"use client";

import { useWeb3 } from '@/context/Web3Context';

const ExclamationTriangleIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
);

export default function AccessRevoked() {
    const { disconnect } = useWeb3();

    return (
        <div className="flex items-center justify-center min-h-[calc(100vh-128px)] bg-slate-50 px-4">
            <div className="w-full max-w-md text-center bg-white p-8 rounded-xl shadow-lg border border-red-200">
                <div className="mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-red-100 mb-6">
                    <ExclamationTriangleIcon />
                </div>
                <h1 className="text-2xl font-bold text-slate-800 mb-2">Access Revoked</h1>
                <p className="text-slate-600 mb-8">
                    Your access to the platform has been revoked by an administrator. If you believe this is an error, please contact your institution's administration.
                </p>
                <button
                    onClick={disconnect}
                    className="w-full px-4 py-3 font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-all shadow-sm"
                >
                    Disconnect Wallet
                </button>
            </div>
        </div>
    );
}
