const { ethers } = require("ethers");
const crypto = require("crypto");

/**
 * Standard Merkle Tree Implementation for Batch Academic Credential Issuance
 * Computes Merkle Root from individual student credential hashes and generates Merkle Proofs.
 */
class SimpleMerkleTree {
  constructor(leaves) {
    this.leaves = leaves.map((leaf) => (leaf.startsWith("0x") ? leaf : "0x" + leaf));
    this.layers = [this.leaves];
    this.buildTree();
  }

  buildTree() {
    let currentLayer = this.leaves;
    while (currentLayer.length > 1) {
      const nextLayer = [];
      for (let i = 0; i < currentLayer.length; i += 2) {
        const left = currentLayer[i];
        const right = i + 1 < currentLayer.length ? currentLayer[i + 1] : left;
        // Sort pairs deterministically
        const combined = left < right
          ? ethers.solidityPackedKeccak256(["bytes32", "bytes32"], [left, right])
          : ethers.solidityPackedKeccak256(["bytes32", "bytes32"], [right, left]);
        nextLayer.push(combined);
      }
      this.layers.push(nextLayer);
      currentLayer = nextLayer;
    }
  }

  getRoot() {
    return this.layers[this.layers.length - 1][0];
  }

  getProof(leafIndex) {
    const proof = [];
    let index = leafIndex;
    for (let i = 0; i < this.layers.length - 1; i++) {
      const layer = this.layers[i];
      const isRightNode = index % 2 === 1;
      const pairIndex = isRightNode ? index - 1 : index + 1;
      if (pairIndex < layer.length) {
        proof.push(layer[pairIndex]);
      } else {
        proof.push(layer[index]);
      }
      index = Math.floor(index / 2);
    }
    return proof;
  }

  static verify(leaf, proof, root) {
    let computedHash = leaf;
    for (const proofElement of proof) {
      if (computedHash < proofElement) {
        computedHash = ethers.solidityPackedKeccak256(["bytes32", "bytes32"], [computedHash, proofElement]);
      } else {
        computedHash = ethers.solidityPackedKeccak256(["bytes32", "bytes32"], [proofElement, computedHash]);
      }
    }
    return computedHash.toLowerCase() === root.toLowerCase();
  }
}

