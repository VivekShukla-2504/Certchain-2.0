const express = require("express");
const archiver = require("archiver");
const unzipper = require("unzipper");
const fs = require("fs/promises");
const path = require("path");
const Institution = require("../models/Institution");
const Certificate = require("../models/Certificate");
const AuditLog = require("../models/AuditLog");
const { requireAuth, requireRole } = require("../middleware/auth");
const { getRecordOnChain } = require("../utils/blockchain");
const { hashCertificateData, hashFileBuffer } = require("../utils/hash");
const { receiveBackupZip, isPdfBuffer } = require("../utils/pdfUpload");
const {
  DEFAULT_PUBLIC_CERTIFICATE_FIELDS,
  normalizePublicCertificateFields
} = require("../utils/disclosure");

const router = express.Router();
const UPLOADS_DIR = path.join(__dirname, "..", "uploads", "certificates");
const MAX_BACKUP_BYTES = 100 * 1024 * 1024;
const MAX_ARCHIVE_ENTRIES = 2000;

function expectedCertificateHash(certificate, institutionId) {
  const fields = {
    candidateName: certificate.candidateName,
    rollNumber: certificate.rollNumber,
    course: certificate.course,
    grade: certificate.grade,
    issueDate: certificate.issueDate,
    institutionId
  };
  if (certificate.documentHash) fields.documentHash = certificate.documentHash;
  if (certificate.documentType) fields.documentType = certificate.documentType;
  return hashCertificateData(fields);
}

router.get("/backup", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const certificates = await Certificate.find({ institutionId: req.institution.institutionId }).sort({ createdAt: 1 }).lean();
    const auditEvents = await AuditLog.find({ institutionId: req.institution.institutionId }).sort({ createdAt: 1 }).lean();
    if (certificates.length > 1000) return res.status(413).json({ message: "Archive export is limited to 1,000 certificates" });

    const files = [];
    let fileBytes = 0;
    const missingPdfs = [];
    for (const certificate of certificates) {
      if (!certificate.documentHash) continue;
      const filePath = path.join(UPLOADS_DIR, `${certificate.certId}.pdf`);
      try {
        const stat = await fs.stat(filePath);
        fileBytes += stat.size;
        if (stat.size > 10 * 1024 * 1024 || fileBytes > MAX_BACKUP_BYTES) {
          return res.status(413).json({ message: "PDF archive exceeds the 100 MB backup limit" });
        }
        files.push({ filePath, name: `certificates/${certificate.certId}.pdf` });
      } catch {
        missingPdfs.push(certificate.certId);
      }
    }

    const archive = archiver("zip", { zlib: { level: 6 } });
    archive.on("error", (error) => {
      if (!res.headersSent) res.status(500).json({ message: "Backup archive could not be created" });
      else res.destroy(error);
    });
    res.attachment(`certchain-${req.institution.institutionId}-backup.zip`);
    archive.pipe(res);
    archive.append(JSON.stringify({
      version: 1,
      institutionId: req.institution.institutionId,
      exportedAt: new Date().toISOString(),
      certificates,
      auditEvents,
      missingPdfs
    }, null, 2), { name: "metadata.json" });
    for (const file of files) archive.file(file.filePath, { name: file.name });
    await archive.finalize();
  } catch (error) {
    res.status(500).json({ message: "Institution backup unavailable" });
  }
});

