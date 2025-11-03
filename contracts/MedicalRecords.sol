// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./AccessControl.sol";

/**
 * @title MedicalRecords
 * @dev The main entry point contract for the application.
 */
contract MedicalRecords is AccessControl, UUPSUpgradeable {

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    // [UNCHANGED]
    function initialize(address initialOwner) public initializer {
        __AccessControl_init(initialOwner);
        __UUPSUpgradeable_init();
    }
    
    // [UNCHANGED]
    function _authorizeUpgrade(address newImplementation)
        internal
        onlyOwner
        override
    {}

    // --- EVENTS (UNCHANGED) ---
    event RecordAdded(
        uint256 indexed recordId,
        address indexed owner,
        string title,
        string ipfsHash,
        string category,
        bool isVerified,
        address uploadedBy,
        uint256 timestamp
    );
    
    event RecordsBatchAdded(
        uint256[] recordIds,
        address indexed owner,
        bool isVerified,
        address indexed uploadedBy
    );


    // --- FUNCTIONS (SPONSORED) (UNCHANGED) ---

    /**
     * @dev [UNCHANGED] Allows a Sponsor to add a self-uploaded, non-verified medical record on behalf of a patient.
     */
    function addSelfUploadedRecord(
        address _patientAddress,
        string memory _ipfsHash,
        string memory _title,
        string memory _category
    ) public onlySponsor { 
        if (users[_patientAddress].role != Role.Patient) { revert NotAPatient(); }
        
        _createRecord(
            _patientAddress,
            _patientAddress,
            _ipfsHash,
            _title,
            _category,
            false,
            bytes(""),
            bytes("")
        );
    }

    /**
     * @dev [UNCHANGED] Allows a Sponsor to add a verified record for a patient on behalf of a professional.
     */
    function addVerifiedRecord(
        address _professionalAddress,
        address _patient,
        string memory _ipfsHash,
        string memory _title,
        string memory _category,
        bytes memory _encryptedKeyForPatient,
        bytes memory _encryptedKeyForHospital
    ) public onlySponsor { 
        if (users[_patient].walletAddress == address(0)) { revert UserNotFound(); }
        if (users[_patient].role != Role.Patient) { revert NotAPatient(); }

        User storage professional = users[_professionalAddress];
        if (
            (professional.role != Role.Doctor && professional.role != Role.LabTechnician) ||
            !professional.isVerified
        ) {
            revert NotAVerifiedProfessional();
        }

        _createRecord(
            _professionalAddress,
            _patient,
            _ipfsHash,
            _title,
            _category,
            true,
            _encryptedKeyForPatient,
            _encryptedKeyForHospital
        );
    }

    /**
     * @dev [UNCHANGED] Allows a Sponsor to add multiple self-uploaded records for a patient in a batch.
     */
    function addSelfUploadedRecordsBatch(
        address _patientAddress,
        string[] memory _ipfsHashes,
        string[] memory _titles,
        string[] memory _categories
    ) public onlySponsor {
        uint256 batchSize = _ipfsHashes.length;
        if (batchSize == 0) { revert EmptyInputArray(); }
        if (batchSize != _titles.length || batchSize != _categories.length) {
            revert InputArrayLengthMismatch();
        }
        if (users[_patientAddress].role != Role.Patient) { revert NotAPatient(); }

        uint256[] memory recordIds = new uint256[](batchSize);

        for (uint i = 0; i < batchSize; i++) {
            uint256 recordId = _createRecord(
                _patientAddress, // Uploader
                _patientAddress, // Owner
                _ipfsHashes[i],
                _titles[i],
                _categories[i],
                false,
                bytes(""),
                bytes("")
            );
            recordIds[i] = recordId;
        }

        emit RecordsBatchAdded(recordIds, _patientAddress, false, _patientAddress);
    }

    /**
     * @dev [UNCHANGED] Allows a Sponsor to add multiple verified records for a patient in a batch on behalf of a professional.
     */
    function addVerifiedRecordsBatch(
        address _professionalAddress,
        address _patient,
        string[] memory _ipfsHashes,
        string[] memory _titles,
        string[] memory _categories,
        bytes[] memory _encryptedKeysForPatient,
        bytes[] memory _encryptedKeysForHospital
    ) public onlySponsor {
        uint256 batchSize = _ipfsHashes.length;
        if (batchSize == 0) { revert EmptyInputArray(); }
        if (
            batchSize != _titles.length ||
            batchSize != _categories.length ||
            batchSize != _encryptedKeysForPatient.length ||
            batchSize != _encryptedKeysForHospital.length
        ) {
            revert InputArrayLengthMismatch();
        }

        if (users[_patient].walletAddress == address(0)) { revert UserNotFound(); }
        if (users[_patient].role != Role.Patient) { revert NotAPatient(); }

        User storage professional = users[_professionalAddress];
        if (
            (professional.role != Role.Doctor && professional.role != Role.LabTechnician) ||
            !professional.isVerified
        ) {
            revert NotAVerifiedProfessional();
        }

        uint256[] memory recordIds = new uint256[](batchSize);

        for (uint i = 0; i < batchSize; i++) {
            uint256 recordId = _createRecord(
                _professionalAddress, // Uploader
                _patient,             // Owner
                _ipfsHashes[i],
                _titles[i],
                _categories[i],
                true,
                _encryptedKeysForPatient[i],
                _encryptedKeysForHospital[i]
            );
            recordIds[i] = recordId;
        }

        emit RecordsBatchAdded(recordIds, _patient, true, _professionalAddress);
    }

    /**
     * @dev [MODIFIED] Internal function refactored to avoid "Stack too deep" error.
     */
    function _createRecord(
        address _uploaderAddress,
        address _patient,
        string memory _ipfsHash,
        string memory _title,
        string memory _category,
        bool _isVerified,
        bytes memory _encryptedKeyForPatient,
        bytes memory _encryptedKeyForHospital
    ) private returns (uint256) {
        
        // [MODIFIED] Create a storage pointer to avoid stack overflow
        records.push();
        Record storage newRecord = records[records.length - 1];
        uint256 recordId = records.length - 1;

        // [MODIFIED] Populate the struct fields one by one
        newRecord.id = recordId;
        newRecord.title = _title;
        newRecord.ipfsHash = _ipfsHash;
        newRecord.timestamp = block.timestamp;
        newRecord.uploadedBy = _uploaderAddress;
        newRecord.owner = _patient;
        newRecord.isVerified = _isVerified;
        newRecord.category = _category;
        newRecord.encryptedKeyForPatient = _encryptedKeyForPatient;
        newRecord.encryptedKeyForHospital = _encryptedKeyForHospital;


        patientRecordIds[_patient].push(recordId);

        recordAccess[recordId][_patient] = type(uint256).max;
        recordAccess[recordId][_uploaderAddress] = type(uint256).max;

        emit RecordAdded(
            recordId,
            _patient,
            _title,
            _ipfsHash,
            _category,
            _isVerified,
            _uploaderAddress,
            block.timestamp
        );

        return recordId;
    }

    // --- VIEW FUNCTIONS (UNCHANGED) ---

    // [UNCHANGED]
    function getPatientRecordIds(address _patientAddress) public view returns (uint256[] memory) {
        if (msg.sender != _patientAddress) {
            revert NotAuthorized();
        }
        return patientRecordIds[_patientAddress];
    }

    // [UNCHANGED]
    function getRecordById(uint256 _recordId) public view returns (Record memory) {
        if (!checkRecordAccess(_recordId, msg.sender)) {
            revert NotAuthorized();
        }
        return records[_recordId];
    }
}

