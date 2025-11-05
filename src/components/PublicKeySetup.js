"use client";

import React, { useState } from 'react'; // Import useState
import { useWeb3 } from '@/context/Web3Context';
import { ShieldCheck, AlertCircle } from 'lucide-react'; // Import AlertCircle for errors
import toast from 'react-hot-toast';
import { encryptWithPassword } from '@/utils/crypto'; // Import the new crypto function

const PublicKeySetup = () => {
    const { api, userProfile, generateAndSetKeyPair, keyPair, setIsConfirmingKey } = useWeb3();
    const [isLoading, setIsLoading] = useState(false);

    // [NEW] State for password fields and error messages
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState(null);

    const handleSaveKey = async () => {
        // [NEW] Clear previous errors and run validation first
        setError(null);
        if (!password || !confirmPassword) {
            setError("Please create and confirm your master password.");
            return;
        }
        if (password.length < 8) {
            setError("Password must be at least 8 characters long.");
            return;
        }
        if (password !== confirmPassword) {
            setError("Passwords do not match. Please try again.");
            return;
        }

        setIsLoading(true);
        setIsConfirmingKey(true);
        const toastId = toast.loading("Securing account...");

        try {
            let keysToSave = keyPair;

            if (!keysToSave || !keysToSave.publicKey || !keysToSave.signature) {
                toast.loading("Generating encryption keys... Please sign the message in your wallet.", { id: toastId });
                keysToSave = await generateAndSetKeyPair();

                if (!keysToSave || !keysToSave.publicKey || !keysToSave.signature) {
                    throw new Error("Key generation failed or was cancelled.");
                }
            }

            // --- [NEW] Encrypt and save the private key to the backend ---
            toast.loading("Encrypting your private key...", { id: toastId });

            // 1. Export the private key (CryptoKey) to a string (JWK)
            const privateKeyJwk = await window.crypto.subtle.exportKey('jwk', keysToSave.privateKey);
            const privateKeyString = JSON.stringify(privateKeyJwk);

            // 2. Encrypt the string using the user's password
            const encryptedKey = await encryptWithPassword(privateKeyString, password);

            // 3. Save the encrypted string to the backend
            toast.loading("Saving encrypted key to backend...", { id: toastId });

            // We need the JWT token to authenticate this request
            const token = localStorage.getItem('jwtToken');
            if (!token) {
                throw new Error("Authentication error: No session token found. Please log in again.");
            }

            const response = await fetch(`/api/users/${userProfile.walletAddress}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ encryptedPrivateKey: encryptedKey }),
            });

            if (!response.ok) {
                // [FIX] Robust error handling
                let errorMessage = "Failed to save encrypted key to backend.";
                try {
                    // Try to parse the error response as JSON
                    const errData = await response.json();
                    if (errData && errData.message) {
                        errorMessage = errData.message;
                    } else {
                        // The JSON was valid but didn't have a 'message'
                        errorMessage = `Server error: ${response.status} ${response.statusText}`;
                    }
                } catch (jsonError) {
                    // The error response was not JSON. Use the status text.
                    console.warn("Server error response was not JSON:", jsonError);
                    errorMessage = `Server error: ${response.status} ${response.statusText}`;
                }
                throw new Error(errorMessage);
            }
            // --- End of new logic ---

            // [MODIFIED] This now runs *after* the backend save is successful.
            toast.loading("Saving your public key to the blockchain... This may take a moment.", { id: toastId });
            await api.savePublicKey(keysToSave.publicKey, keysToSave.signature);

            toast.success("Security setup complete! Your dashboard is loading...", { id: toastId });

        } catch (error) {
            const errorMessage = error.message || "Failed to complete security setup.";
            setError(errorMessage); // [NEW] Show error in the component
            toast.error(errorMessage, { id: toastId });
            console.error("Setup failed:", error);
            setIsConfirmingKey(false);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
            <div className="bg-white/10 backdrop-blur-lg p-8 rounded-2xl shadow-lg border border-gray-700 max-w-lg mx-auto">
                <ShieldCheck className="h-16 w-16 text-green-400 mx-auto mb-4" />
                <h2 className="text-3xl font-bold text-white mb-2">One-Time Security Setup</h2>
                <p className="text-gray-300 mb-6">
                    Welcome, {userProfile?.name}! To secure your account and enable portability, please create a master password.
                </p>
                <p className="text-gray-400 text-sm mb-6 -mt-4">
                    This password will be used to encrypt your private key, allowing you to access your account from any device. <strong className="text-yellow-400">We do not store this password. If you forget it, you will lose access to your account.</strong>
                </p>

                {/* [NEW] Password Inputs */}
                <div className="space-y-4 mb-6">
                    <input
                        type="password"
                        placeholder="Create Master Password (min 8 characters)"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full px-4 py-3 rounded-lg bg-gray-900 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                    <input
                        type="password"
                        placeholder="Confirm Master Password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full px-4 py-3 rounded-lg bg-gray-900 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                </div>

                {/* [NEW] Error Message Display */}
                {error && (
                    <div className="bg-red-900/50 border border-red-700 text-red-300 px-4 py-3 rounded-lg mb-6 flex items-center">
                        <AlertCircle className="h-5 w-5 mr-3" />
                        <span>{error}</span>
                    </div>
                )}

                <button
                    onClick={handleSaveKey}
                    disabled={isLoading}
                    className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg shadow-lg transition-transform transform hover:scale-105 disabled:bg-slate-500 disabled:cursor-wait">

                    {isLoading ? 'Processing...' : 'Secure My Account & Save Key'}
                </button>
                <p className="text-xs text-gray-500 mt-4">
                    This also includes a sponsored blockchain transaction. You do not need to pay any gas fees.
                </p>
            </div>
        </div>
    );
};

export default PublicKeySetup;