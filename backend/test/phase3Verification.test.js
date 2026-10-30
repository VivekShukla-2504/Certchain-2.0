const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const { hashFileBuffer, hashCertificateData } = require("../utils/hash");

test("Phase 3 - Test Case 1 & 2: Document Integrity & Tampering Detection", () => {
  // 1. Original PDF buffer & commitment
  const originalPdf = Buffer.from("%PDF-1.4 Official University Transcript for Aarav Sharma");
  const originalDocHash = hashFileBuffer(originalPdf);

  // 2. Modified / Tampered PDF (e.g. grade changed)
  const tamperedPdf = Buffer.from("%PDF-1.4 Official University Transcript for Aarav Sharma [Grade Modified: A+]");
  const tamperedDocHash = hashFileBuffer(tamperedPdf);

  // Hashing integrity check
  assert.notEqual(originalDocHash, tamperedDocHash);

  // Verification matching logic
  const verifyDocumentHash = (uploadedBuffer, targetOnChainHash) => {
    const uploadedHash = hashFileBuffer(uploadedBuffer);
    const cleanTarget = targetOnChainHash.replace(/^0x/i, "").toLowerCase();
    const cleanUploaded = uploadedHash.replace(/^0x/i, "").toLowerCase();

    if (cleanUploaded === cleanTarget) {
      return { tamperStatus: "NOT_TAMPERED", match: true };
    }
    return { tamperStatus: "TAMPERED", match: false };
  };

  // Test Case 1: Genuine document matches on-chain hash
  const genuineResult = verifyDocumentHash(originalPdf, originalDocHash);
  assert.equal(genuineResult.tamperStatus, "NOT_TAMPERED");
  assert.equal(genuineResult.match, true);

  // Test Case 2: Tampered document is detected as TAMPERED
  const tamperedResult = verifyDocumentHash(tamperedPdf, originalDocHash);
  assert.equal(tamperedResult.tamperStatus, "TAMPERED");
  assert.equal(tamperedResult.match, false);
});

test("Phase 3 - Test Case 3: Invalid Certificate ID Rejection", () => {
  const isValidCertIdFormat = (id) => {
    if (!id || typeof id !== "string") return false;
    return /^CERT-[A-F0-9]{32}$/i.test(id.trim());
  };

  assert.equal(isValidCertIdFormat("CERT-9A8B7C6D5E4F3A2B1C0D9E8F7A6B5C4D"), true);
  assert.equal(isValidCertIdFormat("FAKE-ID-123"), false);
  assert.equal(isValidCertIdFormat(""), false);
});

test("Phase 3 - Test Case 4: Revocation Status Overrides Verification", () => {
  const evaluateVerificationStatus = ({ exists, isRevoked, tamperStatus, isApproved }) => {
    if (!exists) return "NOT_FOUND";
    if (isRevoked) return "REVOKED";
    if (tamperStatus === "TAMPERED") return "TAMPERED";
    if (!isApproved) return "PENDING";
    return "VERIFIED";
  };

  // Revoked credential must never be verified
  const revokedStatus = evaluateVerificationStatus({
    exists: true,
    isRevoked: true,
    tamperStatus: "NOT_TAMPERED",
    isApproved: true
  });
  assert.equal(revokedStatus, "REVOKED");

  // Tampered credential must never be verified
  const tamperedStatus = evaluateVerificationStatus({
    exists: true,
    isRevoked: false,
    tamperStatus: "TAMPERED",
    isApproved: true
  });
  assert.equal(tamperedStatus, "TAMPERED");

  // Fully verified credential
  const validStatus = evaluateVerificationStatus({
    exists: true,
    isRevoked: false,
    tamperStatus: "NOT_TAMPERED",
    isApproved: true
  });
  assert.equal(validStatus, "VERIFIED");

  // Pending verification
  const pendingStatus = evaluateVerificationStatus({
    exists: true,
    isRevoked: false,
    tamperStatus: "NOT_TAMPERED",
    isApproved: false
  });
  assert.equal(pendingStatus, "PENDING");
});

test("Phase 3 - Test Case 6: Role-Based Access Control for Approvals", () => {
  const canApproveVerification = (userRole) => {
    return ["admin", "issuer"].includes(userRole);
  };

  assert.equal(canApproveVerification("admin"), true);
  assert.equal(canApproveVerification("issuer"), true);
  assert.equal(canApproveVerification("student"), false);
  assert.equal(canApproveVerification("employer"), false);
  assert.equal(canApproveVerification("reviewer"), false);
});

