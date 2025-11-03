// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./Roles.sol";

/**
 * @title AccessControl
 * @dev Manages access permissions for medical records.
 * It is a logic contract that inherits state from Storage via Roles.
 */
contract AccessControl is Roles {
    // --- ERRORS ---
    error NotAPatient();
    error NotAVerifiedProfessional();
    error AccessAlreadyGranted();
    error NoAccessToRevoke();
    error NotAnInsuranceProvider();
    error RequestNotFound();
    error RecordNotFound();
    error NotRecordOwner();
    error InputArrayLengthMismatch();
    error EmptyInputArray();

    // --- EVENTS ---
    event AccessGranted(uint256 indexed recordId, address indexed owner, address indexed grantee, uint256 expiration, bytes encryptedDek);
    event RecordAccessRevoked(uint256 indexed recordId, address indexed professionalAddress); // Deprecated but kept for compatibility
    event AccessRequested(uint256 indexed requestId, address indexed patient, address indexed provider, string claimId);
    event ProfessionalAccessRequested(uint256 indexed requestId, uint256[] recordIds, address indexed professional, address indexed patient);
    event RequestApproved(uint256 indexed requestId, address indexed patient, uint256 accessDuration);

    // [NEW] Event for revoking multiple records at once.
    event AccessRevoked(address indexed patient, address indexed professional, uint256[] recordIds);


    // [UNCHANGED] Internal initializer
    // Internal initializer to set up the parent contract chain.
    function __AccessControl_init(address initialOwner) internal onlyInitializing {
        __Roles_init(initialOwner);
    }

    // --- FUNCTIONS (SPONSORED) ---

    /**
     * @dev Grants a user timed access to a specific medical record.
     * Callable only by a Sponsor on behalf of the patient.
     */
    function grantRecordAccess(address _patientAddress, uint256 _recordId, address _grantee, uint256 _durationInDays, bytes memory _encryptedDek) public onlySponsor {
        if (_recordId >= records.length) { revert RecordNotFound(); }
        Record storage recordToAccess = records[_recordId];
        if (recordToAccess.owner != _patientAddress) { revert NotRecordOwner(); }
        
        User storage grantee = users[_grantee];
        if (
            (grantee.role != Role.Doctor &&
            grantee.role != Role.LabTechnician &&
            grantee.role != Role.InsuranceProvider &&
            grantee.role != Role.Pharmacist &&
            grantee.role != Role.Researcher) ||
            !grantee.isVerified
        ) { revert NotAVerifiedProfessional(); }

        if (recordAccess[_recordId][_grantee] > block.timestamp) { revert AccessAlreadyGranted(); }

        uint256 expirationTime = block.timestamp + (_durationInDays * 1 days);
        recordAccess[_recordId][_grantee] = expirationTime;

        emit AccessGranted(_recordId, _patientAddress, _grantee, expirationTime, _encryptedDek);
    }

    /**
     * @dev Grants a user timed access to multiple medical records in a single transaction.
     * Callable only by a Sponsor on behalf of the patient.
     */
    function grantMultipleRecordAccess(address _patientAddress, uint256[] memory _recordIds, address _grantee, uint256 _durationInDays, bytes[] memory _encryptedDeks) public onlySponsor {
        if (_recordIds.length != _encryptedDeks.length) { revert InputArrayLengthMismatch(); }
        if (_recordIds.length == 0) { revert EmptyInputArray(); }

        User storage grantee = users[_grantee];
        if (
            (grantee.role != Role.Doctor &&
            grantee.role != Role.LabTechnician &&
            grantee.role != Role.InsuranceProvider &&
            grantee.role != Role.Pharmacist &&
            grantee.role != Role.Researcher) ||
            !grantee.isVerified
        ) { revert NotAVerifiedProfessional(); }

        uint256 expirationTime = block.timestamp + (_durationInDays * 1 days);

        for (uint i = 0; i < _recordIds.length; i++) {
            uint256 recordId = _recordIds[i];
            if (recordId < records.length && records[recordId].owner == _patientAddress) {
                if (recordAccess[recordId][_grantee] <= block.timestamp) {
                    recordAccess[recordId][_grantee] = expirationTime;
                    emit AccessGranted(recordId, _patientAddress, _grantee, expirationTime, _encryptedDeks[i]);
                }
            }
        }
    }

    /**
     * @dev [DEPRECATED] Revokes a professional's access to a specific medical record.
     * Callable only by a Sponsor on behalf of the patient.
     */
    function revokeRecordAccess(address _patientAddress, uint256 recordId, address professionalAddress) public onlySponsor {
        if (recordId >= records.length) { revert RecordNotFound(); }
        Record storage recordToAccess = records[recordId];

        if (recordToAccess.owner != _patientAddress) { revert NotRecordOwner(); }
        if (recordAccess[recordId][professionalAddress] == 0) { revert NoAccessToRevoke(); }

        delete recordAccess[recordId][professionalAddress];
        
        emit RecordAccessRevoked(recordId, professionalAddress);
    }

    /**
     * @dev [NEW] Revokes a professional's access to multiple medical records.
     * Callable only by a Sponsor on behalf of the patient.
     */
    function revokeMultipleRecordAccess(address _patientAddress, address professional, uint256[] calldata recordIds) public onlySponsor {
        if (recordIds.length == 0) { revert EmptyInputArray(); }

        for (uint i = 0; i < recordIds.length; i++) {
            uint256 recordId = recordIds[i];
            // We only check for record existence and ownership.
            // If access doesn't exist, we silently ignore it to prevent unnecessary reverts.
            if (recordId < records.length && records[recordId].owner == _patientAddress) {
                if(recordAccess[recordId][professional] > 0) {
                    delete recordAccess[recordId][professional];
                }
            }
        }
        
        emit AccessRevoked(_patientAddress, professional, recordIds);
    }

    /**
     * @dev Allows an insurance provider to request access to a patient's records for a claim.
     * Callable only by a Sponsor on behalf of the Insurance Provider.
     */
    function requestAccess(address _providerAddress, address _patientAddress, string memory _claimId) public onlySponsor {
       if (users[_providerAddress].role != Role.InsuranceProvider) { revert NotAnInsuranceProvider(); }
       if (users[_patientAddress].role != Role.Patient) { revert NotAPatient(); }
       uint256 requestId = _nextRequestId++;
       patientRequests[_patientAddress].push(AccessRequest({
            id: requestId,
            patient: _patientAddress,
            provider: _providerAddress,
            claimId: _claimId,
            status: RequestStatus.Pending
       }));
       emit AccessRequested(requestId, _patientAddress, _providerAddress, _claimId);
    }

    /**
     * @dev Allows a patient to approve an insurance provider's request.
     * Callable only by a Sponsor on behalf of the Patient.
     */
    function approveRequest(address _patientAddress, uint256 _requestId, uint256 _durationInDays) public onlySponsor {
        if (users[_patientAddress].role != Role.Patient) { revert NotAPatient(); }
        AccessRequest[] storage requests = patientRequests[_patientAddress];
        bool found = false;
        for (uint i = 0; i < requests.length; i++) {
            if (requests[i].id == _requestId && requests[i].status == RequestStatus.Pending) {
                requests[i].status = RequestStatus.Approved;
                uint256 expirationTime = block.timestamp + (_durationInDays * 1 days);
                address provider = requests[i].provider;

                uint256[] storage recordIds = patientRecordIds[_patientAddress];
                for (uint j = 0; j < recordIds.length; j++) {
                    uint256 recordId = recordIds[j];
                    recordAccess[recordId][provider] = expirationTime;
                    emit AccessGranted(recordId, _patientAddress, provider, expirationTime, "");
                }

                found = true;
                emit RequestApproved(_requestId, _patientAddress, _durationInDays);
                break;
            }
        }
        if (!found) { revert RequestNotFound(); }
    }

    /**
     * @dev Allows a verified professional (Doctor, Lab Technician) to request access to a patient's records.
     * Callable only by a Sponsor on behalf of the Professional.
     */
    function requestRecordAccess(address _professionalAddress, address _patient, uint256[] calldata _recordIds) public onlySponsor {
        User storage professional = users[_professionalAddress];
        if (
            (professional.role != Role.Doctor && professional.role != Role.LabTechnician) || !professional.isVerified
        ) {
            revert NotAVerifiedProfessional();
        }

        if (users[_patient].role != Role.Patient) {
            revert NotAPatient();
        }

        uint256 requestId = _nextRequestId++;

        emit ProfessionalAccessRequested(requestId, _recordIds, _professionalAddress, _patient);
    }

    // --- VIEW FUNCTIONS (UNCHANGED) ---

    // [UNCHANGED] View function, no gas cost, uses msg.sender for read-auth
    function checkRecordAccess(uint256 _recordId, address _viewer) public view returns (bool) {
        if (_recordId >= records.length) { return false; }
        Record storage recordToCheck = records[_recordId];
        if (recordToCheck.owner == _viewer || recordToCheck.uploadedBy == _viewer) { return true; }
        return recordAccess[_recordId][_viewer] > block.timestamp;
    }

    // [UNCHANGED] View function, no gas cost, uses msg.sender for read-auth
    function getPatientRequestsCount(address _patientAddress) public view returns (uint256) {
        if (msg.sender != _patientAddress) { revert NotAuthorized(); }
        return patientRequests[_patientAddress].length;
    }

    // [UNCHANGED] View function, no gas cost, uses msg.sender for read-auth
    function getPatientRequestAtIndex(address _patientAddress, uint256 _index) public view returns (AccessRequest memory) {
        if (msg.sender != _patientAddress) { revert NotAuthorized(); }
        return patientRequests[_patientAddress][_index];
    }
}
