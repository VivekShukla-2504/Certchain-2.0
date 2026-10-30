const mongoose = require("mongoose");

const certificateSchema = new mongoose.Schema(
  {
    certId: { type: String, required: true, unique: true },
    candidateName: { type: String, required: true },
    rollNumber: { type: String, required: true },
    course: { type: String, required: true },
    grade: { type: String, required: true },
    issueDate: { type: Date, required: true },
    documentType: { type: String, enum: ["Degree", "Marksheet", "Transcript", "Diploma", "Other"] },
    institutionId: { type: String, required: true },
    issuerWallet: { type: String, required: true },
    studentWallet: { type: String }, // Student's public key / Ethereum address
    studentEmail: { type: String },  // Student's email for automated certificate dispatch
    department: { type: String },
    academicSession: { type: String },
    certHash: { type: String, required: true }, // SHA-256 hex digest
    documentHash: { type: String }, // SHA-256 hash of the uploaded PDF
    generatedPdf: { type: Boolean, default: false },
    ipfsCid: { type: String },
    ipfsIv: { type: String },
    ipfsAuthTag: { type: String },
    ipfsEncryptionVersion: { type: Number },
    txHash: { type: String }, // blockchain transaction hash, available after submission
    blockNumber: { type: Number },
    status: { type: String, enum: ["pending", "submitted", "confirmed", "failed", "ACTIVE", "REVOKED", "active", "revoked"], default: "pending", index: true },
    idempotencyKey: { type: String, unique: true, sparse: true, index: true },
    revoked: { type: Boolean, default: false },
    revocationTxHash: { type: String },
    revokedAt: { type: Date },
    revocationReason: { type: String }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Certificate", certificateSchema);
