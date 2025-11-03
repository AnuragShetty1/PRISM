import { ethers } from 'ethers';

// A static, predefined message that users will sign *only* for local storage encryption.
const LOCAL_STORAGE_SIGNATURE_MESSAGE = "Sign this message to generate and secure your MediLedger key. This will not cost any gas.";

// --- KEY MANAGEMENT ---

/**
 * Derives a deterministic AES-GCM key from a user's signature.
 * This key's ONLY purpose is to encrypt/decrypt the user's private key in local storage.
 * @param {ethers.Signer} signer - The user's wallet signer instance.
 * @returns {Promise<CryptoKey>} A key suitable for AES-GCM encryption.
 */
const getLocalStorageEncryptionKey = async (signer) => {
    // [MODIFIED] Use the dedicated message for local storage encryption
    const signature = await signer.signMessage(LOCAL_STORAGE_SIGNATURE_MESSAGE);
    const signatureBytes = ethers.toUtf8Bytes(signature);
    // [FIX] Correcting 'SHA-268' to 'SHA-256'
    const hashCorrect = await window.crypto.subtle.digest('SHA-256', signatureBytes);
    return window.crypto.subtle.importKey('raw', hashCorrect, 'AES-GCM', true, ['encrypt', 'decrypt']);
};

/**
 * Generates a new P-256 key pair for elliptic curve cryptography and stores it securely.
 * [MODIFIED] It now *also* generates the specific signature required by the backend.
 * @param {ethers.Signer} signer - The user's wallet signer instance.
 * @returns {Promise<{publicKey: string, privateKey: CryptoKey, signature: string}>} The generated key pair and signature.
 */
export const generateAndStoreKeyPair = async (signer) => {
    // 1. Generate the ECDH key pair
    const keyPair = await window.crypto.subtle.generateKey(
        { name: 'ECDH', namedCurve: 'P-256' },
        true,
        ['deriveKey']
    );

    // 2. Export the Public Key to Base64
    const publicKeyJwk = await window.crypto.subtle.exportKey('jwk', keyPair.publicKey);
    const publicKeyBase64 = window.btoa(JSON.stringify(publicKeyJwk));

    // --- [NEW] 3. Generate the required signature for the backend ---
    // This message MUST match the one your backend verifies in `users.js`
    const message = `Save my public key: ${publicKeyBase64}`;
    const signature = await signer.signMessage(message);
    // --- End of new logic ---

    // 4. Encrypt and store the Private Key in Local Storage
    const privateKeyJwk = await window.crypto.subtle.exportKey('jwk', keyPair.privateKey);
    const privateKeyString = JSON.stringify(privateKeyJwk);
    const privateKeyBytes = new TextEncoder().encode(privateKeyString);

    const storageKey = await getLocalStorageEncryptionKey(signer);
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encryptedPrivateKey = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        storageKey,
        privateKeyBytes
    );
    const userAddress = await signer.getAddress();
    localStorage.setItem(`encryptedPrivateKey-${userAddress}`, JSON.stringify({
        iv: Array.from(iv),
        data: Array.from(new Uint8Array(encryptedPrivateKey))
    }));
    localStorage.setItem(`publicKey-${userAddress}`, publicKeyBase64);

    // 5. [FIX] Return the full object, including the new signature
    return { 
        publicKey: publicKeyBase64, 
        privateKey: keyPair.privateKey, 
        signature: signature 
    };
};

/**
 * Loads the user's key pair from local storage.
 * @param {ethers.Signer} signer - The user's wallet signer instance.
 * @returns {Promise<{publicKey: string, privateKey: CryptoKey} | null>} The loaded key pair or null if not found.
 */
export const loadKeyPair = async (signer) => {
    if (!signer) return null;
    const userAddress = await signer.getAddress();
    const publicKey = localStorage.getItem(`publicKey-${userAddress}`);
    const encryptedKeyData = localStorage.getItem(`encryptedPrivateKey-${userAddress}`);

    if (!publicKey || !encryptedKeyData) {
        return null;
    }

    const { iv, data } = JSON.parse(encryptedKeyData);
    const ivArray = new Uint8Array(iv);
    const dataArray = new Uint8Array(data);

    try {
        const storageKey = await getLocalStorageEncryptionKey(signer);
        const decryptedPrivateKeyBytes = await window.crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: ivArray },
            storageKey,
            dataArray
        );

        const privateKeyJwk = JSON.parse(new TextDecoder().decode(decryptedPrivateKeyBytes));
        const privateKey = await window.crypto.subtle.importKey(
            'jwk',
            privateKeyJwk,
            { name: 'ECDH', namedCurve: 'P-256' },
            true,
            ['deriveKey']
        );

        return { publicKey, privateKey };
    } catch (error) {
        console.error("Failed to decrypt private key:", error);
        // [FIX] If decryption fails (e.g., user signed with a different wallet),
        // clear the stale keys to prevent a loop.
        localStorage.removeItem(`publicKey-${userAddress}`);
        localStorage.removeItem(`encryptedPrivateKey-${userAddress}`);
        return null;
    }
};

