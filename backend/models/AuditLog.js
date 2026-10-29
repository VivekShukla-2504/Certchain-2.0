const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema(
  {
    eventKey: { type: String, required: true, unique: true },
    action: { type: String, enum: ["issued", "revoked"], required: true, index: true },
    institutionId: { type: String, required: true, index: true },
    actorUserId: { type: String, required: true },
    certId: { type: String, required: true },
    documentType: { type: String, default: "Other" }
  },
  { timestamps: true }
);

auditLogSchema.index({ institutionId: 1, createdAt: -1 });

module.exports = mongoose.model("AuditLog", auditLogSchema);
