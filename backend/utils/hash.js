const crypto = require("crypto");

/**
 * Computes a SHA-256 hash of certificate data.
 * The same field order/format MUST be used at issuance and at verification
 * time, otherwise a legitimate certificate will fail to match.
 */
function hashCertificateData({ candidateName, rollNumber, course, grade, issueDate, institutionId, documentHash, documentType }) {
  const payload = JSON.stringify({
    candidateName,
    rollNumber,
    course,
    grade,
    issueDate: new Date(issueDate).toISOString(),
    institutionId,
    ...(documentHash ? { documentHash } : {}),
    ...(documentType ? { documentType } : {})
  });
  return crypto.createHash("sha256").update(payload).digest("hex");
}

/** Hashes an arbitrary file buffer (e.g. an uploaded certificate PDF) */
function hashFileBuffer(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

module.exports = { hashCertificateData, hashFileBuffer };
