// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title Storage
 * @dev This contract holds all the state variables for the Medical Records application.
 * By separating storage from logic, we prevent storage collisions and make the
 * contract system more modular and upgradeable.
 * This is an abstract contract and is not meant to be deployed directly.
 */
abstract contract Storage {

    // --- DATA STRUCTURES ---

    enum Role { Patient, Doctor, HospitalAdmin, InsuranceProvider, Pharmacist, Researcher, Guardian, LabTechnician, SuperAdmin }

    struct User {
        address walletAddress;
        string name;
        Role role;
        bool isVerified;
        string publicKey;
    }

    struct UserProfile {
        string name;
        string contactInfo;
        string profileMetadataURI;
    }

    struct Record {
        uint256 id;
        string title; // For search and display via indexer.
        string ipfsHash;
        uint256 timestamp;
        address uploadedBy;
        address owner;
        bool isVerified;
        string category;
        bytes encryptedKeyForPatient;
        bytes encryptedKeyForHospital;
    }

    enum RequestStatus { Pending, Approved, Rejected }

    struct AccessRequest {
        uint256 id;
        address patient;
        address provider;
        string claimId;
        RequestStatus status;
    }
    
    struct Hospital {
        uint256 hospitalId;
        string name;
        address adminAddress;
        bool isVerified;
    }
    
    struct RegistrationRequest {
        uint256 hospitalId;
        string name;
        address requesterAddress;
        RequestStatus status;
    }


    // --- STATE VARIABLES ---

    // Core user data storage
    mapping(address => User) public users;
    mapping(address => UserProfile) public userProfiles;

    // Record storage and access control
    Record[] public records;
    mapping(address => uint256[]) public patientRecordIds;
    mapping(uint256 => mapping(address => uint256)) public recordAccess;

    // Insurance provider access request management
    mapping(address => AccessRequest[]) public patientRequests;
    uint256 internal _nextRequestId;

    // Hospital and role management
    mapping(uint256 => Hospital) public hospitals;
    uint256 public hospitalIdCounter;
    mapping(uint256 => RegistrationRequest) public registrationRequests;
    mapping(address => uint256) public userToHospital; // userAddress => hospitalId
    
    mapping(address => uint256) public professionalToHospitalId;

    // [NEW] Mapping to grant sponsor role for gas-less transactions
    mapping(address => bool) public isSponsor;
}
