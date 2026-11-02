const { ethers } = require("ethers");
const fs = require("fs");
const crypto = require("crypto");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", "backend", ".env") });
require("dotenv").config();

const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || "0x8a16Eb15A598DA4ed2E7211FEE12b37407907d90";
const RPC_URL = process.env.SEPOLIA_RPC_URL || process.env.RPC_URL || "https://rpc.sepolia.org";

const CONTRACT_ABI = [
  "function getRecord(string calldata certId) external view returns (tuple(bytes32 certHash, address issuer, address recipient, string institutionId, string ipfsCid, uint256 issuedAt, bool revoked))",
  "function verifyCertificate(string calldata certId, bytes32 certHash) external view returns (bool isValid, address issuer, string memory institutionId, uint256 issuedAt, bool revoked, address recipient, string memory ipfsCid)",
  "function isAuthorizedInstitute(address institute) external view returns (bool)"
];

async function main() {
  const targetCertId = process.argv[2] ? process.argv[2].trim().toUpperCase() : "";
  const optionalPdfPath = process.argv[3];

  console.log("\n" + "=".repeat(80));
  console.log("🔍  CERTCHAIN: DIRECT ETHEREUM SEPOLIA EVM VERIFIER (CLI)");
  console.log("=".repeat(80));

  if (!targetCertId) {
    console.log("Usage: node scripts/verifyOnChainCLI.js <CERT-ID> [optional-path-to-pdf]");
    console.log("Example: node scripts/verifyOnChainCLI.js CERT-DEPLOYER-TEST\n");
    process.exit(0);
  }

  console.log(`Connecting directly to Ethereum Sepolia RPC node: ${RPC_URL}...`);
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);

  console.log(`Executing raw EVM view call \`getRecord("${targetCertId}")\` against contract ${CONTRACT_ADDRESS}...`);
  const record = await contract.getRecord(targetCertId);

  if (record.issuedAt === 0n) {
    console.log(`\n❌ RESULT: Certificate "${targetCertId}" DOES NOT EXIST on Ethereum Sepolia.`);
    console.log("=".repeat(80) + "\n");
    return;
  }

  console.log("\n[ETHEREUM SEPOLIA STATE STORAGE FOUND]");
  console.log(`- Certificate ID:        ${targetCertId}`);
  console.log(`- On-Chain Stored Hash:  ${record.certHash}`);
  console.log(`- Issuing University:    ${record.institutionId} (${record.issuer})`);
  console.log(`- Student Wallet:        ${record.recipient}`);
  console.log(`- Decentralized IPFS:    ${record.ipfsCid || "None"}`);
  console.log(`- Block Timestamp:       ${new Date(Number(record.issuedAt) * 1000).toUTCString()}`);
  console.log(`- Revocation Status:     ${record.revoked ? "🚫 REVOKED ON-CHAIN" : "✅ ACTIVE & VALID"}`);

  // If PDF path was provided, compute its SHA-256 and test against on-chain hash
  if (optionalPdfPath && fs.existsSync(optionalPdfPath)) {
    const fileBytes = fs.readFileSync(optionalPdfPath);
    const computedHash = "0x" + crypto.createHash("sha256").update(fileBytes).digest("hex");
    console.log("\n[DOCUMENT TAMPERING DETECTION]");
    console.log(`- Uploaded PDF:          ${optionalPdfPath}`);
    console.log(`- Computed SHA-256:      ${computedHash}`);
    console.log(`- On-Chain Target Hash:  ${record.certHash}`);

    if (computedHash.toLowerCase() === record.certHash.toLowerCase()) {
      console.log("- Integrity Check:       ✅ 100% MATCH - ZERO TAMPERING DETECTED");
    } else {
      console.log("- Integrity Check:       🔴 TAMPERED - FILE BYTES DO NOT MATCH BLOCKCHAIN HASH");
    }
  }

  console.log("\n" + "=".repeat(80));
  console.log("Proof: Query executed via direct EVM call. Zero database or web servers used.");
  console.log("=".repeat(80) + "\n");
}

main().catch(console.error);
