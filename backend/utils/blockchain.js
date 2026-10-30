const { ethers } = require("ethers");
require("dotenv").config();

// Complete ABI for CertificateRegistry with OpenZeppelin AccessControl
const CONTRACT_ABI = [
  "function registerInstitute(address institute, string calldata instituteId) external",
  "function revokeInstitute(address institute) external",
  "function isAuthorizedInstitute(address institute) external view returns (bool)",
  "function issueCredential(string calldata certId, bytes32 certHash, address student, string calldata ipfsCid) external",
  "function issueCertificateWithIpfs(string certId, bytes32 certHash, string institutionId, address recipient, string ipfsCid) external",
  "function issueCertificateTo(string certId, bytes32 certHash, string institutionId, address recipient) external",
  "function issueCertificate(string certId, bytes32 certHash, string institutionId) external",
  "function revokeCredential(string calldata certId) external",
  "function revokeCertificate(string calldata certId) external",
  "function approveVerification(string calldata certId, address employer) external",
  "function isVerificationApproved(string calldata certId, address employer) external view returns (bool)",
  "function verifyCredential(string calldata certId, bytes32 certHash) external view returns (bool isValid, address issuer, string memory institutionId, uint256 issuedAt, bool revoked, address recipient, string memory ipfsCid)",
  "function verifyCertificate(string calldata certId, bytes32 certHash) external view returns (bool isValid, address issuer, string memory institutionId, uint256 issuedAt, bool revoked, address recipient, string memory ipfsCid)",
  "function getCredential(string calldata certId) external view returns (tuple(bytes32 certHash, address issuer, address recipient, string institutionId, string ipfsCid, uint256 issuedAt, bool revoked))",
  "function getRecord(string calldata certId) external view returns (tuple(bytes32 certHash, address issuer, address recipient, string institutionId, string ipfsCid, uint256 issuedAt, bool revoked))",
  "function getStudentCertificates(address student) external view returns (string[] memory)",
  "event InstituteRegistered(address indexed institute, string instituteId)",
  "event InstituteRevoked(address indexed institute)",
  "event CredentialIssued(string indexed certId, bytes32 certHash, address indexed student, address indexed institute, uint256 issuedAt)",
  "event CredentialRevoked(string indexed certId, address indexed revoker)",
  "event VerificationApproved(string indexed certId, address indexed approver, address indexed employer)"
];

const rpcUrl = process.env.RPC_URL || process.env.SEPOLIA_RPC_URL;
const privateKey = process.env.PRIVATE_KEY;
const contractAddress = process.env.CONTRACT_ADDRESS;

const provider = new ethers.JsonRpcProvider(rpcUrl);
const wallet = new ethers.Wallet(privateKey, provider);
const contract = new ethers.Contract(contractAddress, CONTRACT_ABI, wallet);

/** Converts a hex SHA-256 digest string into a bytes32 value for Solidity */
function toBytes32(hexHash) {
  if (!hexHash) return ethers.ZeroHash;
  const clean = hexHash.startsWith("0x") ? hexHash : "0x" + hexHash;
  return clean.padEnd(66, "0").slice(0, 66);
}

/** Returns the public address of the backend platform signer / institute deployer. */
function getPlatformSignerAddress() {
  return wallet.address;
}

/** Authorizes an institute address in the smart contract via OpenZeppelin AccessControl */
async function registerInstituteOnChain(instituteAddress, instituteId) {
  const tx = await contract.registerInstitute(instituteAddress, instituteId);
  const receipt = await tx.wait();
  return receipt.hash;
}

/** Revokes an institute's issuance rights on Sepolia */
async function revokeInstituteOnChain(instituteAddress) {
  const tx = await contract.revokeInstitute(instituteAddress);
  const receipt = await tx.wait();
  return receipt.hash;
}

/** Checks if an address is an authorized institute */
async function isAuthorizedInstituteOnChain(instituteAddress) {
  try {
    return await contract.isAuthorizedInstitute(instituteAddress);
  } catch {
    return false;
  }
}

/** Submits a new certificate hash, student wallet, and decentralized IPFS CID to the smart contract */
async function issueOnChain(certId, certHashHex, institutionId, studentWallet, ipfsCid) {
  let tx;
  const validStudent = studentWallet && ethers.isAddress(studentWallet) ? studentWallet : wallet.address;
  const validCid = typeof ipfsCid === "string" ? ipfsCid.trim() : "";

  tx = await contract.issueCertificateWithIpfs(
    certId,
    toBytes32(certHashHex),
    institutionId || "INSTITUTE",
    validStudent,
    validCid
  );

  const receipt = await tx.wait();
  return {
    txHash: receipt.hash,
    blockNumber: receipt.blockNumber
  };
}

/** 100% On-Chain Verification: Verifies hash, issuer, recipient, and decentralized IPFS CID */
async function verifyOnChain(certId, certHashHex) {
  const [isValid, issuer, institutionId, issuedAt, revoked, recipient, ipfsCid] = await contract.verifyCertificate(
    certId,
    toBytes32(certHashHex)
  );
  return {
    isValid,
    issuer,
    institutionId,
    issuedAt: Number(issuedAt),
    revoked,
    recipient,
    ipfsCid
  };
}

async function getRecordOnChain(certId) {
  const record = await contract.getRecord(certId);
  return {
    certHash: record.certHash,
    issuer: record.issuer,
    recipient: record.recipient,
    institutionId: record.institutionId,
    ipfsCid: record.ipfsCid,
    issuedAt: Number(record.issuedAt),
    revoked: record.revoked
  };
}

async function getStudentCertificatesOnChain(studentWallet) {
  if (!studentWallet || !ethers.isAddress(studentWallet)) return [];
  const certIds = await contract.getStudentCertificates(studentWallet);
  return Array.from(certIds);
}

async function revokeOnChain(certId) {
  const tx = await contract.revokeCertificate(certId);
  const receipt = await tx.wait();
  return {
    txHash: receipt.hash,
    blockNumber: receipt.blockNumber
  };
}

async function verifyClientTxOnChain(txHash) {
  if (!txHash || typeof txHash !== "string" || !txHash.startsWith("0x")) {
    throw new Error("Invalid transaction hash format");
  }
  const receipt = await provider.waitForTransaction(txHash, 1, 60000);
  if (!receipt || receipt.status !== 1) {
    throw new Error("Transaction was reverted or not confirmed on Sepolia");
  }
  return {
    txHash: receipt.hash,
    blockNumber: receipt.blockNumber,
    from: receipt.from,
    to: receipt.to
  };
}

async function approveVerificationOnChain(certId, employerWallet = ethers.ZeroAddress) {
  const targetEmployer = (employerWallet && ethers.isAddress(employerWallet)) ? employerWallet : ethers.ZeroAddress;
  const tx = await contract.approveVerification(certId, targetEmployer);
  const receipt = await tx.wait();
  return receipt.hash;
}

async function isVerificationApprovedOnChain(certId, employerWallet = ethers.ZeroAddress) {
  try {
    const targetEmployer = (employerWallet && ethers.isAddress(employerWallet)) ? employerWallet : ethers.ZeroAddress;
    return await contract.isVerificationApproved(certId, targetEmployer);
  } catch (err) {
    return false;
  }
}

module.exports = {
  issueOnChain,
  verifyOnChain,
  getRecordOnChain,
  getPlatformSignerAddress,
  revokeOnChain,
  getStudentCertificatesOnChain,
  approveVerificationOnChain,
  isVerificationApprovedOnChain,
  registerInstituteOnChain,
  revokeInstituteOnChain,
  isAuthorizedInstituteOnChain,
  verifyClientTxOnChain
};
