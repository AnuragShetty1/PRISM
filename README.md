
# PRISM — Patient Record Integrity and Security Management

This repository implements MediLedger, a decentralized medical records management system built with Ethereum smart contracts, a Next.js frontend, and a Node.js backend/indexer. The system focuses on privacy-preserving record storage (encrypted files on IPFS), fine-grained on-chain access control, hybrid cryptography for secure record sharing, and upgradeable smart contracts.

This README documents the full stack, explains why each technology and package is used, details the cryptography design and how it is implemented in the code, maps the project structure, and provides precise run and deployment instructions for local development.
````markdown

# PRISM - Pateint Record Intigrity and Security Management

This repository implements MediLedger, a decentralized medical records management system built with Ethereum smart contracts, a Next.js frontend, and a Node.js backend/indexer. The system focuses on privacy-preserving record storage (encrypted files on IPFS), fine-grained on-chain access control, hybrid cryptography for secure record sharing, and upgradeable smart contracts.

This README documents the full stack, explains why each technology and package is used, details the cryptography design and how it is implemented in the code, maps the project structure, and provides precise run and deployment instructions for local development.

Table of contents
- Overview & goals
- High-level architecture
- Technologies & packages (why used)
- Smart contracts (detailed)
- Backend & indexer (detailed)
- Frontend (detailed)
- Crypto & encryption design (detailed)
- Data & event flows (dashboards and user journeys)
- Project structure (file map and purpose)
- Environment variables & configuration
- Local development — step by step
- Notes, testing, and next steps

## Overview & goals

MediLedger lets patients store references to medical records (encrypted files) on IPFS while keeping file contents private. The Ethereum smart contract stores metadata, public keys, and time-limited access grants. The backend indexes chain events and exposes REST and WebSocket endpoints for the frontend. The frontend manages keys, encrypts/decrypts files in-browser, and handles role-based UI for Patients, Professionals (Doctors, Lab Technicians), Insurance, Hospital Admins, and SuperAdmins.

Primary goals:
- Confidentiality: file contents encrypted client-side and never stored on-chain.
- Controlled sharing: on-chain grants and expirations govern access.
- Auditability: contract events record important actions and drive the indexer.
- Upgradeability: Contracts use OpenZeppelin UUPS so logic can be upgraded while preserving storage.

## High-level architecture

- Smart contracts (Solidity): application state (users, records metadata, access mappings).
- IPFS: stores encrypted file bundles (DEK-wrapped bundle containing encrypted file, IV, and wrapped DEKs per recipient).
- Frontend (Next.js + Web3Auth + Ethers): user interface, key management, cryptographic operations, and direct contract interactions.
- Backend (Express + Mongoose): indexer that listens to contract events, stores queryable representations in MongoDB, and performs admin on-chain calls using a server-side signer.
- WebSockets: push notifications for real-time UI updates.

High-level flow (short):
1. User encrypts file in-browser and uploads encrypted bundle to IPFS.
2. Frontend writes metadata and encrypted key payloads to the smart contract, emitting `RecordAdded`.
3. Backend/indexer consumes the event, persists a record in MongoDB, and notifies clients via WebSocket.
4. Patient can grant access to professionals; re-wrapping of DEKs allows secure sharing without re-encrypting files.

## Technologies & packages (why used)

Top-level packages (see `package.json` and `backend/package.json` for versions):

- hardhat, @nomicfoundation/hardhat-toolbox: Ethereum dev environment for compiling, running local chain, testing, and deploying contracts.
- @openzeppelin/contracts-upgradeable, @openzeppelin/hardhat-upgrades: implement and deploy upgradeable contracts via UUPS pattern.
- ethers: interact with Ethereum nodes/contract ABIs (used both in frontend and backend).
- next, react, react-dom: frontend framework (UI and pages).
- @web3auth/modal, @web3auth/base: authentication layer that supports wallets and social login flows for browser users.
- express, mongoose: backend server and MongoDB ODM for the indexer.
- ws: WebSocket server used by the backend to push real-time events to frontend clients.
- winston: structured logging in backend.
- dotenv: environment variable loading for backend.
- tailwindcss, autoprefixer, postcss: frontend styling and tooling.

Why these choices
- Ethers gives reliable provider/contract tooling. OpenZeppelin handles upgradeability and standard contracts. Web3Auth reduces friction for users who may not be familiar with wallets. IPFS + hybrid crypto keeps sensitive data off-chain but accessible to authorized recipients.

## Smart contracts (detailed)

Contracts are in `contracts/` and follow a storage/logic separation.

Key contracts:
- `Storage.sol`: abstract contract containing all state variables and structs. Using a dedicated storage contract helps avoid storage layout collisions during upgrades.
- `AccessControl.sol`: contains access-management logic (grant, multi-grant, revoke, requests). Emits events like `AccessGranted`, `ProfessionalAccessRequested`, `AccessRevoked`.
- `MedicalRecords.sol`: top-level contract inheriting `AccessControl` and `UUPSUpgradeable`. Exposes `addSelfUploadedRecord`, `addVerifiedRecord`, and `_createRecord` which appends Record structs and emits `RecordAdded`.

