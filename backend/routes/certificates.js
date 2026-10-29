const express = require("express");
const crypto = require("crypto");
const { ethers } = require("ethers");
const fs = require("fs/promises");
const path = require("path");
const QRCode = require("qrcode");
const Certificate = require("../models/Certificate");
const Institution = require("../models/Institution");
const { requireAuth, requireRole } = require("../middleware/auth");
const { hashCertificateData, hashFileBuffer } = require("../utils/hash");
const { issueOnChain, getRecordOnChain, getPlatformSignerAddress, revokeOnChain } = require("../utils/blockchain");
const { sendCertificateIssuedEmail } = require("../utils/mailer");
const { receivePdf, isPdfBuffer } = require("../utils/pdfUpload");
const { recordAuditEvent } = require("../utils/audit");
const { generateCertificatePdf } = require("../utils/certificatePdf");
const { signPreparedCertificate, verifyPreparedCertificate } = require("../utils/preparedCertificate");
const {
  isIPFSEnabled,
  encryptForIPFS,
  decryptFromIPFS,
  uploadToIPFS,
  downloadFromIPFS
} = require("../utils/ipfs");
const { validateCertificateInput } = require("../utils/validation");

const router = express.Router();

function generateCertId() {
  return "CERT-" + crypto.randomBytes(16).toString("hex").toUpperCase();
}