async function main() {
  console.log("\n" + "=".repeat(85));
  console.log("🌳  CERTCHAIN: COHORT BATCH IDENTIFIER & MERKLE TREE COMMITMENT DEMO");
  console.log("=".repeat(85));

  // 1. Cohort Specification
  const institutionId = "JNU-DELHI";
  const department = "Computer Science & Engineering";
  const academicSession = "2022-2026";
  const blockNumber = 12047195;

  // Question 2 Formula:
  // BatchCommitment = keccak256(abi.encodePacked(institutionId, department, academicSession, blockNumber))
  const batchCommitmentHash = ethers.solidityPackedKeccak256(
    ["string", "string", "string", "uint256"],
    [institutionId, department, academicSession, blockNumber]
  );
  const batchNumber = `BATCH-${academicSession.slice(5)}-${department.split(" ").map(w => w[0]).join("")}-${batchCommitmentHash.slice(2, 8).toUpperCase()}`;

  console.log("\n[1] DETERMINISTIC BATCH IDENTIFIER GENERATION (Question 2)");
  console.log(`- Institution Code:     ${institutionId}`);
  console.log(`- Department:           ${department}`);
  console.log(`- Academic Session:     ${academicSession}`);
  console.log(`- Block Anchor:         #${blockNumber}`);
  console.log(`- Formula:              keccak256(abi.encodePacked(institution, dept, session, blockNumber))`);
  console.log(`- Raw Keccak Hash:      ${batchCommitmentHash}`);
  console.log(`- Human-Readable Batch: ${batchNumber}`);

  // 2. Simulated Cohort Credentials (20 Students)
  console.log("\n[2] GENERATING CREDENTIAL COMMITMENTS FOR COHORT");
  const cohortStudents = [
    { name: "Aarav Sharma", roll: "2026-CS-001", grade: "9.4 CGPA" },
    { name: "Priya Patel", roll: "2026-CS-002", grade: "9.2 CGPA" },
    { name: "Vivek Shukla", roll: "2026-CS-003", grade: "9.8 CGPA" },
    { name: "Rohan Verma", roll: "2026-CS-004", grade: "8.9 CGPA" },
    { name: "Sneha Nair", roll: "2026-CS-005", grade: "9.5 CGPA" },
    { name: "Aditya Gupta", roll: "2026-CS-006", grade: "9.1 CGPA" },
    { name: "Ananya Iyer", roll: "2026-CS-007", grade: "9.6 CGPA" },
    { name: "Kunal Mehra", roll: "2026-CS-008", grade: "8.8 CGPA" }
  ];

  const leaves = cohortStudents.map((s) => {
    return ethers.solidityPackedKeccak256(
      ["string", "string", "string", "string"],
      [s.name, s.roll, s.grade, batchNumber]
    );
  });

  console.log(`- Total Students in Batch: ${cohortStudents.length}`);
  console.log(`- Leaf 0 (Aarav):          ${leaves[0]}`);
  console.log(`- Leaf 2 (Vivek):          ${leaves[2]}`);

  // 3. Merkle Tree Construction
  const merkleTree = new SimpleMerkleTree(leaves);
  const merkleRoot = merkleTree.getRoot();

  console.log("\n[3] CRYPTOGRAPHIC MERKLE ROOT COMMITMENT");
  console.log(`- Computed Merkle Root:    ${merkleRoot}`);
  console.log(`- On-Chain Storage Cost:   Only 1 SSTORE slot (32 bytes) for entire batch!`);

  // 4. Verifying a Single Student's Merkle Proof
  const studentIndex = 2; // Vivek Shukla
  const targetStudent = cohortStudents[studentIndex];
  const targetLeaf = leaves[studentIndex];
  const proof = merkleTree.getProof(studentIndex);

  console.log(`\n[4] INDEPENDENT VERIFICATION OF STUDENT: "${targetStudent.name}" (${targetStudent.roll})`);
  console.log(`- Student Leaf Hash:       ${targetLeaf}`);
  console.log(`- Merkle Proof Elements:   ${proof.length} sibling hashes (O(log N) efficiency)`);
  proof.forEach((p, i) => console.log(`    Sibling [${i}]: ${p}`));

  const isValidProof = SimpleMerkleTree.verify(targetLeaf, proof, merkleRoot);
  console.log(`- Merkle Proof Result:     ${isValidProof ? "✅ VERIFIED AUTHENTIC (Belongs to Batch Root)" : "❌ FORGERY DETECTED"}`);

  // 5. Anti-Counterfeiting Check: Modifying 1 Byte
  const tamperedLeaf = ethers.solidityPackedKeccak256(
    ["string", "string", "string", "string"],
    [targetStudent.name, targetStudent.roll, "10.0 CGPA (FORGED)", batchNumber]
  );
  const isTamperedValid = SimpleMerkleTree.verify(tamperedLeaf, proof, merkleRoot);
  console.log(`\n[5] ANTI-TAMPERING COUNTERFEIT TEST: Altering Grade to 10.0 CGPA`);
  console.log(`- Forged Leaf Hash:        ${tamperedLeaf}`);
  console.log(`- Verification Result:     ${isTamperedValid ? "PASSED (Error)" : "🔴 REJECTED (Avalanche Effect Prevents Tampering)"}`);

  // 6. Gas Optimization Metrics
  const individualGas = cohortStudents.length * 120000;
  const batchGas = 45000;
  const gasSavings = (((individualGas - batchGas) / individualGas) * 100).toFixed(2);

  console.log("\n[6] BLOCKCHAIN GAS OPTIMIZATION REPORT");
  console.log(`- Individual Issuance Gas: ${individualGas.toLocaleString()} gas`);
  console.log(`- Merkle Root Batch Gas:   ${batchGas.toLocaleString()} gas`);
  console.log(`- Efficiency Gain:         ${gasSavings}% Gas Saved on Ethereum!`);

  console.log("\n" + "=".repeat(85));
}

main().catch(console.error);
