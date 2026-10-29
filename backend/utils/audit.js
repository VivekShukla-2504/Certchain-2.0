const AuditLog = require("../models/AuditLog");

async function recordAuditEvent({ action, institutionId, actorUserId, certId, documentType }) {
  const eventKey = `${action}:${certId}`;
  try {
    await AuditLog.updateOne(
      { eventKey },
      {
        $setOnInsert: {
          eventKey,
          action,
          institutionId,
          actorUserId: String(actorUserId),
          certId,
          documentType: documentType || "Other"
        }
      },
      { upsert: true }
    );
  } catch (error) {
    console.error("Audit event could not be stored:", error.message);
  }
}

module.exports = { recordAuditEvent };