function certificatePdfPath(certId) {
  return path.join(__dirname, "..", "uploads", "certificates", `${certId}.pdf`);
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function responseForCertificate(certificate) {
  const frontendUrl = process.env.FRONTEND_URL;
  if (!frontendUrl) throw new Error("FRONTEND_URL is required to generate certificate verification URLs");
  const verifyUrl = `${frontendUrl.replace(/\/$/, "")}/verify/${certificate.certId}`;
  return QRCode.toDataURL(verifyUrl).then((qrDataUrl) => ({
    message: certificate.status === "confirmed" ? "Certificate issued" : "Certificate issuance is being reconciled",
    certificate,
    qrDataUrl,
    verifyUrl
  }));
}

router.post("/prepare", requireAuth, requireRole("admin", "issuer"), async (req, res) => {
  try {
    const validationError = validateCertificateInput(req.body);
    if (validationError) return res.status(400).json({ message: validationError });
    const allowedDocumentTypes = ["Degree", "Marksheet", "Transcript", "Diploma", "Other"];
    const documentType = typeof req.body.documentType === "string" ? req.body.documentType.trim() : "Degree";
    if (!allowedDocumentTypes.includes(documentType)) return res.status(400).json({ message: "Choose a valid document type" });
    const normalized = {
      candidateName: req.body.candidateName.trim(),
      rollNumber: req.body.rollNumber.trim(),
      course: req.body.course.trim(),
      grade: req.body.grade.trim(),
      issueDate: req.body.issueDate.trim(),
      documentType
    };
    const certId = generateCertId();
    const frontendUrl = process.env.FRONTEND_URL;
    if (!frontendUrl) return res.status(500).json({ message: "Certificate verification URL is not configured" });
    const verifyUrl = `${frontendUrl.replace(/\/$/, "")}/verify/${certId}`;
    const institution = await Institution.findOne({ institutionId: req.institution.institutionId }).select("name").lean();
    if (!institution) return res.status(404).json({ message: "Institution not found" });
    const pdf = await generateCertificatePdf({
      ...normalized,
      certId,
      institutionId: req.institution.institutionId,
      institutionName: institution.name,
      verifyUrl
    });
    const preparation = signPreparedCertificate({ certId, institutionId: req.institution.institutionId, fields: normalized });
    res.json({ certId, verifyUrl, pdfBase64: pdf.toString("base64"), ...preparation });
  } catch (error) {
    res.status(500).json({ message: "Certificate PDF could not be prepared" });
  }
});

router.post("/issue", requireAuth, requireRole("admin", "issuer"), receivePdf, async (req, res) => {
  let certificate;
  let chainConfirmed = false;
  try {
    if (!req.file || !isPdfBuffer(req.file.buffer)) {
      return res.status(400).json({ message: "Upload a valid PDF certificate" });
    }
    const { candidateName, rollNumber, course, grade, issueDate, studentWallet, studentEmail } = req.body;
    const resolvedStudentWallet = (typeof studentWallet === "string" && studentWallet.trim().startsWith("0x"))
      ? studentWallet.trim()
      : ethers.Wallet.createRandom().address;
    const resolvedStudentEmail = typeof studentEmail === "string" ? studentEmail.trim().toLowerCase() : "";
    const allowedDocumentTypes = ["Degree", "Marksheet", "Transcript", "Diploma", "Other"];
    const documentType = typeof req.body.documentType === "string" ? req.body.documentType.trim() : "Other";
    if (!allowedDocumentTypes.includes(documentType)) {
      return res.status(400).json({ message: "Choose a valid document type" });
    }
    const validationError = validateCertificateInput(req.body);
    if (validationError) return res.status(400).json({ message: validationError });

    const normalized = { candidateName: candidateName.trim(), rollNumber: rollNumber.trim(), course: course.trim(), grade: grade.trim(), issueDate: issueDate.trim() };
    const institutionId = req.institution.institutionId;
    const preparedCertId = typeof req.body.preparedCertId === "string" ? req.body.preparedCertId : "";
    const preparedToken = typeof req.body.preparedToken === "string" ? req.body.preparedToken : "";
    const preparedExpiresAt = Number(req.body.preparedExpiresAt);
    if (preparedCertId || preparedToken) {
      const validPreparation = /^CERT-[A-F0-9]{32}$/.test(preparedCertId) && verifyPreparedCertificate({
        certId: preparedCertId,
        institutionId,
        fields: { ...normalized, documentType },
        token: preparedToken,
        expiresAt: preparedExpiresAt
      });
      if (!validPreparation) return res.status(400).json({ message: "Generated certificate preview expired or no longer matches these details" });
    }
    const documentHash = hashFileBuffer(req.file.buffer);
    let ipfsCid;
    let ipfsEncryption;
    if (isIPFSEnabled()) {
      try {
        ipfsEncryption = encryptForIPFS(req.file.buffer);
        ipfsCid = await uploadToIPFS(ipfsEncryption.encryptedBuffer);
      } catch (error) {
        console.error(`[${req.requestId || "no-request-id"}] Encrypted IPFS upload failed: ${error.message}`);
        return res.status(503).json({ message: "Encrypted IPFS upload failed; check the IPFS service and encryption key configuration" });
      }
    }
    const certHash = hashCertificateData({
      ...normalized,
      institutionId,
      documentHash,
      documentType
    });

    const requestedKey = req.get("Idempotency-Key") || req.body.idempotencyKey;
    const idempotencyKey = typeof requestedKey === "string" && requestedKey.trim()
      ? requestedKey.trim().slice(0, 128)
      : crypto.createHash("sha256").update(JSON.stringify({ institutionId, normalized, documentHash, documentType })).digest("hex");
    if (preparedCertId) {
      const existingPrepared = await Certificate.findOne({ certId: preparedCertId }).lean();
      if (existingPrepared && existingPrepared.idempotencyKey !== idempotencyKey) {
        return res.status(409).json({ message: "This generated certificate ID has already been used" });
      }
    }
    certificate = await Certificate.findOneAndUpdate(
      { idempotencyKey },
      {
        $setOnInsert: {
          certId: preparedCertId || generateCertId(),
          ...normalized,
          documentType,
          institutionId,
          // The institution wallet is identity metadata only. The platform
          // wallet is the actual transaction signer for staging/Sepolia.
          issuerWallet: getPlatformSignerAddress(),
          studentWallet: resolvedStudentWallet,
          studentEmail: resolvedStudentEmail,
          certHash,
          documentHash,
          generatedPdf: Boolean(preparedCertId),
          idempotencyKey,
          status: "pending"
        },
        ...(ipfsCid ? {
          $set: {
            ipfsCid,
            ipfsIv: ipfsEncryption.iv,
            ipfsAuthTag: ipfsEncryption.authTag,
            ipfsEncryptionVersion: ipfsEncryption.encryptionVersion
          }
        } : {})
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    if (certificate.institutionId !== institutionId || certificate.certHash !== certHash || certificate.documentHash !== documentHash || certificate.documentType !== documentType || (preparedCertId && certificate.certId !== preparedCertId)) {
      return res.status(409).json({ message: "Idempotency key is already associated with another certificate" });
    }

    const pdfPath = certificatePdfPath(certificate.certId);
    await fs.mkdir(path.dirname(pdfPath), { recursive: true });
    await fs.writeFile(pdfPath, req.file.buffer);

    if (certificate.status === "confirmed") {
      return res.status(200).json(await responseForCertificate(certificate));
    }

    if (["pending", "submitted", "failed"].includes(certificate.status)) {
      const onChain = await getRecordOnChain(certificate.certId);
      if (onChain.issuedAt > 0) {
        if (onChain.certHash.toLowerCase() !== `0x${certHash}`.toLowerCase()) {
          return res.status(409).json({ message: "On-chain certificate does not match this request" });
        }
        certificate.status = "confirmed";
        certificate.revoked = onChain.revoked;
        await certificate.save();

    // Automated dispatch of Certificate ID & PDF to Student's Email
    if (certificate.studentEmail) {
      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
      const verifyUrl = `${frontendUrl.replace(/\/$/, "")}/verify/${certificate.certId}`;
      sendCertificateIssuedEmail({
        studentEmail: certificate.studentEmail,
        candidateName: certificate.candidateName,
        certId: certificate.certId,
        course: certificate.course,
        grade: certificate.grade,
        institutionId,
        verifyUrl,
        pdfBuffer: req.file.buffer
      }).catch((emailErr) => console.error("Email dispatch error:", emailErr.message));
    }
        await recordAuditEvent({
          action: "issued",
          institutionId,
          actorUserId: req.institution.id,
          certId: certificate.certId,
          documentType: certificate.documentType
        });
        return res.status(200).json(await responseForCertificate(certificate));
      }
      if (certificate.status === "submitted") {
        return res.status(202).json({ message: "Certificate issuance is still being reconciled", certificate });
      }
    }

    const claimed = await Certificate.findOneAndUpdate(
      { _id: certificate._id, status: { $in: ["pending", "failed"] } },
      { $set: { status: "submitted" } },
      { new: true }
    );
    if (!claimed) {
      return res.status(202).json({ message: "Certificate issuance is already in progress", certificate });
    }
    certificate = claimed;

    // Write the hash to the blockchain - this is the step that makes it tamper-evident
    const txHash = await issueOnChain(certificate.certId, certHash, institutionId, certificate.studentWallet, certificate.ipfsCid);
    chainConfirmed = true;
    certificate.txHash = txHash;
    certificate.status = "confirmed";
    await certificate.save();

    // Automated dispatch of Certificate ID & PDF to Student's Email
    if (certificate.studentEmail) {
      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
      const verifyUrl = `${frontendUrl.replace(/\/$/, "")}/verify/${certificate.certId}`;
      sendCertificateIssuedEmail({
        studentEmail: certificate.studentEmail,
        candidateName: certificate.candidateName,
        certId: certificate.certId,
        course: certificate.course,
        grade: certificate.grade,
        institutionId,
        verifyUrl,
        pdfBuffer: req.file.buffer
      }).catch((emailErr) => console.error("Email dispatch error:", emailErr.message));
    }
    await recordAuditEvent({
      action: "issued",
      institutionId,
      actorUserId: req.institution.id,
      certId: certificate.certId,
      documentType: certificate.documentType
    });
    res.status(201).json(await responseForCertificate(certificate));
  } catch (err) {
    if (certificate && !chainConfirmed) {
      await Certificate.updateOne({ _id: certificate._id }, { $set: { status: "failed" } }).catch(() => {});
    }
    console.error(`[${req.requestId || "no-request-id"}] Certificate issuance failed: ${err.message}`);
    res.status(500).json({ message: "Issuance failed", requestId: req.requestId });
  }
});

// GET /api/certificates/:certId/document - download the institution's private source PDF
router.get("/:certId/document", requireAuth, async (req, res) => {
  try {
    const certificate = await Certificate.findOne({
      certId: req.params.certId,
      institutionId: req.institution.institutionId
    });
    if (!certificate || !certificate.documentHash) {
      return res.status(404).json({ message: "Certificate PDF not found" });
    }
    let pdf;
    try {
      pdf = await fs.readFile(certificatePdfPath(certificate.certId));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      if (!certificate.ipfsCid || !certificate.ipfsIv || !certificate.ipfsAuthTag || !certificate.ipfsEncryptionVersion) {
        return res.status(404).json({ message: "Certificate PDF not found" });
      }
      const encryptedPdf = await downloadFromIPFS(certificate.ipfsCid);
      pdf = decryptFromIPFS(encryptedPdf, {
        iv: certificate.ipfsIv,
        authTag: certificate.ipfsAuthTag,
        encryptionVersion: certificate.ipfsEncryptionVersion
      });
      if (hashFileBuffer(pdf) !== certificate.documentHash) {
        return res.status(500).json({ message: "Recovered PDF does not match its stored integrity hash" });
      }
    }
    return res.type("application/pdf").attachment(`${certificate.certId}.pdf`).send(pdf);
  } catch (err) {
    return res.status(500).json({ message: "Certificate PDF unavailable" });
  }
});

// GET /api/certificates - dashboard data for the authenticated institution
router.get("/", requireAuth, async (req, res) => {
  try {
    const filter = { institutionId: req.institution.institutionId };
    const isListRequest = req.query.view === "list";
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    const status = req.query.status === "revoked" || req.query.status === "active" ? req.query.status : "all";
    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || (isListRequest ? 20 : 10), 1), 100);

    if (search) {
      const expression = new RegExp(escapeRegex(search), "i");
      filter.$or = [{ certId: expression }, { candidateName: expression }, { course: expression }];
    }
    if (status === "revoked") filter.revoked = true;
    if (status === "active") filter.revoked = { $ne: true };

    const [certificates, total, revoked] = await Promise.all([
      Certificate.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Certificate.countDocuments({ institutionId: req.institution.institutionId }),
      Certificate.countDocuments({ institutionId: req.institution.institutionId, revoked: true })
    ]);

    const matching = await Certificate.countDocuments(filter);

    res.json({
      stats: {
        total,
        verified: total - revoked,
        revoked,
        pending: null
      },
      certificates,
      pendingAvailable: false,
      pagination: {
        page,
        limit,
        total: matching,
        pages: Math.ceil(matching / limit)
      }
    });
  } catch (err) {
    res.status(500).json({ message: "Dashboard data unavailable" });
  }
});

// GET /api/certificates/students - group an institution's credentials by student
router.get("/students", requireAuth, async (req, res) => {
  try {
    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 25, 1), 100);
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    const match = { institutionId: req.institution.institutionId };
    if (search) {
      const expression = new RegExp(escapeRegex(search), "i");
      match.$or = [{ candidateName: expression }, { rollNumber: expression }, { course: expression }];
    }

    const [result] = await Certificate.aggregate([
      { $match: match },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: { $toUpper: { $trim: { input: { $ifNull: ["$rollNumber", ""] } } } },
          candidateName: { $first: "$candidateName" },
          rollNumber: { $first: "$rollNumber" },
          documents: {
            $push: {
              certId: "$certId",
              documentType: { $ifNull: ["$documentType", "Other"] },
              course: "$course",
              issueDate: "$issueDate",
              revoked: "$revoked"
            }
          }
        }
      },
      { $sort: { candidateName: 1, rollNumber: 1 } },
      {
        $facet: {
          students: [{ $skip: (page - 1) * limit }, { $limit: limit }],
          total: [{ $count: "count" }]
        }
      }
    ]);
    const students = result?.students || [];
    const total = result?.total?.[0]?.count || 0;
    res.json({ students, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (err) {
    res.status(500).json({ message: "Student records unavailable" });
  }
});

