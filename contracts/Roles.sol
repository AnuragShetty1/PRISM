// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "./Storage.sol";

/**
 * @title Roles
 * @dev This contract manages user registration, verification, and profile updates.
 * It is a logic contract that inherits its state from the Storage contract.
 */
contract Roles is Initializable, OwnableUpgradeable, Storage {
    // --- ERRORS ---
    error AlreadyRegistered();
    error NotRegistered();
    error UserNotFound();
    error PublicKeyAlreadySet();
    error CannotRegisterAsAdmin();
    error NotSuperAdmin();
    error RequestNotFoundOrAlreadyHandled();
    error NotHospitalAdmin();
    error RoleNotAllowed();
    error UserAlreadyInHospital();
    error UserNotInHospital();
    error NotAuthorized();
    error HospitalNotVerified();
    error NotSponsor(); // [NEW] For sponsor-only functions

    // --- EVENTS ---
    event UserRegistered(address indexed userAddress, string name, Role role);
    event UserVerified(address indexed admin, address indexed userAddress);
    event ProfileUpdated(address indexed user, string name, string contactInfo, string profileMetadataURI);
    event PublicKeySaved(address indexed user);
    event RegistrationRequested(uint256 indexed hospitalId, string name, address indexed requester);
    event HospitalVerified(uint256 indexed hospitalId, address indexed adminAddress);
    event HospitalRevoked(uint256 indexed hospitalId);
    event RoleAssigned(address indexed user, Role role, uint256 indexed hospitalId);
    event RoleRevoked(address indexed user, Role role, uint256 indexed hospitalId);
    event SponsorGranted(address indexed sponsor); // [NEW]
    event SponsorRevoked(address indexed sponsor); // [NEW]

    // Internal initializer to set up the parent contract.
    function __Roles_init(address initialOwner) internal onlyInitializing {
        __Ownable_init(initialOwner);
    }

    // --- MODIFIERS ---
    
    /**
     * @dev Throws if called by any account other than a designated sponsor.
     */
    modifier onlySponsor() {
        if (!isSponsor[msg.sender]) { revert NotSponsor(); }
        _;
    }

    // --- SPONSOR ROLE MANAGEMENT (SUPER ADMIN ONLY) ---

    /**
     * @dev Grants sponsor role to an account.
     * Callable only by the Super Admin (owner).
     */
    function grantSponsorRole(address _sponsor) public onlyOwner {
        isSponsor[_sponsor] = true;
        emit SponsorGranted(_sponsor);
    }

    /**
     * @dev Revokes sponsor role from an account.
     * Callable only by the Super Admin (owner).
     */
    function revokeSponsorRole(address _sponsor) public onlyOwner {
        isSponsor[_sponsor] = false;
        emit SponsorRevoked(_sponsor);
    }

    // --- USER FUNCTIONS (SPONSORED) ---

    /**
     * @dev Registers a new user.
     * Callable only by a Sponsor on behalf of a user.
     */
    function registerUser(address _userAddress, string memory _name, Role _role) public onlySponsor {
        if (users[_userAddress].walletAddress != address(0)) { revert AlreadyRegistered(); }
        if (_role == Role.HospitalAdmin || _role == Role.SuperAdmin) { revert CannotRegisterAsAdmin(); }

        users[_userAddress] = User({
            walletAddress: _userAddress,
            name: _name,
            role: _role,
            isVerified: false,
            publicKey: ""
        });

        userProfiles[_userAddress] = UserProfile({
            name: _name,
            contactInfo: "",
            profileMetadataURI: ""
        });

        emit UserRegistered(_userAddress, _name, _role);
    }

    /**
     * @dev Saves a user's public key.
     * Callable only by a Sponsor on behalf of a user.
     */
    function savePublicKey(address _userAddress, string memory _publicKey) public onlySponsor {
        if (users[_userAddress].walletAddress == address(0)) { revert NotRegistered(); }
        if (bytes(users[_userAddress].publicKey).length > 0) { revert PublicKeyAlreadySet(); }

        users[_userAddress].publicKey = _publicKey;
        emit PublicKeySaved(_userAddress);
    }

    /**
     * @dev Updates a user's profile information.
     * Callable only by a Sponsor on behalf of a user.
     */
    function updateUserProfile(address _userAddress, string calldata _name, string calldata _contactInfo, string calldata _profileMetadataURI) public onlySponsor {
        if (users[_userAddress].walletAddress == address(0)) { revert NotRegistered(); }

        userProfiles[_userAddress].name = _name;
        userProfiles[_userAddress].contactInfo = _contactInfo;
        userProfiles[_userAddress].profileMetadataURI = _profileMetadataURI;
        users[_userAddress].name = _name;

        emit ProfileUpdated(_userAddress, _name, _contactInfo, _profileMetadataURI);
    }


    // --- Hospital Management Functions ---

    /**
     * @dev Submits a request to register a new hospital.
     * Callable only by a Sponsor on behalf of a user.
     */
    function requestRegistration(address _requesterAddress, string memory hospitalName) public onlySponsor {
        uint256 id = hospitalIdCounter++;
        registrationRequests[id] = RegistrationRequest({
            hospitalId: id,
            name: hospitalName,
            requesterAddress: _requesterAddress,
            status: RequestStatus.Pending
        });
        emit RegistrationRequested(id, hospitalName, _requesterAddress);
    }

    // [UNCHANGED] Admin function, not sponsored
    function verifyHospital(uint256 hospitalId, address adminAddress) public onlyOwner {
        if (registrationRequests[hospitalId].status != RequestStatus.Pending) {
            revert RequestNotFoundOrAlreadyHandled();
        }
        if (users[adminAddress].walletAddress != address(0)) { revert AlreadyRegistered(); }

        registrationRequests[hospitalId].status = RequestStatus.Approved;
        
        hospitals[hospitalId] = Hospital({
            hospitalId: hospitalId,
            name: registrationRequests[hospitalId].name,
            adminAddress: adminAddress,
            isVerified: true
        });

        users[adminAddress] = User({
            walletAddress: adminAddress,
            name: "Admin",
            role: Role.HospitalAdmin,
            isVerified: true,
            publicKey: ""
        });
        userProfiles[adminAddress] = UserProfile({ name: "Admin", contactInfo: "", profileMetadataURI: "" });
        userToHospital[adminAddress] = hospitalId;

        emit HospitalVerified(hospitalId, adminAddress);
        emit UserRegistered(adminAddress, "Admin", Role.HospitalAdmin);
    }

    // [UNCHANGED] Admin function, not sponsored
    function revokeHospital(uint256 hospitalId) public onlyOwner {
        if (!hospitals[hospitalId].isVerified) {
            revert HospitalNotVerified();
        }

        hospitals[hospitalId].isVerified = false;
        emit HospitalRevoked(hospitalId);
    }

    // [UNCHANGED] Admin function, not sponsored
    // Allows the contract owner (Super Admin) OR the affiliated Hospital Admin to assign a role.
    function assignRole(address user, Role role, uint256 hospitalId) public {
        // If the sender is not the contract owner (Super Admin), enforce the Hospital Admin checks.
        if (msg.sender != owner()) { 
            if (users[msg.sender].role != Role.HospitalAdmin || !users[msg.sender].isVerified) { revert NotHospitalAdmin(); }
            if (userToHospital[msg.sender] != hospitalId) { revert NotAuthorized(); }
        }

        if (role != Role.Doctor && role != Role.LabTechnician) { revert RoleNotAllowed(); }
        if (users[user].walletAddress == address(0)) { revert UserNotFound(); }
        if (userToHospital[user] != 0) { revert UserAlreadyInHospital(); }

        users[user].role = role;
        users[user].isVerified = true;
        userToHospital[user] = hospitalId;

        // [NEW] Create the on-chain link for the professional
        professionalToHospitalId[user] = hospitalId;

        emit RoleAssigned(user, role, hospitalId);
        emit UserVerified(msg.sender, user);
    }

    // [UNCHANGED] Admin function, not sponsored
    // Allows the contract owner (Super Admin) OR the affiliated Hospital Admin to revoke a role.
    function revokeRole(address user, Role role, uint256 hospitalId) public {
        // If the sender is not the contract owner (Super Admin), enforce the Hospital Admin checks.
        if (msg.sender != owner()) {
            if (users[msg.sender].role != Role.HospitalAdmin || !users[msg.sender].isVerified) { revert NotHospitalAdmin(); }
            if (userToHospital[msg.sender] != hospitalId) { revert NotAuthorized(); }
        }

        if (users[user].walletAddress == address(0)) { revert UserNotFound(); }
        if (userToHospital[user] != hospitalId) { revert UserNotInHospital(); }

        users[user].role = Role.Patient; // Revert to a base role
        users[user].isVerified = false; // Mark as unverified professional
        delete userToHospital[user];

        // [NEW] Delete the on-chain link for the professional
        delete professionalToHospitalId[user];

        emit RoleRevoked(user, role, hospitalId);
    }
}
