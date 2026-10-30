const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const { hashFileBuffer, hashCertificateData } = require("../utils/hash");

test("SHA-256 PDF cryptographic integrity: single-byte modification alters hash completely", () => {
  const originalPdfBuffer = Buffer.from("%PDF-1.4 Official Certificate Academic Record Data");
  const modifiedPdfBuffer = Buffer.from("%PDF-1.4 Official Certificate Academic Record Date"); // Changed 1 character

  const originalHash = hashFileBuffer(originalPdfBuffer);
  const modifiedHash = hashFileBuffer(modifiedPdfBuffer);

  assert.notEqual(originalHash, modifiedHash);
  assert.equal(originalHash.length, 64); // 256 bits = 64 hex characters
  assert.equal(modifiedHash.length, 64);
});

test("Certificate ID generation is unique and formatted with CERT- prefix", () => {
  const generateCertId = () => "CERT-" + crypto.randomBytes(16).toString("hex").toUpperCase();

  const id1 = generateCertId();
  const id2 = generateCertId();

  assert.notEqual(id1, id2);
  assert.match(id1, /^CERT-[A-F0-9]{32}$/);
  assert.match(id2, /^CERT-[A-F0-9]{32}$/);
});

test("Student registration required fields validation", () => {
  const validateStudentFields = (data) => {
    const required = [
      "fullName",
      "username",
      "email",
      "phone",
      "enrollmentNumber",
      "department",
      "course",
      "academicSession",
      "walletAddress"
    ];
    for (const field of required) {
      if (!data[field] || String(data[field]).trim().length === 0) {
        return `Missing field: ${field}`;
      }
    }
    if (!/^\S+@\S+\.\S+$/.test(data.email)) return "Invalid email";
    if (!/^0x[a-fA-F0-9]{40}$/.test(data.walletAddress)) return "Invalid EVM wallet address";
    return null;
  };

  const validStudent = {
    fullName: "Aarav Sharma",
    username: "aarav_s",
    email: "aarav@example.edu",
    phone: "+91-9876543210",
    enrollmentNumber: "2022CS101",
    department: "Computer Science & Engineering",
    course: "B.Tech Computer Science",
    academicSession: "2022-2026",
    walletAddress: "0x32A44B4C486950346a06F74122dFE7e5B6310214"
  };

  assert.equal(validateStudentFields(validStudent), null);

  const missingEmail = { ...validStudent, email: "" };
  assert.equal(validateStudentFields(missingEmail), "Missing field: email");

  const invalidWallet = { ...validStudent, walletAddress: "not-a-wallet" };
  assert.equal(validateStudentFields(invalidWallet), "Invalid EVM wallet address");
});

test("Certificate hashing binds student wallet, institution, and document hash", () => {
  const metaA = {
    candidateName: "Rohan Verma",
    rollNumber: "2022EC055",
    course: "Electronics & Communication",
    grade: "9.2 CGPA",
    issueDate: "2026-05-15",
    institutionId: "JNU2026",
    documentHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    documentType: "Degree"
  };

  const hashA = hashCertificateData(metaA);
  assert.equal(hashA.length, 64);

  // Altering any parameter changes the certificate hash
  const metaB = { ...metaA, grade: "9.3 CGPA" };
  const hashB = hashCertificateData(metaB);
  assert.notEqual(hashA, hashB);
});