// GET /api/certificates/:certId - fetch stored metadata (for the issuing dashboard)
router.get("/:certId", requireAuth, async (req, res) => {
  try {
    const cert = await Certificate.findOne({
      certId: req.params.certId,
      institutionId: req.institution.institutionId
    });
    if (!cert) return res.status(404).json({ message: "Certificate not found" });
    res.json(cert);
  } catch (err) {
    res.status(500).json({ message: "Certificate details unavailable" });
  }
});

// POST /api/certificates/:certId/revoke
router.post("/:certId/revoke", requireAuth, requireRole("admin", "issuer"), async (req, res) => {
  try {
    const cert = await Certificate.findOne({
      certId: req.params.certId,
      institutionId: req.institution.institutionId
    });
    if (!cert) return res.status(404).json({ message: "Certificate not found" });
    await revokeOnChain(cert.certId);
    cert.revoked = true;
    await cert.save();
    await recordAuditEvent({
      action: "revoked",
      institutionId: req.institution.institutionId,
      actorUserId: req.institution.id,
      certId: cert.certId,
      documentType: cert.documentType
    });
    res.json({ message: "Certificate revoked" });
  } catch (err) {
    res.status(500).json({ message: "Revocation failed" });
  }
});



// GET /api/certificates/student/:identifier - Query certificates by student wallet OR Roll Number OR Email (DigiLocker Pattern)
router.get("/student/:identifier", async (req, res) => {
  try {
    const { identifier } = req.params;
    const cleanId = identifier.trim();

    let filter = { status: "confirmed" };
    if (cleanId.startsWith("0x")) {
      filter.studentWallet = { $regex: new RegExp(`^${cleanId}$`, "i") };
    } else {
      filter.$or = [
        { rollNumber: { $regex: new RegExp(`^${cleanId}$`, "i") } },
        { studentEmail: { $regex: new RegExp(`^${cleanId}$`, "i") } },
        { studentWallet: { $regex: new RegExp(`^${cleanId}$`, "i") } }
      ];
    }

    const certificates = await Certificate.find(filter).sort({ createdAt: -1 }).lean();
    res.json({ certificates });
  } catch (error) {
    res.status(500).json({ message: "Could not fetch student certificates" });
  }
});

module.exports = router;
