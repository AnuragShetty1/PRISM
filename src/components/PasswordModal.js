"use client";

import React, { useState } from 'react';
import { ShieldAlert, Unlock,AlertCircle } from 'lucide-react';

/**
 * [NEW] PasswordModal Component
 * This is a blocking modal that appears when a user logs in from a new device
 * and needs to decrypt their private key using their master password.
 */
const PasswordModal = ({ onSubmit, error, isLoading }) => {
    const [password, setPassword] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!password || isLoading) return;
        onSubmit(password);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-md p-8 m-4">
                <form onSubmit={handleSubmit}>
                    <div className="flex flex-col items-center text-center">
                        <ShieldAlert className="h-16 w-16 text-yellow-400 mx-auto mb-4" />
                        <h2 className="text-3xl font-bold text-white mb-2">Unlock Your Account</h2>
                        <p className="text-gray-300 mb-6">
                            Please enter your master password to decrypt your session key. This is required to access your account on a new device.
                        </p>
                    </div>

                    <div className="space-y-4 mb-6">
                        <input
                            type="password"
                            placeholder="Enter Master Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-4 py-3 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
                            autoFocus
                        />
                    </div>

                    {error && (
                        <div className="bg-red-900/50 border border-red-700 text-red-300 px-4 py-3 rounded-lg mb-6 text-sm flex items-center">
                            <AlertCircle className="h-5 w-5 mr-3 flex-shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isLoading || !password}
                        className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg shadow-lg transition-transform transform hover:scale-105 disabled:bg-slate-500 disabled:cursor-wait flex items-center justify-center"
                    >
                        <Unlock className="h-5 w-5 mr-2" />
                        {isLoading ? 'Decrypting...' : 'Unlock Account'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default PasswordModal;