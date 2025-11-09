PRISM — Patient Record Integrity and Security Management

PRISM is a decentralized, patient-centric medical records management system designed for privacy, security, and interoperability. It leverages the Ethereum blockchain for immutable access control and a hybrid on-chain/off-chain architecture to ensure that sensitive patient data remains private and entirely under the patient's control.

The system uses End-to-End Hybrid Encryption, storing only encrypted data blobs on IPFS and managing access rights via upgradeable smart contracts. A Node.js backend serves as a high-performance indexer and API, enabling real-time application features without sacrificing decentralized trust.

Table of Contents

Overview & Core Features

High-Level Architecture

Smart Contract Architecture

User Roles & Permissions

Technology Stack

Encryption & Data Flow (Detailed)

1. User Onboarding & Key Generation

2. Patient: Uploading a Record

3. Patient: Sharing a Record

4. Grantee: Accessing a Record

Project Structure

Advantages & Limitations

Environment Variables & Configuration

Frontend (.env.local)

Backend (backend/.env)

Local Development Setup

Overview & Core Features

PRISM is designed to solve the core problems of traditional health records: data silos, lack of patient control, and interoperability.

Patient-Centric Control: Patients are the sole owners of their records. They have granular control to grant and revoke access to any professional, at any time, for any record.

End-to-End Hybrid Encryption: All medical files are encrypted in the browser before being uploaded. The file's symmetric encryption key (DEK) is then asymmetrically encrypted for the patient and any professional they grant access to. The platform never has access to plaintext medical data.

Off-Chain Data, On-Chain Access: Sensitive files are stored on IPFS, not the blockchain. The smart contract only stores metadata, ipfsHash pointers, and the encrypted DEKs for authorized users. This ensures privacy and dramatically reduces gas costs.

Hybrid On/Off-Chain System: A Node.js backend indexes all smart contract events into a MongoDB database. This allows the frontend to load data (like record lists, user profiles, and access requests) instantly via a REST API, while still relying on the blockchain as the ultimate source of truth.

Role-Based Access Control (RBAC): The smart contract defines multiple user roles (Patient, Doctor, LabTechnician, HospitalAdmin, SuperAdmin, etc.) with specific permissions.

Real-Time Updates: The backend uses a WebSocket server to push live event notifications (e.g., AccessRequested, RecordAdded) to the frontend, creating a responsive user experience.

Admin Gas Abstraction: Administrative actions (like a SuperAdmin verifying a hospital or a HospitalAdmin registering a professional) are initiated via a backend API. The backend server wallet pays the gas fee for these transactions, abstracting the complexity away from admin users.

User-Friendly Onboarding: Leverages Web3Auth to allow users to log in with familiar web2 accounts (Google, email, etc.), lowering the barrier to entry.

Upgradeable Smart Contracts: Uses the OpenZeppelin UUPS (Universal Upgradeable Proxy Standard) pattern, allowing contract logic to be upgraded without migrating data.

High-Level Architecture

The system is composed of four main components:

Frontend (Next.js + Ethers.js): The client-side application used by all roles. It handles:

Authentication via Web3Auth.

Client-side cryptographic key generation (ECDH P-256).

File encryption (AES-GCM) and decryption.

Signing and sending transactions for user-initiated actions (uploading, granting access).

Querying the backend API for fast data loading.

Subscribing to the WebSocket server for real-time updates.

Smart Contracts (Solidity): Deployed on the Ethereum network. They act as the decentralized source of truth for:

User and professional registration (User structs).

User public keys for encryption.

Record metadata (e.g., ipfsHash, title, category).

The mapping of who can access what (recordDeks[recordId][granteeAddress]).

Emitting events for every state change.

IPFS (via Pinata): A decentralized storage network. PRISM stores all encrypted medical files on IPFS. The smart contract only stores the IPFS content identifier (ipfsHash).

Backend (Node.js + MongoDB): A service layer that optimizes the application.

Indexer: Listens to all contract events (RecordAdded, AccessGranted, etc.) and populates a MongoDB database.

REST API (Express): Serves the indexed data (users, records, requests) to the frontend for fast, scalable reads.

Admin Relayer: Provides secure API endpoints for admins. When called, the server uses its own wallet (SUPER_ADMIN_PRIVATE_KEY) to pay for and send administrative transactions (e.g., verifyHospital).

WebSocket Server (ws): Pushes live event data to connected clients.

Smart Contract Architecture

The smart contract logic is separated into multiple contracts for clarity, security, and to support the UUPS upgradeable proxy pattern.

