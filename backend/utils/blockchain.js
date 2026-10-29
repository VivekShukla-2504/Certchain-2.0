const { ethers } = require("ethers");
require("dotenv").config();

// Complete ABI for 100% Immutable 3-Stakeholder & Decentralized IPFS Smart Contract
const CONTRACT_ABI = [
  "function issueCertificateWithIpfs(string certId, bytes32 certHash, string institutionId, address recipient, string ipfsCid) external",
  "function issueCertificateTo(string certId, bytes32 certHash, string institutionId, address recipient) external",
  "function issueCertificate(string certId, bytes32 certHash, string institutionId) external",
  "function revokeCertificate(string certId) external",
  "function approveVerification(string certId, address employer) external",
  "function isVerificationApproved(string certId, address employer) external view returns (bool)",
  "function verifyCertificate(string certId, bytes32 certHash) external view returns (bool isValid, address issuer, string memory institutionId, uint256 issuedAt, bool revoked, address recipient, string memory ipfsCid)",
  "function getStudentCertificates(address student) external view returns (string[] memory)",
  "function getRecord(string certId) external view returns (tuple(bytes32 certHash, address issuer, address recipient, string institutionId, string ipfsCid, uint256 issuedAt, bool revoked))",
  "event CertificateIssued(string indexed certId, bytes32 certHash, address indexed issuer, address indexed recipient, uint256 issuedAt)"
];

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS, CONTRACT_ABI, wallet);

/** Converts a hex SHA-256 digest string into a bytes32 value for Solidity */
function toBytes32(hexHash) {
  return "0x" + hexHash;
}

/** Returns the public address of the backend-controlled platform signer. */
function getPlatformSignerAddress() {
  return wallet.address;
}

/** Submits a new certificate hash, student wallet, and decentralized IPFS CID to the smart contract */
async function issueOnChain(certId, certHashHex, institutionId, studentWallet, ipfsCid) {
  let tx;
  const validStudent = studentWallet && ethers.isAddress(studentWallet);
  const validCid = typeof ipfsCid === "string" ? ipfsCid.trim() : "";

  if (validStudent && validCid) {
    tx = await contract.issueCertificateWithIpfs(certId, toBytes32(certHashHex), institutionId, studentWallet, validCid);
  } else if (validStudent) {
    tx = await contract.issueCertificateTo(certId, toBytes32(certHashHex), institutionId, studentWallet);
  } else {
    tx = await contract.issueCertificate(certId, toBytes32(certHashHex), institutionId);
  }
  const receipt = await tx.wait();
  return receipt.hash; // transaction hash
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
  return receipt.hash;
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
  isVerificationApprovedOnChain
};