router.post("/backup/restore", requireAuth, requireRole("admin"), receiveBackupZip, async (req, res) => {
  if (!req.file || req.file.buffer.subarray(0, 2).toString("ascii") !== "PK") {
    return res.status(400).json({ message: "Upload a valid CertChain ZIP backup" });
  }
  try {
    const directory = await unzipper.Open.buffer(req.file.buffer);
    if (directory.files.length > MAX_ARCHIVE_ENTRIES) {
      return res.status(413).json({ message: "Backup contains too many files" });
    }
    let totalBytes = 0;
    let metadata;
    const pdfBuffers = new Map();
    for (const entry of directory.files) {
      if (entry.type === "Directory") continue;
      if (entry.path !== "metadata.json" && !/^certificates\/CERT-[A-F0-9]{8,32}\.pdf$/.test(entry.path)) {
        return res.status(400).json({ message: "Backup contains an unsupported file path" });
      }
      const sizeLimit = entry.path === "metadata.json" ? 5 * 1024 * 1024 : 10 * 1024 * 1024;
      if (entry.uncompressedSize > sizeLimit) return res.status(413).json({ message: "Backup contains an oversized file" });
      totalBytes += entry.uncompressedSize;
      if (totalBytes > MAX_BACKUP_BYTES) return res.status(413).json({ message: "Expanded backup exceeds 100 MB" });
      const buffer = await entry.buffer();
      if (entry.path === "metadata.json") metadata = JSON.parse(buffer.toString("utf8"));
      else pdfBuffers.set(path.basename(entry.path, ".pdf"), buffer);
    }
    if (metadata?.version !== 1 || !Array.isArray(metadata.certificates)) {
      return res.status(400).json({ message: "Backup manifest format is not supported" });
    }
    if (metadata.institutionId !== req.institution.institutionId) {
      return res.status(403).json({ message: "This backup belongs to a different institution" });
    }

    const restored = [];
    let skipped = 0;
    let conflicts = 0;
    for (const backupCertificate of metadata.certificates) {
      const certId = backupCertificate.certId;
      if (typeof certId !== "string" || !/^CERT-[A-F0-9]{8,32}$/.test(certId)) {
        skipped += 1;
        continue;
      }
      const existing = await Certificate.findOne({ certId, institutionId: req.institution.institutionId }).lean();
      if (existing) {
        if (existing.certHash === backupCertificate.certHash) skipped += 1;
        else conflicts += 1;
        continue;
      }

      const pdfBuffer = pdfBuffers.get(certId);
      if (backupCertificate.documentHash && (!pdfBuffer || !isPdfBuffer(pdfBuffer) || hashFileBuffer(pdfBuffer) !== backupCertificate.documentHash)) {
        skipped += 1;
        continue;
      }
      if (expectedCertificateHash(backupCertificate, req.institution.institutionId) !== backupCertificate.certHash) {
        skipped += 1;
        continue;
      }

      const onChain = await getRecordOnChain(certId);
      if (!onChain.issuedAt || onChain.certHash.toLowerCase() !== `0x${backupCertificate.certHash}`.toLowerCase()) {
        skipped += 1;
        continue;
      }
      const document = {
        certId,
        candidateName: backupCertificate.candidateName,
        rollNumber: backupCertificate.rollNumber,
        course: backupCertificate.course,
        grade: backupCertificate.grade,
        issueDate: backupCertificate.issueDate,
        documentType: backupCertificate.documentType,
        institutionId: req.institution.institutionId,
        issuerWallet: backupCertificate.issuerWallet || onChain.issuer,
        certHash: backupCertificate.certHash,
        documentHash: backupCertificate.documentHash,
        txHash: backupCertificate.txHash,
        status: "confirmed",
        revoked: onChain.revoked,
        idempotencyKey: backupCertificate.idempotencyKey
      };
      try {
        await Certificate.create(document);
        if (pdfBuffer) {
          await fs.mkdir(UPLOADS_DIR, { recursive: true });
          await fs.writeFile(path.join(UPLOADS_DIR, `${certId}.pdf`), pdfBuffer);
        }
        restored.push(certId);
      } catch (error) {
        conflicts += 1;
      }
    }

    let restoredAuditEvents = 0;
    for (const event of Array.isArray(metadata.auditEvents) ? metadata.auditEvents : []) {
      if (!['issued', 'revoked'].includes(event.action) || typeof event.certId !== "string") continue;
      const hasCertificate = await Certificate.exists({ certId: event.certId, institutionId: req.institution.institutionId });
      if (!hasCertificate) continue;
      const eventKey = `${event.action}:${event.certId}`;
      const result = await AuditLog.updateOne(
        { eventKey, institutionId: req.institution.institutionId },
        { $setOnInsert: {
          eventKey,
          action: event.action,
          institutionId: req.institution.institutionId,
          actorUserId: String(event.actorUserId || req.institution.id),
          certId: event.certId,
          documentType: event.documentType || "Other",
          createdAt: event.createdAt || new Date()
        } },
        { upsert: true }
      );
      if (result.upsertedCount) restoredAuditEvents += 1;
    }

    res.json({ restored: restored.length, restoredAuditEvents, skipped, conflicts, restoredCertIds: restored });
  } catch (error) {
    res.status(400).json({ message: "Backup archive could not be restored" });
  }
});

router.get("/settings", requireAuth, async (req, res) => {
  try {
    const institution = await Institution.findOne({ institutionId: req.institution.institutionId })
      .select("publicVerificationFields")
      .lean();
    if (!institution) return res.status(404).json({ message: "Institution not found" });
    res.json({ publicVerificationFields: institution.publicVerificationFields || DEFAULT_PUBLIC_CERTIFICATE_FIELDS });
  } catch (err) {
    res.status(500).json({ message: "Institution settings unavailable" });
  }
});

router.patch("/settings", requireAuth, requireRole("admin"), async (req, res) => {
  const publicVerificationFields = normalizePublicCertificateFields(req.body.publicVerificationFields);
  if (!publicVerificationFields) {
    return res.status(400).json({ message: "Choose which certificate fields may appear publicly" });
  }
  try {
    const institution = await Institution.findOneAndUpdate(
      { institutionId: req.institution.institutionId },
      { $set: { publicVerificationFields } },
      { new: true, runValidators: true }
    ).select("publicVerificationFields");
    if (!institution) return res.status(404).json({ message: "Institution not found" });
    res.json({ publicVerificationFields: institution.publicVerificationFields });
  } catch (err) {
    res.status(500).json({ message: "Institution settings could not be saved" });
  }
});

module.exports = router;