// --- HYBRID ENCRYPTION (ECIES IMPLEMENTATION) ---

/**
 * Encrypts data for multiple recipients using a standard ECIES approach.
 * @param {ArrayBuffer} data - The raw data to encrypt.
 * @param {string[]} recipientPublicKeysBase64 - An array of base64 encoded public keys.
 * @returns {Promise<Object>} A serializable object containing the encrypted bundle.
 */
export const hybridEncrypt = async (data, recipientPublicKeysBase64) => {
    const symmetricKey = await window.crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
    );
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encryptedData = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        symmetricKey,
        data
    );

    const encryptedSymmetricKeys = {};
    for (const publicKeyBase64 of recipientPublicKeysBase64) {
        const ephemeralKeyPair = await window.crypto.subtle.generateKey(
            { name: 'ECDH', namedCurve: 'P-256' },
            true,
            ['deriveKey']
        );

        const publicKeyJwk = JSON.parse(window.atob(publicKeyBase64));
        const recipientPublicKey = await window.crypto.subtle.importKey(
            'jwk', publicKeyJwk,
            { name: 'ECDH', namedCurve: 'P-256' },
            true, []
        );

        const sharedSecret = await window.crypto.subtle.deriveKey(
            { name: 'ECDH', public: recipientPublicKey },
            ephemeralKeyPair.privateKey,
            { name: 'AES-GCM', length: 256 },
            true, ['wrapKey', 'unwrapKey']
        );
        
        const wrappedKey = await window.crypto.subtle.wrapKey(
            'raw', symmetricKey, sharedSecret, { name: 'AES-GCM', iv: iv }
        );
        
        const ephemeralPublicKeyJwk = await window.crypto.subtle.exportKey('jwk', ephemeralKeyPair.publicKey);

        encryptedSymmetricKeys[publicKeyBase64] = {
            ephemeralPublicKey: ephemeralPublicKeyJwk,
            wrappedKey: Array.from(new Uint8Array(wrappedKey))
        };
    }

    return {
        iv: Array.from(iv),
        encryptedData: Array.from(new Uint8Array(encryptedData)),
        encryptedSymmetricKeys,
    };
};

/**
 * Decrypts data that was encrypted with the ECIES hybrid approach.
 * @param {Object} encryptedBundle - The object from hybridEncrypt.
 * @param {CryptoKey} userPrivateKey - The user's own private key.
 * @returns {Promise<ArrayBuffer>} The decrypted raw data.
 */
export const hybridDecrypt = async (encryptedBundle, userPrivateKey) => {
    const { iv, encryptedData, encryptedSymmetricKeys } = encryptedBundle;

    let symmetricKey;

    // Iterate through all possible keys for recipients.
    for (const pubKeyBase64 in encryptedSymmetricKeys) {
        try {
            const { ephemeralPublicKey, wrappedKey } = encryptedSymmetricKeys[pubKeyBase64];
            
            const ephemeralPubKey = await window.crypto.subtle.importKey(
                'jwk', ephemeralPublicKey,
                { name: 'ECDH', namedCurve: 'P-256' },
                true, []
            );

            // Derive the same shared secret using the ephemeral public key and our private key.
            const sharedSecret = await window.crypto.subtle.deriveKey(
                { name: 'ECDH', public: ephemeralPubKey },
                userPrivateKey,
                { name: 'AES-GCM', length: 256 },
                true, ['wrapKey', 'unwrapKey']
            );

            // "Unwrap" (decrypt) the symmetric data key.
            symmetricKey = await window.crypto.subtle.unwrapKey(
                'raw', new Uint8Array(wrappedKey), sharedSecret,
                { name: 'AES-GCM', iv: new Uint8Array(iv) },
                { name: 'AES-GCM', length: 256 },
                true, ['decrypt']
            );

            // If we successfully unwrapped a key, we've found our key. Break the loop.
            if (symmetricKey) break; 
        } catch (error) {
            // This error is expected if we are not the intended recipient of this specific key.
            continue;
        }
    }

    if (!symmetricKey) {
        throw new Error("Decryption failed: You are not a recipient of this file, or the data is corrupt.");
    }
    
    // Decrypt the main data bundle with the successfully unwrapped symmetric key.
    const decryptedData = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: new Uint8Array(iv) },
        symmetricKey,
        new Uint8Array(encryptedData)
    );

    return decryptedData;
};


// --- [NEW] KEY WRAPPING FOR SHARING ---

/**
 * [NEW] Re-wraps the symmetric key of an encrypted bundle for a new recipient.
 * This is used when a patient shares a record with a professional.
 * @param {Object} encryptedBundle - The full encrypted object from IPFS.
 * @param {CryptoKey} patientPrivateKey - The patient's private key to decrypt the original DEK.
 * @param {string} professionalPublicKeyBase64 - The professional's public key to re-encrypt for.
 * @returns {Promise<Object>} The re-wrapped key bundle as a serializable JS object.
 */
