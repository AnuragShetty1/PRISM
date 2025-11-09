# PRISM — Patient Record Integrity and Security Management

PRISM is a decentralized, patient-centric medical records management system designed for privacy, security, and interoperability. It leverages the Ethereum blockchain for immutable access control and a hybrid on-chain/off-chain architecture to ensure that sensitive patient data remains private and entirely under the patient's control.

The system uses **End-to-End Hybrid Encryption**, storing only encrypted data blobs on IPFS and managing access rights via upgradeable smart contracts. A Node.js backend serves as a high-performance indexer and API, enabling real-time application features without sacrificing decentralized trust.

---

## Table of Contents

- [Overview & Core Features](#overview--core-features)
- [High-Level Architecture](#high-level-architecture)
- [Smart Contract Architecture](#smart-contract-architecture)
- [User Roles & Permissions](#user-roles--permissions)
- [Technology Stack](#technology-stack)
- [Encryption & Data Flow (Detailed)](#encryption--data-flow-detailed)
  - [1. User Onboarding & Key Generation](#1-user-onboarding--key-generation)
  - [2. Patient: Uploading a Record](#2-patient-uploading-a-record)
  - [3. Patient: Sharing a Record](#3-patient-sharing-a-record)
  - [4. Grantee: Accessing a Record](#4-grantee-accessing-a-record)
- [Project Structure](#project-structure)
- [Advantages & Limitations](#advantages--limitations)
- [Environment Variables & Configuration](#environment-variables--configuration)
  - [Frontend (.env.local)](#frontend-envlocal)
  - [Backend (backend/.env)](#backend-backendenv)
- [Local Development Setup](#local-development-setup)

---

## Overview & Core Features

PRISM is designed to solve the core problems of traditional health records: data silos, lack of patient control, and interoperability.

- **Patient-Centric Control:** Patients are the sole owners of their records. They have granular control to grant and revoke access to any professional, at any time, for any record.
- **End-to-End Hybrid Encryption:** All medical files are encrypted in the browser before being uploaded. The file's symmetric encryption key (DEK) is then asymmetrically encrypted for the patient and any professional they grant access to. The platform never has access to plaintext medical data.
- **Off-Chain Data, On-Chain Access:** Sensitive files are stored on IPFS, not the blockchain. The smart contract only stores metadata, ipfsHash pointers, and the encrypted DEKs for authorized users. This ensures privacy and dramatically reduces gas costs.
- **Hybrid On/Off-Chain System:** A Node.js backend indexes all smart contract events into a MongoDB database. This allows the frontend to load data (like record lists, user profiles, and access requests) instantly via a REST API, while still relying on the blockchain as the ultimate source of truth.
- **Role-Based Access Control (RBAC):** The smart contract defines multiple user roles (Patient, Doctor, LabTechnician, HospitalAdmin, SuperAdmin, etc.) with specific permissions.
- **Real-Time Updates:** The backend uses a WebSocket server to push live event notifications (e.g., AccessRequested, RecordAdded) to the frontend, creating a responsive user experience.
- **Admin Gas Abstraction:** Administrative actions (like a SuperAdmin verifying a hospital or a HospitalAdmin registering a professional) are initiated via a backend API. The backend server wallet pays the gas fee for these transactions, abstracting the complexity away from admin users.
- **User-Friendly Onboarding:** Leverages Web3Auth to allow users to log in with familiar web2 accounts (Google, email, etc.), lowering the barrier to entry.
- **Upgradeable Smart Contracts:** Uses the OpenZeppelin UUPS (Universal Upgradeable Proxy Standard) pattern, allowing contract logic to be upgraded without migrating data.

---

## High-Level Architecture

The system is composed of four main components:

1. **Frontend (Next.js + Ethers.js):**  
   Handles authentication, client-side cryptography, file encryption/decryption, transaction signing, API queries, and real-time updates.

2. **Smart Contracts (Solidity):**  
   Deployed on Ethereum, storing user/record metadata, access mappings, and emitting events.

3. **IPFS (via Pinata):**  
   Decentralized storage for all encrypted medical files.

4. **Backend (Node.js + MongoDB):**  
   Indexes contract events, provides a REST API, relays admin transactions, and pushes live updates via WebSocket.

---

## Smart Contract Architecture

The smart contract logic is separated into multiple contracts for clarity, security, and to support the UUPS upgradeable proxy pattern.

- **Storage.sol:** Holds all state variables (structs, mappings, etc.).
- **Roles.sol:** Defines the Role enum and RBAC logic.
- **AccessControl.sol:** Manages logic for granting, revoking, and requesting access to records.
- **MedicalRecords.sol:** Main contract (proxy), inherits others and manages user/record logic.

**Key Functions:**

- `registerUser(string memory _name, Role _role)`
- `savePublicKey(string memory _publicKey)`
- `addSelfUploadedRecord(...)`
- `addVerifiedRecord(...)`
- `registerHospital(string memory _name)`
- `registerProfessional(...)`

---

## User Roles & Permissions

PRISM's smart contracts enforce a strict set of permissions based on user roles.

- **Patient:**  
  Register, save public key, upload records, grant/revoke access.
- **Professional (Doctor, LabTechnician):**  
  Register, save public key, request access, upload verified records.
- **HospitalAdmin:**  
  All professional permissions plus register/revoke professionals.
- **SuperAdmin:**  
  Register/verify/revoke hospitals.

---

## Technology Stack

| Component    | Technology                | Purpose                                         |
|--------------|--------------------------|-------------------------------------------------|
| Blockchain   | Solidity, Hardhat, OZ    | Smart contracts, upgradeability                 |
| Frontend     | React, Next.js, Tailwind | UI, routing, styling                            |
| Web3 (Client)| Ethers.js, Web3Auth      | Wallet connection, contract interaction         |
| Backend      | Node.js, Express.js      | REST API, WebSocket, admin relayer              |
| Indexer      | Ethers.js, MongoDB       | Event listening, fast queries                   |
| Database     | MongoDB, Mongoose        | Off-chain data storage                          |
| File Storage | IPFS (Pinata)            | Decentralized encrypted file storage            |
| Cryptography | WebCrypto API            | In-browser encryption/decryption                |

---

## Encryption & Data Flow (Detailed)

All encryption and decryption happens on the client-side.

### 1. User Onboarding & Key Generation

- User logs in via Web3Auth.
- Registers on-chain if not already.
- Generates ECDH (P-256) key pair if needed.
- Public key saved on-chain; private key encrypted with password and stored locally.

### 2. Patient: Uploading a Record

- Patient selects file.
- Generates random symmetric key (DEK).
- Encrypts file with AES-GCM.
- Uploads encrypted file to IPFS.
- Encrypts DEK with their own public key (self-wrap).
- Submits transaction with metadata and self-encrypted DEK.

### 3. Patient: Sharing a Record

- Doctor requests access (on-chain event).
- Patient receives notification.
- Patient decrypts DEK, re-encrypts for Doctor using ECDH.
- Submits grant transaction with new encrypted DEK for Doctor.

### 4. Grantee: Accessing a Record

- Doctor fetches record metadata and encrypted DEK.
- Decrypts DEK with their private key.
- Fetches encrypted file from IPFS.
- Decrypts file and views it in browser.

---

## Project Structure

```
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
```

---

## Advantages & Limitations

### Advantages

- **True Data Sovereignty:** The patient is the only one who can initiate the sharing process.
- **High Privacy:** No one (not even the PRISM platform) can read the medical data.
- **Auditability:** All access grants and state changes are recorded immutably on the blockchain.
- **Scalability:** The off-chain indexer and API provide a fast user experience that doesn't require constant, slow calls to the blockchain for reading data.
- **Excellent User Experience:** Web3Auth removes the need for users to manage seed phrases. The Admin Gas Abstraction simplifies administrative workflows.

### Limitations & Future Improvements

- **Security Risk: NEXT_PUBLIC_PINATA_JWT:**  
  The current implementation (src/utils/ipfs.js) reads the Pinata JWT from a NEXT_PUBLIC_ variable, which exposes it to the browser.  
  **FIX:** The project already contains the correct solution: `src/app/api/upload/route.js`. The frontend should be refactored to call this internal API route, which then securely uses the backend PINATA_JWT (stored as `process.env.PINATA_JWT`) to upload the file.

- **Gas Costs (User):**  
  While admin transactions are "gasless," all transactions by Patients and Professionals (registering, uploading, granting access) still require gas fees.

- **Centralization Points:**  
  The system relies on several centralized components:
  - **Backend:** The Indexer/API is a single point of failure. If it's down, the app will be slow and degraded (though core logic remains on-chain).
  - **Pinata:** If the Pinata gateway is down, files cannot be uploaded or accessed.
  - **Web3Auth:** Relies on Web3Auth's infrastructure for login.

- **Key Management:**  
  Storing the user's encrypted private key in localStorage is convenient but less secure than using a browser extension like MetaMask or a hardware wallet.

- **Data Availability:**  
  IPFS only guarantees storage for as long as a node (in this case, Pinata) is pinning the data. For true permanence, a solution like Arweave or Filecoin incentives would be needed.

---

## Environment Variables & Configuration

### Frontend (`.env.local`)

Create this file in the root directory.

```env
# Web3Auth Client ID for social/email login
NEXT_PUBLIC_WEB3AUTH_CLIENT_ID="YOUR_WEB3AUTH_CLIENT_ID"

# Pinata JWT for uploading files to IPFS
# WARNING: This is exposed to the client. See "Limitations & Future Improvements"
NEXT_PUBLIC_PINATA_JWT="YOUR_PINATA_JWT_KEY"
```

### Backend (`backend/.env`)

Create this file in the `/backend` directory. `CONTRACT_ADDRESS` and `PROVIDER_URL` will be added automatically by the deploy script.

```env
# RPC URL for the blockchain network
PROVIDER_URL="http://127.0.0.1:8545"

# Deployed contract address (added by deploy script)
CONTRACT_ADDRESS="0x..."

# MongoDB connection string
MONGO_URI="mongodb://127.0.0.1:27017/prism_db"

# Private key for the server's admin wallet (DO NOT use a funded mainnet wallet)
# This wallet pays for admin transactions (e.g., verifyHospital)
# Use one of the Hardhat node's private keys for testing
SUPER_ADMIN_PRIVATE_KEY="0x..."
```

---

## Local Development Setup

### Prerequisites

- Node.js (v18+ recommended)
- NPM
- MongoDB (running locally or a free Atlas cluster)

### Step 1: Install Dependencies (Root & Backend)

```sh
# Install root (frontend + hardhat) dependencies
npm install

# Install backend dependencies
cd backend
npm install
cd ..
```

### Step 2: Start Local Hardhat Node (Terminal 1)

This starts a local blockchain, gives you 20 test accounts, and runs an RPC server at http://127.0.0.1:8545.

```sh
npx hardhat node
```

Keep this terminal running.

### Step 3: Deploy Smart Contracts (Terminal 2)

This script deploys the MedicalRecords contract to your local Hardhat node. It will also automatically update `src/contracts/` with the ABI/address and append the `CONTRACT_ADDRESS` and `PROVIDER_URL` to `backend/.env`.

```sh
npx hardhat run --network localhost scripts/deploy.js
```

### Step 4: Configure Backend Environment

The deploy.js script created/updated `backend/.env`.

Open `backend/.env` and add your `MONGO_URI` and `SUPER_ADMIN_PRIVATE_KEY`.

For `SUPER_ADMIN_PRIVATE_KEY`, copy one of the private keys from the `npx hardhat node` output (Terminal 1).

### Step 5: Start Backend Server (Terminal 2)

This starts the API, indexer, and WebSocket server.

```sh
cd backend
npm run dev
```

You should see logs for "MongoDB connected" and "Indexer started". Keep this running.

### Step 6: Start Frontend Server (Terminal 3)

```sh
# From the root directory
npm run dev
```

### Step 7: Open the App

Open [http://localhost:3000](http://localhost:3000) in your browser. You can now connect using Web3Auth and interact with the application running on your local blockchain.

---

**For more details, see the in-code documentation and comments throughout the repository.**