Storage.sol: This abstract contract holds all state variables (structs, mappings, etc.). It does not contain any logic. By isolating storage, we can upgrade the logic contracts (AccessControl, MedicalRecords) while pointing to the same storage proxy, ensuring data is preserved across upgrades and preventing storage layout collisions.

Key Structs: User, Record, Hospital

Key Mappings:

mapping(address => User) public users;: Stores user data by address.

mapping(uint256 => Record) public records;: Stores record metadata by ID.

mapping(uint256 => mapping(address => bytes)) public recordDeks;: Stores the encrypted DEK for a specific record (uint256) and grantee (address).

Roles.sol: This contract defines the Role enum (Patient, Doctor, LabTechnician, etc.) and provides internal functions and modifiers for role-based access control, such as _hasRole and onlyRole(Role).

AccessControl.sol: Inherits from Storage and Roles. This contract manages all logic related to granting, revoking, and requesting access to records.

Key Functions:

grantRecordAccess(uint256 _recordId, address _grantee, bytes memory _encryptedDek): Patient-only function to grant access.

revokeRecordAccess(uint256 _recordId, address _grantee): Patient-only function to revoke access.

requestRecordAccess(uint256 _recordId, address _patient): Professional-only function to request access, emitting an AccessRequested event.

MedicalRecords.sol: This is the main, external-facing contract that serves as the UUPS proxy entry point. It inherits from AccessControl and contains all user and record management logic.

Key Functions:

registerUser(string memory _name, Role _role): Allows a new user to register.

savePublicKey(string memory _publicKey): Allows a registered user to save their ECDH public key.

addSelfUploadedRecord(...): Patient-only function to add a new record.

addVerifiedRecord(...): Professional-only function to add a record (e.g., a lab result) associated with a patient.

registerHospital(string memory _name): SuperAdmin-only function (called via backend relayer).

registerProfessional(...): HospitalAdmin-only function (called via backend relayer).

User Roles & Permissions

PRISM's smart contracts enforce a strict set of permissions based on user roles.

Patient:

registerUser as a Patient.

savePublicKey to enable receiving shared records.

addSelfUploadedRecord for personal health records.

grantRecordAccess to share any of their records with any address.

revokeRecordAccess to remove access from a grantee.

Professional (Doctor, LabTechnician):

registerUser as a Doctor, LabTechnician, etc.

savePublicKey to enable receiving shared records.

requestRecordAccess to ask a patient for access to a record.

addVerifiedRecord to upload an official record (like a lab report or diagnosis) directly to a patient's profile.

HospitalAdmin:

All permissions of a Professional.

registerProfessional: Registers a new professional and assigns them to their hospital. This action is verified on-chain.

revokeProfessional: De-lists a professional from their hospital.

(Note: These admin actions are typically performed via the backend API to use the Admin Gas Abstraction feature).

SuperAdmin:

registerHospital: Registers a new, unverified hospital.

verifyHospital: Verifies a hospital, allowing its admins to register professionals.

revokeHospital: Revokes a hospital's verification status.

(Note: These admin actions are performed via the backend API).

Technology Stack

Component

Technology

Purpose

Blockchain

Solidity, Hardhat, OpenZeppelin

Smart contract development, testing, deployment, and upgradeability.

Frontend

React, Next.js, Tailwind CSS

User interface and component-based architecture.

Web3 (Client)

Ethers.js, Web3Auth

Wallet connection, contract interaction, and user-friendly social logins.

Backend

Node.js, Express.js

REST API server, WebSocket server, and admin transaction relayer.

Indexer

Ethers.js (listener), MongoDB

Subscribes to chain events and stores data in a queryable database.

Database

MongoDB, Mongoose

Off-chain database for indexed event data, enabling fast queries.

File Storage

IPFS (via Pinata)

Decentralized storage for all encrypted medical files.

Cryptography

WebCrypto API (AES-GCM, ECDH)

In-browser end-to-end encryption and key management.

Encryption & Data Flow (Detailed)

This is the core privacy mechanism of PRISM. All encryption and decryption happens on the client-side.

1. User Onboarding & Key Generation

Login: A new user (Patient or Professional) logs in using Web3Auth.

Registration: The frontend checks the contract if the user is registered. If not, the user signs a registerUser transaction.

Key Pair Generation: The frontend checks if the user has a public key saved on-chain.

If not, crypto.js generates a new ECDH (P-256) asymmetric key pair.

The Public Key is saved on-chain by the user in their User struct via savePublicKey.

The Private Key is encrypted with a key derived from the user's password (prompted via a modal) and stored in localStorage.

2. Patient: Uploading a Record

File Selection: Patient selects a file to upload.

Symmetric Key (DEK) Generation: The frontend generates a new, random 32-byte symmetric key, known as the Data Encryption Key (DEK).