export const rewrapSymmetricKey = async (encryptedBundle, patientPrivateKey, professionalPublicKeyBase64) => {
    const { iv, encryptedSymmetricKeys } = encryptedBundle;
    let symmetricKey;

    // 1. Decrypt (unwrap) the original symmetric key using the patient's private key.
    for (const pubKeyBase64 in encryptedSymmetricKeys) {
        try {
            const { ephemeralPublicKey, wrappedKey } = encryptedSymmetricKeys[pubKeyBase64];
            const ephemeralPubKey = await window.crypto.subtle.importKey('jwk', ephemeralPublicKey, { name: 'ECDH', namedCurve: 'P-256' }, true, []);
            const sharedSecret = await window.crypto.subtle.deriveKey(
                { name: 'ECDH', public: ephemeralPubKey },
                patientPrivateKey,
                { name: 'AES-GCM', length: 256 },
                true, ['wrapKey', 'unwrapKey']
            );
            symmetricKey = await window.crypto.subtle.unwrapKey(
                'raw', new Uint8Array(wrappedKey), sharedSecret,
                { name: 'AES-GCM', iv: new Uint8Array(iv) },
                { name: 'AES-GCM', length: 256 },
                true, ['encrypt', 'decrypt'] // Need both permissions for re-wrapping
            );
            if (symmetricKey) break;
        } catch (e) {
            continue;
        }
    }

    if (!symmetricKey) {
        throw new Error("Key re-wrapping failed: Could not decrypt the original symmetric key.");
    }

    // 2. Re-encrypt (wrap) the symmetric key for the professional.
    const newEphemeralKeyPair = await window.crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey']);
    const professionalPublicKeyJwk = JSON.parse(window.atob(professionalPublicKeyBase64));
    // [FIX] Correcting 'P-2S6' to 'P-256'
    const professionalPublicKeyCorrect = await window.crypto.subtle.importKey('jwk', professionalPublicKeyJwk, { name: 'ECDH', namedCurve: 'P-256' }, true, []);
    
    const newSharedSecret = await window.crypto.subtle.deriveKey(
        { name: 'ECDH', public: professionalPublicKeyCorrect }, // Use corrected key
        newEphemeralKeyPair.privateKey,
        { name: 'AES-GCM', length: 256 },
        true, ['wrapKey', 'unwrapKey']
    );

    const newWrappedKey = await window.crypto.subtle.wrapKey(
        'raw', symmetricKey, newSharedSecret, { name: 'AES-GCM', iv: new Uint8Array(iv) }
    );

    const newEphemeralPublicKeyJwk = await window.crypto.subtle.exportKey('jwk', newEphemeralKeyPair.publicKey);

    // 3. Package the new ephemeral public key and the newly wrapped key for the contract.
    const rewrappedBundle = {
        ephemeralPublicKey: newEphemeralPublicKeyJwk,
        wrappedKey: Array.from(new Uint8Array(newWrappedKey))
    };

    // [FIX] Return the raw JS object. The API layer will stringify it,
    // and the backend service will convert that string to bytes.
    return rewrappedBundle;
};

/**
 * [NEW] Unwraps a symmetric key that was re-wrapped for the current user.
 * This is used by a professional to get the DEK after a patient has shared a record.
 * @param {string} rewrappedDekHex - The hex string of the re-wrapped key from the smart contract event.
 * @param {ArrayBuffer} iv - The IV from the original encrypted file bundle.
 * @param {CryptoKey} professionalPrivateKey - The professional's private key.
 * @returns {Promise<CryptoKey>} The decrypted symmetric key (DEK).
 */
export const unwrapSymmetricKey = async (rewrappedDekHex, iv, professionalPrivateKey) => {
    // [FIX] Ethers returns `bytes` from events as a hex string. Decode it to get the original JSON.
    const rewrappedDekString = ethers.toUtf8String(rewrappedDekHex);
    const { ephemeralPublicKey, wrappedKey } = JSON.parse(rewrappedDekString);
    
    const ephemeralPubKey = await window.crypto.subtle.importKey(
        'jwk', ephemeralPublicKey,
        { name: 'ECDH', namedCurve: 'P-256' },
        true, []
    );

    const sharedSecret = await window.crypto.subtle.deriveKey(
        { name: 'ECDH', public: ephemeralPubKey },
        professionalPrivateKey,
        { name: 'AES-GCM', length: 256 },
        true, ['wrapKey', 'unwrapKey']
    );

    const symmetricKey = await window.crypto.subtle.unwrapKey(
        'raw', new Uint8Array(wrappedKey), sharedSecret,
        { name: 'AES-GCM', iv: new Uint8Array(iv) },
        { name: 'AES-GCM', length: 256 },
        true, ['decrypt']
    );

    return symmetricKey;
};


// Helper function to convert a Base64 string back to a Uint8Array
export const base64ToUint8Array = (base64) => {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
};
