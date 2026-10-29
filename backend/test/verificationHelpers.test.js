const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const { hashCertificateData, hashFileBuffer } = require("../utils/hash");
const { isPdfBuffer } = require("../utils/pdfUpload");
const { normalizePublicCertificateFields } = require("../utils/disclosure");
const { generateCertificatePdf } = require("../utils/certificatePdf");
const { signPreparedCertificate, verifyPreparedCertificate } = require("../utils/preparedCertificate");

process.env.JWT_SECRET = "test-preparation-secret";

const certificate = {
  candidateName: "Asha Rao",
  rollNumber: "R-22",
  course: "BSc Computer Science",
  grade: "A",
  issueDate: "2026-01-02",
  institutionId: "JNU"
};

test("legacy certificate hashes retain their original field shape", () => {
  const payload = JSON.stringify({
    ...certificate,
    issueDate: new Date(certificate.issueDate).toISOString()
  });
  const expected = crypto.createHash("sha256").update(payload).digest("hex");
  assert.equal(hashCertificateData(certificate), expected);
});

test("PDF and printed metadata are bound into a stable commitment", () => {
  const pdfHash = hashFileBuffer(Buffer.from("%PDF-1.7 original"));
  const issued = hashCertificateData({ ...certificate, documentType: "Degree", documentHash: pdfHash });
  assert.equal(issued, hashCertificateData({ ...certificate, documentType: "Degree", documentHash: pdfHash }));
  assert.notEqual(issued, hashCertificateData({ ...certificate, documentType: "Degree", documentHash: hashFileBuffer(Buffer.from("%PDF-1.7 altered")) }));
  assert.notEqual(issued, hashCertificateData({ ...certificate, documentType: "Degree", documentHash: pdfHash, grade: "B" }));
});

test("PDF validator checks the file signature", () => {
  assert.equal(isPdfBuffer(Buffer.from("%PDF-1.7 content")), true);
  assert.equal(isPdfBuffer(Buffer.from("not a PDF")), false);
  assert.equal(isPdfBuffer(null), false);
});

test("public disclosure settings only retain supported unique fields", () => {
  assert.deepEqual(
    normalizePublicCertificateFields(["candidateName", "grade", "grade", "password"]),
    ["candidateName", "grade"]
  );
  assert.deepEqual(normalizePublicCertificateFields([]), []);
  assert.equal(normalizePublicCertificateFields("grade"), null);
});

test("prepared certificate tokens bind institution and metadata and expire", () => {
  const fields = { ...certificate, documentType: "Degree" };
  const claims = { certId: `CERT-${"A".repeat(32)}`, institutionId: "JNU", fields };
  const prepared = signPreparedCertificate(claims);
  assert.equal(verifyPreparedCertificate({ ...claims, token: prepared.token, expiresAt: prepared.expiresAt }), true);
  assert.equal(verifyPreparedCertificate({ ...claims, fields: { ...fields, grade: "B" }, token: prepared.token, expiresAt: prepared.expiresAt }), false);
  assert.equal(verifyPreparedCertificate({ ...claims, token: prepared.token, expiresAt: Date.now() - 1 }), false);
});

test("official certificate renderer emits a PDF document", async () => {
  const pdf = await generateCertificatePdf({
    ...certificate,
    documentType: "Degree",
    certId: `CERT-${"B".repeat(32)}`,
    institutionName: "Example University",
    verifyUrl: "http://localhost:3000/verify/CERT-EXAMPLE"
  });
  assert.equal(pdf.subarray(0, 5).toString("ascii"), "%PDF-");
});