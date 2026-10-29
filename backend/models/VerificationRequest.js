const mongoose = require("mongoose");

const verificationRequestSchema = new mongoose.Schema({
  requestId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  certId: {
    type: String,
    required: true,
    index: true
  },
  institutionId: {
    type: String,
    required: true,
    index: true
  },
  candidateName: {
    type: String,
    default: ""
  },
  course: {
    type: String,
    default: ""
  },
  studentWallet: {
    type: String,
    default: ""
  },
  employerName: {
    type: String,
    default: "Prospective Employer"
  },
  employerEmail: {
    type: String,
    default: ""
  },
  employerWallet: {
    type: String,
    default: ""
  },
  status: {
    type: String,
    enum: ["pending", "approved", "rejected"],
    default: "pending",
    index: true
  },
  requestedAt: {
    type: Date,
    default: Date.now
  },
  approvedAt: {
    type: Date
  },
  approvedBy: {
    type: String,
    default: ""
  },
  txHash: {
    type: String,
    default: ""
  }
}, { timestamps: true });

module.exports = mongoose.model("VerificationRequest", verificationRequestSchema);

