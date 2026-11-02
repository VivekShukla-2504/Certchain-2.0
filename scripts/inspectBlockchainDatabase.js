const { ethers } = require("ethers");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", "backend", ".env") });
require("dotenv").config();

const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || "0x8a16Eb15A598DA4ed2E7211FEE12b37407907d90";
const RPC_URL = process.env.SEPOLIA_RPC_URL || process.env.RPC_URL || "https://rpc.sepolia.org";

const CONTRACT_ABI = [
  "function isAuthorizedInstitute(address institute) external view returns (bool)",
  "function instituteIdentifiers(address institute) external view returns (string)",
  "function getRecord(string calldata certId) external view returns (tuple(bytes32 certHash, address issuer, address recipient, string institutionId, string ipfsCid, uint256 issuedAt, bool revoked))",
  "function getStudentCertificates(address student) external view returns (string[] memory)",
  "function hasRole(bytes32 role, address account) external view returns (bool)",
  "event CredentialIssued(string indexed certId, bytes32 certHash, address indexed student, address indexed institute, uint256 issuedAt)",
  "event InstituteRegistered(address indexed institute, string instituteId)"
];

async function main() {
  console.log("\n" + "=".repeat(80));
  console.log("⛓️   CERTCHAIN: ETHEREUM SEPOLIA BLOCKCHAIN DATABASE INSPECTOR");
  console.log("=".repeat(80));

  console.log(`Connecting to EVM Node at: ${RPC_URL}...`);
  const provider = new ethers.JsonRpcProvider(RPC_URL);

  const blockNumber = await provider.getBlockNumber();
  const feeData = await provider.getFeeData();
  const network = await provider.getNetwork();

  console.log("\n[1] BLOCKCHAIN NETWORK & CONSENSUS SPECIFICATIONS");
  console.log(`- Network Name:         ${network.name} (Chain ID: ${network.chainId.toString()})`);
  console.log(`- Consensus Protocol:   Proof-of-Stake (PoS) / Gasper Finality`);
  console.log(`- Current Block Height: #${blockNumber.toLocaleString()}`);
  console.log(`- Gas Price:            ${feeData.gasPrice ? ethers.formatUnits(feeData.gasPrice, "gwei") + " Gwei" : "N/A"}`);

  console.log("\n[2] SMART CONTRACT STATE STORAGE (ON-CHAIN DATABASE)");
  console.log(`- Contract Address:     ${CONTRACT_ADDRESS}`);
  console.log(`- Etherscan URL:        https://sepolia.etherscan.io/address/${CONTRACT_ADDRESS}`);

  const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);

  const deployerAddress = "0x8A8edFB602AA8D7479160bC42815B6271d4B70B3";
  const isAuth = await contract.isAuthorizedInstitute(deployerAddress);
  const identifier = await contract.instituteIdentifiers(deployerAddress);

  console.log(`- Primary Deployer:     ${deployerAddress}`);
  console.log(`- Registered Identifier: ${identifier || "DEPLOYER_PRIMARY"}`);
  console.log(`- AccessControl Auth:   ${isAuth ? "✓ AUTHORIZED (INSTITUTE_ROLE Active)" : "REVOKED"}`);

  // Inspect specific certificate if passed in command line arguments
  const queryCertId = process.argv[2];
  if (queryCertId) {
    console.log(`\n[3] QUERYING ON-CHAIN RECORD FOR CERTIFICATE ID: ${queryCertId}`);
    try {
      const record = await contract.getRecord(queryCertId);
      if (record.issuedAt === 0n) {
        console.log(`❌ Certificate "${queryCertId}" not found in smart contract storage.`);
      } else {
        console.log("✓ Record located inside contract mapping `records[certId]`:");
        console.log(`  - SHA-256 Digest:     ${record.certHash}`);
        console.log(`  - Issuing Institute:  ${record.issuer}`);
        console.log(`  - Student Recipient:  ${record.recipient}`);
        console.log(`  - Institution Code:   ${record.institutionId}`);
        console.log(`  - Decentralized IPFS: ${record.ipfsCid || "None"}`);
        console.log(`  - Block Timestamp:    ${new Date(Number(record.issuedAt) * 1000).toUTCString()}`);
        console.log(`  - Status:             ${record.revoked ? "🚫 REVOKED" : "✅ ACTIVE & AUTHENTIC"}`);
      }
    } catch (err) {
      console.log(`Query error: ${err.message}`);
    }
  } else {
    console.log("\n[3] QUERYING RECENT CREDENTIAL ISSUANCE EVENTS FROM EVM LOGS");
    try {
      // Query recent 10 blocks (Alchemy free tier compliant)
      const filter = contract.filters.CredentialIssued();
      const fromBlock = Math.max(0, blockNumber - 9);
      const events = await contract.queryFilter(filter, fromBlock, blockNumber);
      console.log(`- Polled latest 10 blocks [${fromBlock} -> ${blockNumber}]`);
      console.log(`- Real-time on-chain CredentialIssued events detected: ${events.length}`);
      if (events.length > 0) {
        const latest = events[events.length - 1];
        console.log(`- Latest Issued Cert ID: ${latest.args[0]}`);
        console.log(`- Tx Hash:               ${latest.transactionHash}`);
        console.log(`- Block Number:          #${latest.blockNumber}`);
      }
    } catch (err) {
      console.log(`Event query note: ${err.message}`);
    }
    console.log("\nTip: Run `node scripts/inspectBlockchainDatabase.js <CERT-ID>` to query any specific credential directly from EVM storage!");
  }

  console.log("\n" + "=".repeat(80));
  console.log("Conclusion: Ethereum Sepolia contract state is the authoritative database.");
  console.log("No MongoDB or SQL server was contacted during this inspection.");
  console.log("=".repeat(80) + "\n");
}

main().catch((err) => {
  console.error("Database inspection failed:", err);
  process.exit(1);
});
