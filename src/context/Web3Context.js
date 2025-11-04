"use client";

import React, { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { ethers } from 'ethers';
import toast from 'react-hot-toast';
import { Web3Auth } from "@web3auth/modal";
import { CHAIN_NAMESPACES, ADAPTER_EVENTS } from "@web3auth/base";
import { generateAndStoreKeyPair, loadKeyPair } from '@/utils/crypto';

import contractAddressData from '@/contracts/contract-address.json';
import medicalRecordsArtifact from '@/contracts/MedicalRecords.json';

const Web3Context = createContext();

// --- CONFIGURATION ---
const hardhatChainConfig = {
    chainId: "0x7a69", // 31337 in hex
    displayName: "Hardhat Local Network",
    rpcTarget: "http://127.0.0.1:8545",
    blockExplorer: "http://localhost:3000",
    ticker: "ETH",
    tickerName: "Ethereum",
};
const TARGET_CHAIN_ID = hardhatChainConfig.chainId;

const initChainConfig = {
    chainNamespace: CHAIN_NAMESPACES.EIP155,
    chainId: "0x13881", // Polygon Mumbai
    rpcTarget: "https://rpc.ankr.com/polygon_mumbai",
    displayName: "Polygon Mumbai Testnet",
    blockExplorer: "https://mumbai.polygonscan.com/",
    ticker: "MATIC",
    tickerName: "Matic",
};

const web3auth = new Web3Auth({
    clientId: process.env.NEXT_PUBLIC_WEB3AUTH_CLIENT_ID,
    web3AuthNetwork: "sapphire_devnet",
    chainConfig: initChainConfig,
});

// [NEW] Define the base URL for your trusted backend
const API_BASE_URL = 'http://localhost:3001';

export const Web3Provider = ({ children }) => {
    // Core Web3 State
    const [theme, setTheme] = useState('default');
    const [account, setAccount] = useState(null);
    const [contract, setContract] = useState(null);
    const [signer, setSigner] = useState(null);
    const [provider, setProvider] = useState(null);
    const [owner, setOwner] = useState(null);
    // User & Session State
    const [userProfile, setUserProfile] = useState(null);
    const [userStatus, setUserStatus] = useState('unregistered'); 
    const [isRegistered, setIsRegistered] = useState(false);
    const [isLoadingProfile, setIsLoadingProfile] = useState(true);
    const [keyPair, setKeyPair] = useState(null);
    const [needsPublicKeySetup, setNeedsPublicKeySetup] = useState(false);
    // [NEW] State to hold the user's JWT for API authentication
    const [idToken, setIdToken] = useState(null);
    
    // [NEW] Add a new state to manage the post-key-submission loading screen
    const [isConfirmingKey, setIsConfirmingKey] = useState(false);

    // App Data State
    // --- [FIX] RESTORING the state variables I wrongly removed ---
    const [records, setRecords] = useState([]);
    const [requests, setRequests] = useState([]);
    const [accessList, setAccessList] = useState([]);
    const [notifications, setNotifications] = useState([]);

    // --- [NEW] State to trigger UI refresh when new requests arrive ---
    const [requestUpdateCount, setRequestUpdateCount] = useState(0);

    // --- SESSION MANAGEMENT ---
    const clearUserSession = () => {
        setAccount(null);
        setContract(null);
        setOwner(null);
        setUserProfile(null);
        setIsRegistered(false);
        setUserStatus('unregistered');
        // --- [FIX] RESTORING state clearing on logout ---
        setRecords([]);
        setRequests([]);
        setAccessList([]);
        setSigner(null);
        setProvider(null);
        setKeyPair(null);
        setNeedsPublicKeySetup(false);
        setIdToken(null); // [NEW] Clear the idToken on logout
        setIsConfirmingKey(false); // [NEW] Clear this on logout
    };

    const disconnectWallet = async () => {
        if (!web3auth) return;
        try {
            await web3auth.logout();
            toast.success("You've been logged out.");
        } catch (error) {
            console.error("Error during logout:", error);
            toast.error("Logout failed.");
        }
    };
    
    // --- NETWORK SWITCHING (UNCHANGED) ---
    const checkAndSwitchNetwork = async (currentProvider) => {
        if (!currentProvider) return false;
        try {
            const web3Provider = new ethers.BrowserProvider(currentProvider);
            const network = await web3Provider.getNetwork();
            const currentChainId = `0x${network.chainId.toString(16)}`;

            if (currentChainId === TARGET_CHAIN_ID) return true;
            
            try {
                await currentProvider.request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId: TARGET_CHAIN_ID }],
                });
                return true;
            } catch (switchError) {
                if (switchError.code === 4902) {
                    try {
                        await currentProvider.request({
                            method: 'wallet_addEthereumChain',
                            params: [hardhatChainConfig],
                        });
                        return true;
                    } catch (addError) {
                        toast.error("Failed to add Hardhat network to wallet.");
                        console.error("Failed to add network:", addError);
                        return false;
                    }
                } else {
                    toast.error("Failed to switch network. Please do it manually in your wallet.");
                    console.error("Failed to switch network:", switchError);
                    return false;
                }
            }
        } catch (error) {
            console.error("Error checking/switching network:", error);
            return false;
        }
    };

    // --- DATA FETCHING (STABILIZED WITH useCallback) ---
    const fetchPendingRequests = useCallback(async (patientAddress, contractInstance) => {
        if (!contractInstance || !patientAddress) return;
        try {
            const count = await contractInstance.getPatientRequestsCount(patientAddress);
            const pendingReqs = [];
            for (let i = 0; i < count; i++) {
                const req = await contractInstance.getPatientRequestAtIndex(patientAddress, i);
                if (Number(req.status) === 0) {
                    pendingReqs.push(req);
                }
            }
            // --- [FIX] RESTORING state update ---
            setRequests(pendingReqs);
        } catch (error) {
            console.error("Could not fetch access requests:", error);
        }
    }, []);

    const fetchPatientData = useCallback(async (patientAddress, contractInstance) => {
        if (!contractInstance || !patientAddress) return;
        try {
            const recordIds = await contractInstance.getPatientRecordIds(patientAddress);
            const recordsPromises = recordIds.map(id => contractInstance.getRecordById(id));
            const fetchedRecords = await Promise.all(recordsPromises);
            // --- [FIX] RESTORING state update ---
            setRecords(fetchedRecords);
            await fetchPendingRequests(patientAddress, contractInstance);
        } catch (error) {
            console.error("Could not fetch patient data:", error);
        }
    }, [fetchPendingRequests]);

    // --- [REFACTORED] SESSION SETUP & STATE CHECKING (UNCHANGED) ---
    // This function already uses fetch, which is fine. We just formalize the base URL.
    const checkUserRegistrationAndState = useCallback(async (userAddress, contractInstance, signerInstance) => {
        setIsLoadingProfile(true);
        try {
            // Using the new API_BASE_URL constant
            const response = await fetch(`${API_BASE_URL}/api/users/status/${userAddress}`);
            if (!response.ok) {
                throw new Error('Failed to fetch user status from the server.');
            }
            const data = await response.json();
            
            setUserStatus(data.status);

            if (data.status === 'revoked') {
                setIsRegistered(false);
                setUserProfile(null); // Clear profile for a revoked user
            } else if (data.status !== 'unregistered') {
                setIsRegistered(true);
                const fullProfile = {
                    walletAddress: userAddress.toLowerCase(),
                    role: data.role,
                    isVerified: data.isVerified,
                    hospitalId: data.hospitalId,
                    publicKey: data.publicKey || "", 
                    name: data.name || "",
                };
                // [FIX] We set the profile *first* so the role is available
                setUserProfile(fullProfile); 

                const rolesThatNeedKeys = ['Patient', 'Doctor', 'LabTechnician'];
                const userIsApproved = data.status === 'approved';
                const userNeedsKey = rolesThatNeedKeys.includes(fullProfile.role);

                if (userIsApproved && userNeedsKey) {
                    
                    // --- [THIS IS THE FIX] ---
                    // Check the blockchain *directly* to avoid the race condition.
                    // The database (via `data.publicKey`) might be stale, but the contract is always true.
                    const userOnChain = await contractInstance.users(userAddress);
                    const onChainPublicKey = userOnChain.publicKey;

                    // Now, check if the key is missing *on-chain*
                    const keyIsMissingOnChain = !onChainPublicKey || onChainPublicKey.length === 0;
                    
                    if (keyIsMissingOnChain) {
                        // Key is truly missing. Show the setup page.
                        const loadedKeyPair = await loadKeyPair(signerInstance); // This is needed to generate
                        setKeyPair(loadedKeyPair);
                        setNeedsPublicKeySetup(true);
                    } else {
                        // Key exists on-chain, but the database is just stale.
                        // Do NOT show the setup page.
                        setNeedsPublicKeySetup(false);
                        
                        // Optimistically update the local profile state with the correct key
                        // This fixes the flicker.
                        if (fullProfile.publicKey !== onChainPublicKey) {
                            setUserProfile(prev => ({ ...prev, publicKey: onChainPublicKey }));
                        }
                        
                        // We can still load the key pair from local storage
                        const loadedKeyPair = await loadKeyPair(signerInstance);
                        setKeyPair(loadedKeyPair);

                        // Fetch patient data as normal
                        if (fullProfile.role === "Patient") {
                            await fetchPatientData(userAddress, contractInstance);
                        }
                    }
                    // --- [END OF FIX] ---

                } else {
                    setKeyPair(null);
                    setNeedsPublicKeySetup(false);
                }

            } else {
                setIsRegistered(false);
                setUserProfile(null);
                setNeedsPublicKeySetup(false);
                setKeyPair(null);
            }
        } catch (error) {
            console.error("!!! CRITICAL ERROR in checkUserRegistrationAndState !!!", error);
            toast.error("Could not verify user status. Please reconnect.");
            await disconnectWallet();
        } finally {
            setIsLoadingProfile(false);
        }
    }, [fetchPatientData]); // [FIX] Removed contractInstance and signerInstance, they are not dependencies

    const refetchUserProfile = useCallback(async () => {
        if (account && contract && signer) {
            console.log("refetchUserProfile triggered");
            await checkUserRegistrationAndState(account, contract, signer);
        } else {
            console.warn("refetchUserProfile called, but context is not ready.");
        }
    }, [account, contract, signer, checkUserRegistrationAndState]);

    const setupUserSession = useCallback(async (signerInstance, userAddress) => {
        try {
            const address = contractAddressData.MedicalRecords;
            const abi = medicalRecordsArtifact.abi;
            const contractInstance = new ethers.Contract(address, abi, signerInstance);
    
            await contractInstance.owner();
    
            setAccount(userAddress); // [FIX] This is where 'account' is set
            setSigner(signerInstance);
            setContract(contractInstance);
            setOwner(await contractInstance.owner());
            
            // [FIX] Pass contractInstance and signerInstance to the check function
            await checkUserRegistrationAndState(userAddress, contractInstance, signerInstance);
            
            toast.success("Connected successfully!");
        } catch (error) {
            console.error("Error setting up user session:", error);
            toast.error(`Contract not found on Hardhat network. Please deploy it and check the address.`);
            await disconnectWallet();
        }
    }, [checkUserRegistrationAndState]);

    // This function for generating keys locally is still needed (UNCHANGED)
    const generateAndSetKeyPair = async () => {
        if (!signer) {
            toast.error("Signer not available. Cannot generate keys."); return;
        }
        try {
            // [MODIFIED] Pass signer to generateAndStoreKeyPair
            const newKeyPair = await generateAndStoreKeyPair(signer);
            setKeyPair(newKeyPair);
            return newKeyPair;
        } catch (error) {
            console.error("Error generating key pair:", error);
            toast.error("Failed to generate security keys.");
        }
    };

    // [REMOVED] The old `savePublicKeyOnChain` function is gone.
    // It will be replaced by `api.savePublicKey` which components will call.

    // --- [NEW] API SERVICE ---
    
    /**
     * @brief A generic helper function for making authenticated API calls to the backend.
     * It automatically includes the user's JWT (idToken) for authentication.
     */
    const apiFetch = async (endpoint, method = 'POST', body = null) => {
        // [FIX] This is the key change for local testing.
        // We will *only* check for an idToken if the app is *not* in a local dev
        // environment, or we can just send the request without it.
        // For your setup, we will just warn and send the request anyway.
        // Your *backend* (with 'authenticate' commented out) will now allow it.
        if (!idToken) {
            console.warn(`Making API call without idToken. This is expected for MetaMask testing, but will fail if backend auth is enabled.`);
            // toast.error("You are not authenticated. Please reconnect."); // [REMOVED]
            // throw new Error("User not authenticated"); // [REMOVED]
        }

        const headers = {
            'Content-Type': 'application/json',
        };

        // [FIX] Only add the Authorization header if we actually have a token
        if (idToken) {
            headers['Authorization'] = `Bearer ${idToken}`;
        }

        const config = {
            method,
            headers,
        };

        if (body) {
            config.body = JSON.stringify(body);
        }

        const response = await fetch(`${API_BASE_URL}${endpoint}`, config);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: "An unknown API error occurred" }));
            console.error("API Error Response:", errorData);
            throw new Error(errorData.message || "API request failed");
        }
        
        // Handle responses that might not have a JSON body (e.g., 204 No Content)
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
            return response.json();
        } else {
            return response.text(); // Or return null, or response.status
        }
    };

    /**
     * @brief The new API service object that will be exposed via context.
     * It contains all functions that send sponsored (write) transactions to the backend.
     */
    const api = {
        // --- User Registration & Profile ---
        registerUser: (name, role, hospitalId) => {
            // [FIX] Add userAddress: account to the body
            return apiFetch('/api/users/sponsored/register-user', 'POST', { name, role, hospitalId, userAddress: account });
        },
        requestRegistration: async (hospitalName) => {
            // [FIX] Add userAddress: account to the body
            const response = await apiFetch('/api/users/sponsored/request-registration', 'POST', { hospitalName, userAddress: account });
            
            // --- THIS IS THE FIX ---
            // After the API call succeeds, we KNOW the user's status
            // is 'pending_hospital'. We set it directly to bypass
            // the database race condition.
            setUserStatus('pending_hospital');
            // --- END OF FIX ---

            return response; // Return the response as normal
        },
        savePublicKey: (publicKey, signature) => {
            // [FIX] Add userAddress: account to the body
            return apiFetch('/api/users/sponsored/save-public-key', 'POST', { publicKey, signature, userAddress: account });
        },
        updateUserProfile: (name) => {
            // [FIX] Add userAddress: account to the body
            return apiFetch('/api/users/sponsored/update-profile', 'POST', { name, userAddress: account });
        },

        // --- MODIFIED FUNCTION FOR REJECTED HOSPITAL ---
        resetRegistration: async () => {
            // This function ONLY resets hospital requests (off-chain)
            const response = await apiFetch('/api/users/sponsored/reset-registration', 'POST', { userAddress: account });
            setUserStatus('unregistered');
            return response;
        },

        // --- NEW FUNCTION FOR REJECTED PROFESSIONALS ---
        resetProfessionalRegistration: async () => {
            // This new function must call a backend endpoint that DELETES THE ON-CHAIN USER
            // and also deletes the off-chain registration request.
            const response = await apiFetch('/api/users/sponsored/reset-professional-registration', 'POST', { userAddress: account });
            setUserStatus('unregistered'); // Optimistically set status
            return response;
        },
        // --- END OF NEW FUNCTION ---

        // --- Record Management ---
        addSelfUploadedRecord: (recordData) => {
            // [FIX] Add userAddress: account to the body
            return apiFetch('/api/users/sponsored/add-self-record', 'POST', { ...recordData, userAddress: account });
        },
        addVerifiedRecord: (recordData) => {
            // [FIXm] Add userAddress: account to the body
            return apiFetch('/api/users/sponsored/add-verified-record', 'POST', { ...recordData, userAddress: account });
        },

        addSelfUploadedRecordsBatch: ({ records }) => {
            return apiFetch('/api/users/sponsored/add-self-records-batch', 'POST', { 
                records, // Pass the 'records' array
                userAddress: account 
            });
        },
        
        // --- [THIS IS THE FIX] ---
        // This function now accepts the object { patient, records }
        // from VerifiedUploadForm.js and sends it to the backend.
        addVerifiedRecordsBatch: (batchData) => {
            // batchData is { patient: "...", records: [...] }
            return apiFetch('/api/users/sponsored/add-verified-records-batch', 'POST', { 
                ...batchData, // This passes 'patient' and 'records' to the body
                userAddress: account 
            });
        },

        // --- Access Control (Patient) ---
        grantRecordAccess: (professionalAddress, recordId, duration, encryptedDek) => {
            return apiFetch('/api/users/sponsored/grant-access', 'POST', { professionalAddress, recordId, duration, encryptedDek, userAddress: account });
        },
        grantMultipleRecordAccess: (professionalAddress, recordIds, duration, encryptedDeks) => {
            return apiFetch('/api/users/sponsored/grant-multiple-access', 'POST', { professionalAddress, recordIds, duration, encryptedDeks, userAddress: account });
        },
        revokeRecordAccess: (professionalAddress, recordIds) => {
            // [FIX] Add userAddress: account to the body
            return apiFetch('/api/users/sponsored/revoke-access', 'POST', { professionalAddress, recordIds, userAddress: account });
        },
        revokeMultipleRecordAccess: (professionals, recordIds) => {
            // [FIX] Add userAddress: account to the body
            return apiFetch('/api/users/sponsored/revoke-multiple-access', 'POST', { professionals, recordIds, userAddress: account });
        },
        approveRequest: (requestId) => {
             // [FIX] Add userAddress: account to the body (for insurance)
            return apiFetch('/api/users/sponsored/approve-request-insurance', 'POST', { requestId, durationInDays: 30, userAddress: account }); // Default duration
        },
        
        // --- Access Control (Professional) ---
        requestRecordAccess: (patientAddress, recordIds, justification) => {
            // [FIX] Add userAddress: account to the body
            return apiFetch('/api/users/sponsored/request-access', 'POST', { patientAddress, recordIds, justification, userAddress: account });
        },

        // --- Super Admin ---
        // [FIXD] These do NOT need userAddress, they are auth'd by signature (Model 2)
        grantSponsorRole: (address, signature) => {
            return apiFetch('/api/super-admin/grant-sponsor', 'POST', { address, signature });
        },
        revokeSponsorRole: (address, signature) => {
            return apiFetch('/api/super-admin/revoke-sponsor', 'POST', { address, signature });
        },
    };

    // --- END NEW API SERVICE ---

    
    const addNotification = (message) => {
        setNotifications(prev => [{ id: Date.now() + Math.random(), message, timestamp: new Date(), read: false }, ...prev]);
    };

    const markNotificationsAsRead = () => {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    };
    
    // --- WEB3AUTH INITIALIZATION & EVENT HANDLING ---
    useEffect(() => {
        const initWeb3Auth = async () => {
            try {
                web3auth.on(ADAPTER_EVENTS.CONNECTED, async (data) => {
                    setIsLoadingProfile(true);
                    const web3authProvider = web3auth.provider;
                    if (!web3authProvider) {
                        setIsLoadingProfile(false); 
                        return;
                    }
                    
                    setProvider(web3authProvider);
                    let isNetworkCorrect = true;
                    if (web3auth.connectedAdapterName !== "openlogin") {
                        isNetworkCorrect = await checkAndSwitchNetwork(web3authProvider);
                    }

                    if (isNetworkCorrect) {
                        // [FIX] We *try* to get an idToken, but we no longer fail if it's missing.
                        try {
                            const userInfo = await web3auth.getUserInfo();
                            if (userInfo && userInfo.idToken) {
                                setIdToken(userInfo.idToken); // Set the state if it exists
                                console.log("idToken successfully retrieved.");
                            } else {
                                // This is now a warning, not an error.
                                console.warn("No idToken found. API calls for sponsored transactions will fail. This is expected for MetaMask / external wallet logins.");
                                setIdToken(null); // Ensure it's null
                            }
                        } catch (authError) {
                            console.warn("Could not get user info or idToken:", authError);
                            setIdToken(null);
                        }

                        // [FIX] We proceed to set up the session REGARDLESS of whether we got a token.
                        // This allows MetaMask (which has no token) to work for read operations.
                        const finalProvider = new ethers.BrowserProvider(web3authProvider);
                        const signerInstance = await finalProvider.getSigner();
                        const userAddress = await signerInstance.getAddress();
                        await setupUserSession(signerInstance, userAddress);

                    } else {
                        toast.error("Please connect to the Hardhat network to use the app.");
                        await disconnectWallet();
                    }
                    setIsLoadingProfile(false);
                });
                web3auth.on(ADAPTER_EVENTS.DISCONNECTED, () => {
                    clearUserSession();
                });
                await web3auth.init();
            } catch (error) {
                console.error("Error initializing Web3Auth:", error);
            } finally {
                setIsLoadingProfile(false);
            }
        };
        initWeb3Auth();
    }, [setupUserSession]); // setupUserSession is already memoized
    
    const connectWallet = async () => {
        if (!web3auth) {
            toast.error("Authentication service not ready."); return;
        }
        setIsLoadingProfile(true);
        try {
            await web3auth.connect();
        } catch (error) {
            if (!error.message.includes("User closed the modal")) {
                toast.error("Connection failed. Please try again.");
            }
        } finally {
            setIsLoadingProfile(false);
        }
    };
    
    // --- EVENT LISTENERS ---
    useEffect(() => {
        if (contract && account) {
            const handleRecordAdded = async (recordId, patientAddress, category) => {
                if (patientAddress.toLowerCase() === account.toLowerCase()) {
                    addNotification(`A new record in the ${category} category was added.`);
                    toast.success("New record detected! Adding to your list...");

                    try {
                        const newRecord = await contract.getRecordById(recordId);
                        // --- [FIX] RESTORING state update ---
                        setRecords(prevRecords => { 
                            const recordExists = prevRecords.some(r => Number(r[0]) === Number(newRecord[0]));
                            if (recordExists) {
                                return prevRecords;
                            }
                            return [...prevRecords, newRecord];
                        });
                    } catch (error) {
                        console.error("Failed to fetch new record by ID, falling back to full refresh.", error);
                        setTimeout(() => fetchPatientData(account, contract), 1000);
                    }
                }
            };

            const handleUserVerified = (admin, verifiedUser) => {
                if (verifiedUser.toLowerCase() === account.toLowerCase()) {
                    addNotification("Congratulations! Your account has been verified.");
                    // [FIX for loop] We call refetchUserProfile, which is correct
                    refetchUserProfile();
                }
            };
            
            // [FIXED] This is the fix for the PublicKeySetup loop
            const handlePublicKeySaved = async (userAddress) => {
                if (userAddress.toLowerCase() === account.toLowerCase()) {
                    addNotification("Your encryption key was securely saved on-chain!");
                    
                    try {
                        // 1. Read the user's data *directly from the smart contract*
                        // This avoids the race condition with the indexer/database.
                        const userOnChain = await contract.users(userAddress);
                        const newPublicKey = userOnChain.publicKey;
                        
                        if (newPublicKey && newPublicKey.length > 0) {
                            let userRole = null;
                            
                            // 2. Optimistically update the local user profile
                            // We use the functional form of setState to safely get the current role
                            setUserProfile(prevProfile => {
                                // [FIX] Check if prevProfile exists before accessing role
                                userRole = prevProfile ? prevProfile.role : null; 
                                return {
                                    ...prevProfile,
                                    publicKey: newPublicKey,
                                };
                            });
                            
                            // 3. Force the app to exit the setup screen
                            setNeedsPublicKeySetup(false);
                            
                            // 4. (Optional but good) Refetch patient data *after* state is updated
                            if (userRole === "Patient") {
                                fetchPatientData(userAddress, contract);
                            }
                        } else {
                            // This should not happen, but if it does, fall back to the old way
                            refetchUserProfile();
                        }
                    } catch (error) {
                        console.error("Error reading user data from chain in handlePublicKeySaved:", error);
                        refetchUserProfile(); // Fallback
                    } finally {
                        // [NEW] Whether it worked or failed, stop the "Confirming" state
                        setIsConfirmingKey(false);
                    }
                }
            };

            // --- [NEW] Handle incoming access requests from professionals ---
            const handleProfessionalAccessRequested = (requestId, recordIds, professional, patient) => {
                if (patient.toLowerCase() === account.toLowerCase()) {
                    addNotification(`You have a new access request from a professional.`);
                    toast.success("New access request received!");
                    // Trigger a state update that other components can listen to for refreshing their data.
                    setRequestUpdateCount(prev => prev + 1);
                }
            };

            contract.on('RecordAdded', handleRecordAdded);
            contract.on('UserVerified', handleUserVerified);
            contract.on('PublicKeySaved', handlePublicKeySaved); 
            // --- [NEW] Listen for the ProfessionalAccessRequested event ---
            contract.on('ProfessionalAccessRequested', handleProfessionalAccessRequested);

            return () => {
                contract.off('RecordAdded', handleRecordAdded);
                contract.off('UserVerified', handleUserVerified);
                contract.off('PublicKeySaved', handlePublicKeySaved); 
                // --- [NEW] Clean up the listener ---
                contract.off('ProfessionalAccessRequested', handleProfessionalAccessRequested);
            };
        }
        // [FIX] We can remove userProfile from the dependency array as it's not needed for the new logic
    }, [contract, account, signer, fetchPatientData, checkUserRegistrationAndState, refetchUserProfile]);


    return (
        <Web3Context.Provider value={{ 
            theme,
            setTheme,
            signer, account, contract, owner, isRegistered, userProfile, userStatus,
            // --- [FIX] RESTORING state to provider ---
            records, requests, accessList,
            isLoadingProfile, notifications, keyPair, needsPublicKeySetup,
            // [NEW] Expose the new loading state and its setter
            isConfirmingKey, 
            setIsConfirmingKey,
            requestUpdateCount, // --- [NEW] Expose the update trigger state ---
            connectWallet, 
            disconnect: disconnectWallet, 
            checkUserRegistration: () => checkUserRegistrationAndState(account, contract, signer),
            refetchUserProfile,
            markNotificationsAsRead,
            generateAndSetKeyPair,
            // [REMOVED] savePublicKeyOnChain is no longer provided
            // [NEW] Expose the entire API service
            api,
        }}>
            {children}
        </Web3Context.Provider>
    );
};

export const useWeb3 = () => {
    return useContext(Web3Context);
};