Important types & patterns:
- Role enum: Patient, Doctor, HospitalAdmin, InsuranceProvider, Pharmacist, Researcher, Guardian, LabTechnician, SuperAdmin.
- Record struct: id, title, ipfsHash, timestamp, uploadedBy, owner, isVerified, category, encryptedKeyForPatient, encryptedKeyForHospital.
- Access mapping: `mapping(uint256 => mapping(address => uint256)) recordAccess;` stores expiry timestamps for each grantee.
- Events drive the backend indexer.

Security notes for contracts
- Carefully manage who can assign roles and verify users — these admin operations should be restricted and performed by trusted signers.
- Store only encrypted key blobs on-chain (opaque bytes); do not attempt to decrypt on-chain.

## Backend & indexer (detailed)

Location: `backend/`

Responsibilities:
- Index contract events (RecordAdded, ProfessionalAccessRequested, AccessGranted, PublicKeySaved, etc.) and save them to MongoDB.
- Expose REST endpoints used by the frontend (e.g., status endpoints used in `src/context/Web3Context.js`).
- Provide admin functions (verifyHospital, assignRole, revokeRole) via `backend/src/services/ethersService.js` which uses a server-side signer configured through environment variables.
- Host a WebSocket server to notify connected frontend clients of new events.

Important files:
- `backend/server.js` — loads env, initializes MongoDB connection, registers routes, starts HTTP + WebSocket server, and starts the indexer.
- `backend/src/services/ethersService.js` — sets up a JsonRpcProvider + Wallet signer using `SUPER_ADMIN_PRIVATE_KEY` and exposes convenience functions for admin contract calls.

Notes about the backend signer
- `ethersService.init()` will exit the process if `SUPER_ADMIN_PRIVATE_KEY` is missing. Ensure this is set in `backend/.env` or the environment when running the server.

## Frontend (detailed)

Location: `src/` (Next.js app)

Primary responsibilities:
- Authentication and wallet session management via Web3Auth.
- Client-side cryptographic key generation and key storage encryption.
- Encrypting files (AES-GCM), building encrypted bundles with per-recipient wrapped DEKs, uploading to IPFS, and calling the smart contract to register the file metadata.
- React context `src/context/Web3Context.js` centralizes provider, signer, contract, account, and helper functions like `generateAndSetKeyPair` and `savePublicKeyOnChain`.

Key frontend components and logic:
- `Web3Context.js`: handles Web3Auth events, network switching, contract instantiation, event listeners (RecordAdded, UserVerified, PublicKeySaved, ProfessionalAccessRequested), and state management for records, requests, and notifications.
- `src/utils/crypto.js`: implements local key encryption (signature-derived AES-GCM key), ECDH (P-256) for hybrid encryption, hybridEncrypt/hybridDecrypt, rewrapSymmetricKey/unwrapSymmetricKey, and helpers for base64/Uint8Array conversion.
- `src/utils/ipfs.js`: helper that tries multiple gateways in order for fetching IPFS content.

Frontend assumptions and caveats:
- The app stores encrypted private keys in localStorage keyed by wallet address; this offers convenience for local development but is not as secure as a hardware-backed key store.
- Public keys are saved to-chain (string base64) using `savePublicKey`. The contract stores the publicKey string inside the User struct.

## Crypto & encryption design (detailed)

The system uses hybrid ECIES-style encryption implemented using the WebCrypto API.

Primitives used (see `src/utils/crypto.js`):
- Asymmetric: ECDH (P-256) — to derive shared secrets between ephemeral keys and recipients' public keys.
- Symmetric: AES-GCM-256 — to encrypt file contents and to wrap/unwrap DEKs.
- Local storage encryption: AES-GCM with a key derived by hashing a signed message — allows deterministic key derivation using a wallet signature.

Encryption flows

1) File encryption (single upload):
		- Generate DEK (AES-GCM 256).
		- Encrypt file bytes with DEK + IV.
		- For each recipient public key: generate ephemeral ECDH key pair, derive shared secret, use derived key to wrap DEK via AES-GCM wrapKey. Store ephemeral public key JWK + wrappedKey bytes in the bundle per recipient.
		- Store serialized bundle (iv, encryptedData, encryptedSymmetricKeys) on IPFS and write returned CID to blockchain metadata.

2) Re-wrap (patient shares existing encrypted file with new professional):
		- Patient uses local private ECDH key to unwrap the DEK from the bundle.
		- Patient generates ephemeral key pair and wraps the DEK for the professional's public key.
		- Patient sends the rewrapped payload to the contract (or to the backend) which is then given to the professional. The professional unwraps using their private key to obtain the DEK and decrypts the IPFS file.

Key management
- The user's long-term key pair (ECDH P-256) is generated in-browser and the public key is saved on-chain with `savePublicKey` for other parties to fetch. The private key is exported to JWK and encrypted using an AES-GCM storage key derived from a wallet signature (so only the owner who can sign that message can decrypt the private key blob from localStorage).