File Encryption: The file's contents are encrypted using AES-GCM with this DEK.

IPFS Upload: The encrypted file blob is uploaded to IPFS (via Pinata). The application receives an ipfsHash (CID).

DEK Encryption (Self-Wrap): The frontend fetches the Patient's own Public Key from the contract. It then uses ECDH (Patient Private Key + Patient Public Key) to derive a shared secret, which is used to encrypt the DEK.

Transaction: The Patient signs and sends the addSelfUploadedRecord transaction, which stores the ipfsHash, title, category, and the self-encrypted DEK on-chain.

3. Patient: Sharing a Record

This flow describes how a Patient grants access to a Doctor (Grantee).

Request: A Doctor sends a requestRecordAccess transaction. The contract emits an AccessRequested event.

Notification: The backend indexer catches this event and pushes a notification to the Patient via WebSocket.

Patient Approval: The Patient sees the request in their dashboard and clicks "Approve".

Client-Side "Proxy Re-Encryption": This is the magic. The Patient's frontend executes the following:
a.  Fetches the record's self-encrypted DEK from the contract.
b.  Loads the Patient's Private Key from localStorage (decrypting it with their password).
c.  Decrypts the self-encrypted DEK to get the plaintext DEK.
d.  Fetches the Doctor's Public Key from the contract.
e.  Uses ECDH (Patient's Private Key + Doctor's Public Key) to derive a new shared secret.
f.  Re-encrypts the plaintext DEK using this new shared secret. This creates an encrypted DEK for the Doctor.

Grant Transaction: The Patient signs and sends the grantRecordAccess transaction, passing the recordId, the Doctor's address, and the newly-encrypted DEK for the Doctor.

State Change: The smart contract saves this new encrypted DEK in the recordDeks[recordId][doctorAddress] mapping and emits an AccessGranted event.

4. Grantee: Accessing a Record

Data Fetch: The Doctor's frontend queries the backend API to get a list of records they have been granted access to.

Select Record: The Doctor clicks "View" on a record.

Fetch Data: The frontend fetches the record's ipfsHash (from the API or contract).

Fetch Encrypted DEK: The frontend calls the contract's recordDeks mapping to get the encrypted DEK specific to them: recordDeks[recordId][myAddress].

Decrypt DEK: The Doctor's frontend loads their Private Key from localStorage (decrypting with their password) and uses it to decrypt the fetched DEK, retrieving the plaintext DEK.

Fetch File: The frontend uses the ipfsHash to fetch the encrypted file from IPFS.

Decrypt File: The frontend uses the plaintext DEK to decrypt the file's contents using AES-GCM.

View: The file is displayed securely in the browser.

Project Structure

/
├── backend/                # Node.js Backend (Indexer, API, Relayer)
│   ├── src/
│   │   ├── api/            # Express API routes (users, superAdmin, hospitalAdmin)
│   │   ├── config/         # Environment variable config
│   │   ├── indexer/        # Contract event listener logic
│   │   ├── models/         # Mongoose schemas for MongoDB
│   │   ├── services/       # Ethers.js service for admin wallet
│   │   └── utils/          # Logger, error handlers
│   ├── .env.example        # Environment variable template
│   ├── package.json
│   └── server.js           # Server entry point
│
├── contracts/              # Solidity Smart Contracts
│   ├── AccessControl.sol   # Logic for granting, revoking, and requesting access
│   ├── MedicalRecords.sol  # Main contract (proxy), inherits others
│   ├── Roles.sol           # Role definitions and modifiers
│   └── Storage.sol         # All state variables and structs
│
├── ignition/               # (Hardhat Ignition)
│
├── scripts/                # Deployment scripts
│   └── deploy.js           # Deploys upgradeable proxy, writes ABI and address
│
├── src/                    # Next.js Frontend
│   ├── app/                # Next.js 13 App Router
│   │   └── api/upload/     # API route for secure IPFS uploads (Hides Pinata Key)
│   ├── components/         # React components (Dashboards, Forms, Modals)
│   ├── context/            #
│   │   └── Web3Context.js  # Core app logic: Web3Auth, contract state, event listeners
│   ├── contracts/          # Contract ABI and deployed address (autogenerated)
│   ├── utils/              #
│   │   ├── crypto.js       # All client-side encryption/decryption logic
│   │   └── ipfs.js         # Helper for fetching/uploading to IPFS
│   └── layout.js           # Root layout
│
├── .env.local.example      # Frontend environment variable template
├── hardhat.config.js       # Hardhat configuration
├── next.config.mjs         # Next.js configuration
└── package.json            # Root package.json (Frontend + Hardhat)


