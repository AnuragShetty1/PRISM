"use client";

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { useWeb3 } from '@/context/Web3Context';
import toast from 'react-hot-toast';
import { unwrapSymmetricKey } from '@/utils/crypto';
import { fetchFromIPFS } from '@/utils/ipfs'; // --- MODIFICATION: Import the resilient IPFS fetch utility ---

// --- ICONS ---
const ViewIcon = () => <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.432 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
const SpinnerIcon = () => <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>;
const DocumentIcon = () => <svg className="w-8 h-8 text-slate-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>;

// --- SUB-COMPONENT FOR FETCHING AND DISPLAYING METADATA ---
function RecordMetadataDisplay({ record, metadataCache, setMetadataCache }) {
    const metadata = metadataCache[record.recordId];

    useEffect(() => {
        if (!metadata && !metadataCache.hasOwnProperty(record.recordId)) {
            const fetchMetadata = async () => {
                try {
                    // --- MODIFICATION: Use the new utility to fetch metadata ---
                    const response = await fetchFromIPFS(record.ipfsHash);
                    const data = await response.json();
                    setMetadataCache(prev => ({ ...prev, [record.recordId]: data || null }));
                } catch (error) {
                    console.error(`Failed to fetch metadata for record ${record.recordId}:`, error);
                    setMetadataCache(prev => ({ ...prev, [record.recordId]: null }));
                }
            };
            fetchMetadata();
        }
    }, [record.recordId, record.ipfsHash, metadata, metadataCache, setMetadataCache]);

    if (metadata === undefined) {
        return <div className="flex-1 min-w-0"><div className="h-5 bg-slate-200 rounded w-3/4 animate-pulse"></div><div className="h-4 mt-2 bg-slate-200 rounded w-1/2 animate-pulse"></div></div>;
    }

    if (metadata === null) {
        return <div className="flex-1 min-w-0"><p className="font-semibold text-md text-red-600">Failed to load record details</p></div>;
    }

    return (
        <div className="flex-1 min-w-0">
            <p className="font-semibold text-md text-slate-800 truncate" title={metadata.title}>
                {metadata.title || "Untitled Record"}
            </p>
            <p className="text-sm text-slate-500 mt-1 truncate" title={metadata.fileName}>
                File: {metadata.fileName || "Unknown"}
            </p>
            <p className="text-xs text-slate-400 mt-2">
                Shared on: {record.createdAt ? format(new Date(record.createdAt), "PP") : 'Date not available'}
            </p>
        </div>
    );
}

// MODIFIED: Renamed component to LabRecordList
export default function LabRecordList({ records }) {
    const { keyPair } = useWeb3();
    const [decryptingId, setDecryptingId] = useState(null);
    const [metadataCache, setMetadataCache] = useState({});

    const handleViewRecord = async (record) => {
        if (!keyPair?.privateKey) {
            toast.error("Your security keys are not loaded.");
            return;
        }

        const metadata = metadataCache[record.recordId];
        if (!metadata) {
            toast.error("Record details are still loading, please try again in a moment.");
            return;
        }

        setDecryptingId(record.recordId);
        const toastId = toast.loading("Fetching encrypted file from IPFS...");

        try {
            const bundleHash = metadata.encryptedBundleIPFSHash;
            if (!bundleHash) throw new Error("Invalid metadata: Encrypted file hash is missing.");
            
            // --- MODIFICATION: Use the new utility to fetch the encrypted bundle ---
            const bundleResponse = await fetchFromIPFS(bundleHash);
            const encryptedBundle = await bundleResponse.json();

            toast.loading("Unwrapping secure key...", { id: toastId });
            const symmetricKey = await unwrapSymmetricKey(
                record.rewrappedKey,
                encryptedBundle.iv,
                keyPair.privateKey
            );

            toast.loading("Decrypting file...", { id: toastId });
            const decryptedData = await window.crypto.subtle.decrypt(
                { name: 'AES-GCM', iv: new Uint8Array(encryptedBundle.iv) },
                symmetricKey,
                new Uint8Array(encryptedBundle.encryptedData)
            );

            const blob = new Blob([decryptedData], { type: metadata.fileType || 'application/octet-stream' });
            const url = window.URL.createObjectURL(blob);
            window.open(url, '_blank');
            URL.revokeObjectURL(url);
            
            toast.success("Record decrypted and opened!", { id: toastId });
        } catch (error) {
            console.error("Decryption failed:", error);
            toast.error(error.message || "Could not decrypt the record.", { id: toastId });
        } finally {
            setDecryptingId(null);
        }
    };

    if (!records || records.length === 0) {
        return (
            <div className="text-center p-8 text-slate-500 bg-slate-50 rounded-lg mt-8">
                <h3 className="text-lg font-semibold text-slate-700">No Records Found</h3>
                <p className="mt-1">This patient has not shared any records with you.</p>
            </div>
        );
    }

    return (
        <div className="w-full bg-white rounded-xl shadow-sm border border-slate-200 mt-6">
            <div className="divide-y divide-slate-200">
                {records.map((record) => (
                    <div key={record.recordId} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 hover:bg-slate-50 transition-colors">
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                            <DocumentIcon />
                            <RecordMetadataDisplay record={record} metadataCache={metadataCache} setMetadataCache={setMetadataCache} />
                        </div>
                        <button
                            onClick={() => handleViewRecord(record)}
                            disabled={decryptingId === record.recordId || !metadataCache[record.recordId]}
                            className="mt-4 sm:mt-0 sm:ml-4 w-full sm:w-auto flex items-center justify-center px-4 py-2 text-sm font-semibold text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:bg-slate-400 transition-colors shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500"
                        >
                            {decryptingId === record.recordId ? <SpinnerIcon /> : <ViewIcon />}
                            <span className="ml-2">{decryptingId === record.recordId ? 'Decrypting...' : 'View'}</span>
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}