Security caveats and recommendations
- LocalStorage encryption is better than plaintext, but for production, use secure hardware or OS-backed key stores or require re-sign on each session.
- All cryptographic operations use the WebCrypto API in the browser. Compatibility should be verified on target browsers.

## Data & event flows (dashboards and user journeys)

Patient dashboard
- Upload record: encrypt file, upload to IPFS, call `addSelfUploadedRecord(ipfsHash, title, category)`.
- View own records: frontend uses `getPatientRecordIds()` and `getRecordById()` to access metadata (contract view functions) — these require the caller to be the patient address for some functions.
- Approve insurance or grant access: patient calls `grantRecordAccess` or `grantMultipleRecordAccess` with rewrapped DEKs as `bytes[]`.

Professional dashboard (Doctor, Lab Technician)
- Request patient access: call `requestRecordAccess(patient, recordIds)` to emit `ProfessionalAccessRequested`.
- After patient rewraps and grants, receive rewrapped DEK and call unwrapSymmetricKey to retrieve DEK and decrypt file.

SuperAdmin / Hospital admin
- Use backend REST endpoints (e.g., described in `backend/src/api/routes/`) to verify hospitals, assign roles, and administratively manage registrations. These calls may use `ethersService` to send on-chain transactions from a configured admin wallet.

## Project structure (file map and purpose)

Top-level files & directories
- `contracts/` — Solidity sources: `MedicalRecords.sol`, `AccessControl.sol`, `Storage.sol`, `Roles.sol`.
- `scripts/deploy.js` — deploys an upgradeable MedicalRecords proxy and writes `src/contracts/contract-address.json` and backend `.env` helper.
- `hardhat.config.js` — compiler and network settings.
- `src/` — Next.js frontend:
	- `src/context/Web3Context.js` — Web3Auth init, network switching, session management, event listeners.
	- `src/utils/crypto.js` — encryption primitives and key management used in the browser.
	- `src/utils/ipfs.js` — IPFS helper.
	- `src/components/` — React components for dashboards, upload forms, key management.
- `backend/` — Express server and indexer that subscribes to chain events and stores searchable data in MongoDB.

## Environment variables & configuration

Frontend (Next.js) environment variables
- `NEXT_PUBLIC_WEB3AUTH_CLIENT_ID` — client id for Web3Auth initialization (browser-safe variable).

Backend `.env` (or environment)
- `CONTRACT_ADDRESS` — deployed MedicalRecords address (set by `scripts/deploy.js`).
- `PROVIDER_URL` — RPC endpoint for the chain (default set to `http://127.0.0.1:8545` by deploy script for local dev).
- `MONGO_URI` — MongoDB connection string for indexer (e.g. `mongodb://127.0.0.1:27017/medical_records_db`).
- `SUPER_ADMIN_PRIVATE_KEY` — server-side private key used for admin on-chain transactions (required by `ethersService`).
- `JWT_SECRET` — placeholder if backend exposes JWT-based APIs.

Important: `backend/server.js` expects environment variables to be available before it starts. The deploy script writes `backend/.env` with CONTRACT_ADDRESS and PROVIDER_URL; edit it to add `SUPER_ADMIN_PRIVATE_KEY` and `MONGO_URI`.

## Local development — step by step

Prerequisites
- Node.js (v18+ recommended)
- npm
- MongoDB (local or Atlas)

1) Install dependencies (root and backend)

```powershell
npm install
cd backend; npm install; cd ..
```

2) Start Hardhat node in a new terminal (this provides local accounts and an RPC at http://127.0.0.1:8545):

```powershell
npx hardhat node
```

3) Deploy contracts to the local network (keep Hardhat node running):

```powershell
npx hardhat run --network localhost scripts/deploy.js
```

The deploy script will write `src/contracts/contract-address.json` and `src/contracts/MedicalRecords.json`. It will also create or update `backend/.env` and set `CONTRACT_ADDRESS` and `PROVIDER_URL`.

4) Edit `backend/.env` and add the remaining required values:

```powershell
CONTRACT_ADDRESS="<address-from-deploy>"
PROVIDER_URL="http://127.0.0.1:8545"
MONGO_URI="mongodb://127.0.0.1:27017/medical_records_db"
SUPER_ADMIN_PRIVATE_KEY="0x..."
JWT_SECRET="a_very_secret_value"
```

5) Start the backend server (indexer + API + WebSocket)

```powershell
cd backend
npm run dev
```

You should see logs about connecting to MongoDB and starting the indexer. The indexer subscribes to the deployed contract events to populate the database.

6) Start the frontend (Next.js) development server

```powershell
cd ..
npm run dev
```

Open `http://localhost:3000` in the browser. Connect with Web3Auth. On first connect, the app will try to switch to the Hardhat network (chainId 31337). If it fails, ensure your wallet supports custom chain switching or manually select the local network.

7) Quick manual test flow
- In the Hardhat node terminal you'll see a set of funded accounts; use one to act as deployer/admin and others as test users.
- Use the frontend to log in as a patient, generate keys, upload an encrypted file, then as a professional request access and test rewrap/unwrap flows.

