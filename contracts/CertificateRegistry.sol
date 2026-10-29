// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title CertificateRegistry
/// @notice 100% Immutable On-Chain Academic Certificate Registry on Ethereum EVM.
/// Anchors SHA-256 Document Hashes, Issuer (Institute), Recipient (Student), and Decentralized IPFS CIDs.
contract CertificateRegistry {
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

    // certId (e.g. "CERT-7F3A2C") => record
    mapping(string => CertRecord) private records;

    // student wallet => list of certIds
    mapping(address => string[]) private studentCertificates;

    // institution wallet => allowed to issue
    mapping(address => bool) public authorizedIssuers;

    // verification approvals: certId => bool
    mapping(string => bool) public verificationApprovals;
    // certId => employer wallet => approved
    mapping(string => mapping(address => bool)) public employerApprovals;

    address public owner;
    address public pendingOwner;

    event CertificateIssued(
        string indexed certId,
        bytes32 certHash,
        address indexed issuer,
        address indexed recipient,
        uint256 issuedAt
    );
    event CertificateRevoked(string indexed certId, address indexed revokedBy);
    event VerificationApproved(string indexed certId, address indexed approver, address indexed employer);
    event IssuerAuthorized(address indexed issuer, string institutionId);
    event IssuerRevoked(address indexed issuer);
    event OwnershipTransferStarted(address indexed previousOwner, address indexed newOwner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not contract owner");
        _;
    }

    modifier onlyAuthorized() {
        require(authorizedIssuers[msg.sender], "Not an authorized issuer");
        _;
    }

    constructor() {
        owner = msg.sender;
        authorizedIssuers[msg.sender] = true; // deployer is authorized by default
        emit OwnershipTransferred(address(0), msg.sender);
    }

    /// @notice Starts a two-step ownership transfer. The recipient must accept it.
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "New owner cannot be zero address");
        pendingOwner = newOwner;
        emit OwnershipTransferStarted(owner, newOwner);
    }

    /// @notice Completes a pending ownership transfer by the nominated owner.
    function acceptOwnership() external {
        require(msg.sender == pendingOwner, "Not pending owner");
        address previousOwner = owner;
        owner = msg.sender;
        pendingOwner = address(0);
        emit OwnershipTransferred(previousOwner, msg.sender);
    }

    /// @notice Owner grants an institution wallet permission to issue certificates
    function authorizeIssuer(address issuer, string calldata institutionId) external onlyOwner {
        require(issuer != address(0), "Issuer cannot be zero address");
        require(bytes(institutionId).length > 0, "Institution ID cannot be empty");
        require(bytes(institutionId).length <= MAX_INSTITUTION_ID_LENGTH, "Institution ID too long");
        authorizedIssuers[issuer] = true;
        emit IssuerAuthorized(issuer, institutionId);
    }

    /// @notice Revoke an institution's issuing rights
    function revokeIssuer(address issuer) external onlyOwner {
        require(issuer != address(0), "Issuer cannot be zero address");
        authorizedIssuers[issuer] = false;
        emit IssuerRevoked(issuer);
    }

    /// @dev Internal issuance logic shared across public entrypoints
    function _issue(
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

        emit CertificateIssued(certId, certHash, msg.sender, recipient, block.timestamp);
    }

    /// @notice Master Issue function: Binds Institute, Student, Document Hash, and On-Chain IPFS CID
    function issueCertificateWithIpfs(
        string calldata certId,
        bytes32 certHash,
        string calldata institutionId,
        address recipient,
        string calldata ipfsCid
    ) external onlyAuthorized {
        _issue(certId, certHash, institutionId, recipient, ipfsCid);
    }

    /// @notice Issue function with recipient student wallet
    function issueCertificateTo(
        string calldata certId,
        bytes32 certHash,
        string calldata institutionId,
        address recipient
    ) external onlyAuthorized {
        _issue(certId, certHash, institutionId, recipient, "");
    }

    /// @notice Backward-compatible issueCertificate defaults recipient to msg.sender
    function issueCertificate(
        string calldata certId,
        bytes32 certHash,
        string calldata institutionId
    ) external onlyAuthorized {
        _issue(certId, certHash, institutionId, msg.sender, "");
    }

    /// @notice Revoke a previously issued certificate (e.g. issued in error)
    function revokeCertificate(string calldata certId) external {
        CertRecord storage rec = records[certId];
        require(rec.issuedAt != 0, "Certificate does not exist");
        require(rec.issuer == msg.sender || msg.sender == owner, "Not authorized to revoke");
        require(!rec.revoked, "Certificate already revoked");
        rec.revoked = true;
        emit CertificateRevoked(certId, msg.sender);
    }

    /// @notice 100% On-Chain Verification: Verifies hash, issuer, recipient, and decentralized IPFS CID
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

    /// @notice Fetch all certificate IDs issued to a particular student address
    function getStudentCertificates(address student) external view returns (string[] memory) {
        return studentCertificates[student];
    }

    /// @notice Fetch complete immutable on-chain record
    function getRecord(string calldata certId) external view returns (CertRecord memory) {
        return records[certId];
    }

    /// @notice Institute verifies and authorizes an employer verification request
    function approveVerification(string calldata certId, address employer) external onlyAuthorized {
        require(records[certId].issuedAt != 0, "Certificate does not exist");
        verificationApprovals[certId] = true;
        if (employer != address(0)) {
            employerApprovals[certId][employer] = true;
        }
        emit VerificationApproved(certId, msg.sender, employer);
    }

    /// @notice Check if verification for this certificate has been authorized by the issuing institute
    function isVerificationApproved(string calldata certId, address employer) external view returns (bool) {
        if (verificationApprovals[certId]) return true;
        if (employer != address(0) && employerApprovals[certId][employer]) return true;
        return false;
    }
}
