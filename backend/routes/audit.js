const express = require("express");
const AuditLog = require("../models/AuditLog");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

function auditFilter(req, res) {
  const filter = { institutionId: req.institution.institutionId };
  if (["issued", "revoked"].includes(req.query.action)) filter.action = req.query.action;
  const createdAt = {};
  for (const key of ["from", "to"]) {
    if (!req.query[key]) continue;
    const date = new Date(req.query[key]);
    if (Number.isNaN(date.getTime())) {
      res.status(400).json({ message: `Invalid ${key} date` });
      return null;
    }
    if (key === "to" && /^\d{4}-\d{2}-\d{2}$/.test(req.query[key])) date.setUTCHours(23, 59, 59, 999);
    createdAt[key === "from" ? "$gte" : "$lte"] = date;
  }
  if (Object.keys(createdAt).length) filter.createdAt = createdAt;
  return filter;
}

function csvField(value) {
  const safe = String(value ?? "").replace(/^[=+\-@]/, "'$&");
  return `"${safe.replace(/"/g, '""')}"`;
}

router.get("/export", requireAuth, async (req, res) => {
  const filter = auditFilter(req, res);
  if (!filter) return;
  try {
    const entries = await AuditLog.find(filter).sort({ createdAt: -1 }).limit(10001).lean();
    if (entries.length > 10000) return res.status(413).json({ message: "Narrow the date range to export at most 10,000 events" });
    const rows = [
      ["Timestamp", "Action", "Certificate ID", "Document type"],
      ...entries.map((entry) => [entry.createdAt?.toISOString(), entry.action, entry.certId, entry.documentType || "Other"])
    ];
    const csv = rows.map((row) => row.map(csvField).join(",")).join("\r\n");
    res.type("text/csv").set("Content-Disposition", "attachment; filename=certchain-audit.csv").send(csv);
  } catch (error) {
    res.status(500).json({ message: "Audit export unavailable" });
  }
});

router.get("/", requireAuth, async (req, res) => {
  try {
    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 25, 1), 100);
    const filter = auditFilter(req, res);
    if (!filter) return;

    const [entries, total] = await Promise.all([
      AuditLog.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      AuditLog.countDocuments(filter)
    ]);
    res.json({ entries, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (error) {
    res.status(500).json({ message: "Audit history unavailable" });
  }
});

module.exports = router;