Advantages & Limitations

Advantages

True Data Sovereignty: The patient is the only one who can initiate the sharing process.

High Privacy: No one (not even the PRISM platform) can read the medical data.

Auditability: All access grants and state changes are recorded immutably on the blockchain.

Scalability: The off-chain indexer and API provide a fast user experience that doesn't require constant, slow calls to the blockchain for reading data.

Excellent User Experience: Web3Auth removes the need for users to manage seed phrases. The Admin Gas Abstraction simplifies administrative workflows.

Limitations & Future Improvements

Security Risk: NEXT_PUBLIC_PINATA_JWT: The current implementation (src/utils/ipfs.js) reads the Pinata JWT from a NEXT_PUBLIC_ variable, which exposes it to the browser. This is a significant security risk.

FIX: The project already contains the correct solution: src/app/api/upload/route.js. The frontend should be refactored to call this internal API route, which then securely uses the backend PINATA_JWT (stored as process.env.PINATA_JWT) to upload the file.

Gas Costs (User): While admin transactions are "gasless," all transactions by Patients and Professionals (registering, uploading, granting access) still require gas fees. This is not a fully gasless system for all users.

Centralization Points: The system relies on several centralized components:

Backend: The Indexer/API is a single point ofFailure. If it's down, the app will be slow and degraded (though core logic remains on-chain).

Pinata: If the Pinata gateway is down, files cannot be uploaded or accessed.

Web3Auth: Relies on Web3Auth's infrastructure for login.

Key Management: Storing the user's encrypted private key in localStorage is convenient but less secure than using a browser extension like MetaMask or a hardware wallet.

Data Availability: IPFS only guarantees storage for as long as a node (in this case, Pinata) is pinning the data. For true permanence, a solution like Arweave or Filecoin incentives would be needed.

Environment Variables & Configuration

Frontend (.env.local)

Create this file in the root directory.

# Web3Auth Client ID for social/email login
NEXT_PUBLIC_WEB3AUTH_CLIENT_ID="YOUR_WEB3AUTH_CLIENT_ID"

# Pinata JWT for uploading files to IPFS
# WARNING: This is exposed to the client. See "Limitations & Future Improvements"
NEXT_PUBLIC_PINATA_JWT="YOUR_PINATA_JWT_KEY"


Backend (backend/.env)

Create this file in the /backend directory. CONTRACT_ADDRESS and PROVIDER_URL will be added automatically by the deploy script.

# RPC URL for the blockchain network
PROVIDER_URL="[http://127.0.0.1:8545](http://127.0.0.1:8545)"

# Deployed contract address (added by deploy script)
CONTRACT_ADDRESS="0x..."

# MongoDB connection string
MONGO_URI="mongodb://127.0.0.1:27017/prism_db"

# Private key for the server's admin wallet (DO NOT use a funded mainnet wallet)
# This wallet pays for admin transactions (e.g., verifyHospital)
# Use one of the Hardhat node's private keys for testing
SUPER_ADMIN_PRIVATE_KEY="0x..."


Local Development Setup

Prerequisites:

Node.js (v18+ recommended)

NPM

MongoDB (running locally or a free Atlas cluster)

Step 1: Install Dependencies (Root & Backend)

# Install root (frontend + hardhat) dependencies
npm install

# Install backend dependencies
cd backend
npm install
cd ..


Step 2: Start Local Hardhat Node (Terminal 1)

This starts a local blockchain, gives you 20 test accounts, and runs an RPC server at http://127.0.0.1:8545.

npx hardhat node


Keep this terminal running.

Step 3: Deploy Smart Contracts (Terminal 2)

This script deploys the MedicalRecords contract to your local Hardhat node. It will also automatically update src/contracts/ with the ABI/address and append the CONTRACT_ADDRESS and PROVIDER_URL to backend/.env.

npx hardhat run --network localhost scripts/deploy.js


Step 4: Configure Backend Environment

The deploy.js script created/updated backend/.env.

Open backend/.env and add your MONGO_URI and SUPER_ADMIN_PRIVATE_KEY.

For SUPER_ADMIN_PRIVATE_KEY, copy one of the private keys from the npx hardhat node output (Terminal 1).

Step 5: Start Backend Server (Terminal 2)

This starts the API, indexer, and WebSocket server.

cd backend
npm run dev


You should see logs for "MongoDB connected" and "Indexer started". Keep this running.

Step 6: Start Frontend Server (Terminal 3)

# From the root directory
npm run dev


Step 7: Open the App

Open http://localhost:3000 in your browser. You can now connect using Web3Auth and interact with the application running on your local blockchain.