// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title CertificateRegistry
 * @notice Enterprise Ethereum Sepolia Academic Credential Registry.
 * Anchors SHA-256 / Keccak-256 Document Hashes, Authorized Institutes, Student Wallets, and Decentralized IPFS CIDs.
 * Uses OpenZeppelin AccessControl for role-based administrative and issuance security.
 */
contract CertificateRegistry is AccessControl {
    bytes32 public constant INSTITUTE_ROLE = keccak256("INSTITUTE_ROLE");

    uint256 private constant MAX_CERT_ID_LENGTH = 100;
    uint256 private constant MAX_INSTITUTION_ID_LENGTH = 100;

    struct CertRecord {
        bytes32 certHash;      // Cryptographic SHA-256 commitment of PDF + metadata
        address issuer;        // Public Address of issuing institution (Institute Key)
        address recipient;     // Public Address of student credential owner (Student Key)
        string institutionId;  // Human-readable identifier (e.g. "JNU")
        string ipfsCid;        // Immutable content identifier on decentralized IPFS network
        uint256 issuedAt;      // Block timestamp
        bool revoked;          // Revocation status flag
    }

    // certId => record
    mapping(string => CertRecord) private records;

    // student wallet => list of certIds
    mapping(address => string[]) private studentCertificates;

    // institution wallet => institute ID mapping
    mapping(address => string) public instituteIdentifiers;

    // verification approvals: certId => bool
    mapping(string => bool) public verificationApprovals;
    // certId => employer wallet => approved
    mapping(string => mapping(address => bool)) public employerApprovals;

    // Backward-compatibility mapping view
    mapping(address => bool) public authorizedIssuers;

    // Core Specification Events
    event InstituteRegistered(address indexed institute, string instituteId);
    event InstituteRevoked(address indexed institute);
    event CredentialIssued(
        string indexed certId,
        bytes32 certHash,
        address indexed student,
        address indexed institute,
        uint256 issuedAt
    );
    event CredentialRevoked(string indexed certId, address indexed revoker);
    event VerificationApproved(string indexed certId, address indexed approver, address indexed employer);

    // Backward-compatible Event Aliases
    event CertificateIssued(
        string indexed certId,
        bytes32 certHash,
        address indexed issuer,
        address indexed recipient,
        uint256 issuedAt
    );
    event CertificateRevoked(string indexed certId, address indexed revokedBy);
    event IssuerAuthorized(address indexed issuer, string institutionId);
    event IssuerRevoked(address indexed issuer);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(INSTITUTE_ROLE, msg.sender);
        authorizedIssuers[msg.sender] = true;
        instituteIdentifiers[msg.sender] = "DEPLOYER_PRIMARY";
        emit InstituteRegistered(msg.sender, "DEPLOYER_PRIMARY");
    }

    /* =========================================================================
     * 1. INSTITUTE MANAGEMENT (OpenZeppelin AccessControl)
     * ========================================================================= */

    /**
     * @notice Register and authorize an institute to issue credentials on Sepolia.
     */
    function registerInstitute(address institute, string calldata instituteId)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(institute != address(0), "Institute cannot be zero address");
        require(bytes(instituteId).length > 0, "Institute ID cannot be empty");
        require(bytes(instituteId).length <= MAX_INSTITUTION_ID_LENGTH, "Institute ID too long");

        _grantRole(INSTITUTE_ROLE, institute);
        authorizedIssuers[institute] = true;
        instituteIdentifiers[institute] = instituteId;

        emit InstituteRegistered(institute, instituteId);
        emit IssuerAuthorized(institute, instituteId);
    }

    /**
     * @notice Revoke an institute's credential issuance authority.
     */
    function revokeInstitute(address institute)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(institute != address(0), "Institute cannot be zero address");

        _revokeRole(INSTITUTE_ROLE, institute);
        authorizedIssuers[institute] = false;

        emit InstituteRevoked(institute);
        emit IssuerRevoked(institute);
    }

    /**
     * @notice Check whether a given address is an authorized institution.
     */
    function isAuthorizedInstitute(address institute) external view returns (bool) {
        return hasRole(INSTITUTE_ROLE, institute);
    }

    // Backward-compatible alias
    function authorizeIssuer(address issuer, string calldata institutionId) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(INSTITUTE_ROLE, issuer);
        authorizedIssuers[issuer] = true;
        instituteIdentifiers[issuer] = institutionId;
        emit InstituteRegistered(issuer, institutionId);
        emit IssuerAuthorized(issuer, institutionId);
    }

    // Backward-compatible alias
    function revokeIssuer(address issuer) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _revokeRole(INSTITUTE_ROLE, issuer);
        authorizedIssuers[issuer] = false;
        emit InstituteRevoked(issuer);
        emit IssuerRevoked(issuer);
    }

    /* =========================================================================
     * 2. CREDENTIAL MANAGEMENT (Issuance, Revocation, Verification)
     * ========================================================================= */

    function _issueInternal(
        string memory certId,
        bytes32 certHash,
        string memory institutionId,
        address recipient,
        string memory ipfsCid
    ) internal {
        require(bytes(certId).length > 0, "Certificate ID cannot be empty");
        require(bytes(certId).length <= MAX_CERT_ID_LENGTH, "Certificate ID too long");
        require(bytes(institutionId).length > 0, "Institution ID cannot be empty");
        require(bytes(institutionId).length <= MAX_INSTITUTION_ID_LENGTH, "Institution ID too long");
        require(recipient != address(0), "Recipient address cannot be zero");
        require(records[certId].issuedAt == 0, "Certificate ID already exists");
        require(certHash != bytes32(0), "Hash cannot be empty");

        records[certId] = CertRecord({
            certHash: certHash,
            issuer: msg.sender,
            recipient: recipient,
            institutionId: institutionId,
            ipfsCid: ipfsCid,
            issuedAt: block.timestamp,
            revoked: false
        });

        studentCertificates[recipient].push(certId);

        emit CredentialIssued(certId, certHash, recipient, msg.sender, block.timestamp);
        emit CertificateIssued(certId, certHash, msg.sender, recipient, block.timestamp);
    }

    /**
     * @notice Primary spec entrypoint: issueCredential.
     */
    function issueCredential(
        string calldata certId,
        bytes32 certHash,
        address student,
        string calldata ipfsCid
    ) external onlyRole(INSTITUTE_ROLE) {
        string memory instId = instituteIdentifiers[msg.sender];
        if (bytes(instId).length == 0) {
            instId = "INSTITUTE";
        }
        _issueInternal(certId, certHash, instId, student, ipfsCid);
    }

    /**
     * @notice Binds Institute, Student, Document Hash, and Decentralized IPFS CID.
     */
    function issueCertificateWithIpfs(
        string calldata certId,
        bytes32 certHash,
        string calldata institutionId,
        address recipient,
        string calldata ipfsCid
    ) external onlyRole(INSTITUTE_ROLE) {
        _issueInternal(certId, certHash, institutionId, recipient, ipfsCid);
    }

    function issueCertificateTo(
        string calldata certId,
        bytes32 certHash,
        string calldata institutionId,
        address recipient
    ) external onlyRole(INSTITUTE_ROLE) {
        _issueInternal(certId, certHash, institutionId, recipient, "");
    }

    function issueCertificate(
        string calldata certId,
        bytes32 certHash,
        string calldata institutionId
    ) external onlyRole(INSTITUTE_ROLE) {
        _issueInternal(certId, certHash, institutionId, msg.sender, "");
    }

    /**
     * @notice Revoke a credential. Only the issuing institute or an admin can revoke.
     */
    function revokeCredential(string calldata certId) external {
        CertRecord storage rec = records[certId];
        require(rec.issuedAt != 0, "Certificate does not exist");
        require(
            rec.issuer == msg.sender || hasRole(DEFAULT_ADMIN_ROLE, msg.sender),
            "Not authorized to revoke"
        );
        require(!rec.revoked, "Certificate already revoked");

        rec.revoked = true;
        emit CredentialRevoked(certId, msg.sender);
        emit CertificateRevoked(certId, msg.sender);
    }

    function revokeCertificate(string calldata certId) external {
        CertRecord storage rec = records[certId];
        require(rec.issuedAt != 0, "Certificate does not exist");
        require(
            rec.issuer == msg.sender || hasRole(DEFAULT_ADMIN_ROLE, msg.sender),
            "Not authorized to revoke"
        );
        require(!rec.revoked, "Certificate already revoked");

        rec.revoked = true;
        emit CredentialRevoked(certId, msg.sender);
        emit CertificateRevoked(certId, msg.sender);
    }

    /**
     * @notice Verifies whether a credential hash matches on-chain record and is active.
     */
    function verifyCredential(string calldata certId, bytes32 certHash)
        external
        view
        returns (
            bool isValid,
            address issuer,
            string memory institutionId,
            uint256 issuedAt,
            bool revoked,
            address recipient,
            string memory ipfsCid
        )
    {
        CertRecord memory rec = records[certId];
        bool exists = rec.issuedAt != 0;
        bool matches = exists && rec.certHash == certHash && !rec.revoked;
        return (
            matches,
            rec.issuer,
            rec.institutionId,
            rec.issuedAt,
            rec.revoked,
            rec.recipient,
            rec.ipfsCid
        );
    }

    function verifyCertificate(string calldata certId, bytes32 certHash)
        external
        view
        returns (
            bool isValid,
            address issuer,
            string memory institutionId,
            uint256 issuedAt,
            bool revoked,
            address recipient,
            string memory ipfsCid
        )
    {
        CertRecord memory rec = records[certId];
        bool exists = rec.issuedAt != 0;
        bool matches = exists && rec.certHash == certHash && !rec.revoked;
        return (
            matches,
            rec.issuer,
            rec.institutionId,
            rec.issuedAt,
            rec.revoked,
            rec.recipient,
            rec.ipfsCid
        );
    }

    function getCredential(string calldata certId) external view returns (CertRecord memory) {
        return records[certId];
    }

    function getRecord(string calldata certId) external view returns (CertRecord memory) {
        return records[certId];
    }

    function getStudentCertificates(address student) external view returns (string[] memory) {
        return studentCertificates[student];
    }

    /* =========================================================================
     * 3. EMPLOYER VERIFICATION AUTHORIZATION
     * ========================================================================= */

    function approveVerification(string calldata certId, address employer) external onlyRole(INSTITUTE_ROLE) {
        require(records[certId].issuedAt != 0, "Certificate does not exist");
        verificationApprovals[certId] = true;
        if (employer != address(0)) {
            employerApprovals[certId][employer] = true;
        }
        emit VerificationApproved(certId, msg.sender, employer);
    }

    function isVerificationApproved(string calldata certId, address employer) external view returns (bool) {
        if (verificationApprovals[certId]) return true;
        if (employer != address(0) && employerApprovals[certId][employer]) return true;
        return false;
    }
}
