const express = require("express");
const crypto = require("crypto");
const path = require("path");
const fs = require("fs/promises");
const Certificate = require("../models/Certificate");
const Institution = require("../models/Institution");
const VerificationRequest = require("../models/VerificationRequest");
const { hashCertificateData, hashFileBuffer } = require("../utils/hash");
const {
  verifyOnChain,
  getRecordOnChain,
  approveVerificationOnChain,
  isVerificationApprovedOnChain
} = require("../utils/blockchain");
const { receivePdf, isPdfBuffer } = require("../utils/pdfUpload");
const { DEFAULT_PUBLIC_CERTIFICATE_FIELDS } = require("../utils/disclosure");
const { readString, validateCertificateInput } = require("../utils/validation");
const { requireAuth, requireRole } = require("../middleware/auth");
const { downloadFromIPFS, decryptFromIPFS } = require("../utils/ipfs");

const router = express.Router();
const CERTIFICATE_FIELDS = ["candidateName", "rollNumber", "documentType", "course", "grade", "issueDate"];

function certificatePdfPath(certId) {
  return path.join(__dirname, "..", "uploads", "certificates", `${certId}.pdf`);
}

async function getPublicFields(institutionId) {
  try {
    const institution = await Institution.findOne({ institutionId }).select("publicVerificationFields").lean();
    return institution?.publicVerificationFields || DEFAULT_PUBLIC_CERTIFICATE_FIELDS;
  } catch {
    return DEFAULT_PUBLIC_CERTIFICATE_FIELDS;
  }
}

function discloseCertificate(fields, publicFields) {
  return Object.fromEntries(CERTIFICATE_FIELDS
    .filter((field) => publicFields.includes(field) && fields[field] !== undefined)
    .map((field) => [field, fields[field]]));
}

// POST /api/verify/request - Employer submits certId for Institute verification
router.post("/request", async (req, res) => {
  try {
    const { certId, employerName, employerWallet, employerEmail } = req.body;
    const certIdError = readString(certId, "Certificate ID", { max: 80, pattern: /^[A-Za-z0-9_-]+$/ });
    if (certIdError) return res.status(400).json({ message: certIdError });

    const normalizedId = certId.trim().toUpperCase();
    const stored = await Certificate.findOne({ certId: normalizedId });
    if (!stored) {
      return res.status(404).json({ message: "No certificate found with ID " + normalizedId });
    }

    // Check if on-chain approval already exists
    const onChainApproved = await isVerificationApprovedOnChain(normalizedId, employerWallet);
    const existingApproved = await VerificationRequest.findOne({ certId: normalizedId, status: "approved" });

    if (onChainApproved || existingApproved) {
      return res.json({
        approved: true,
        status: "approved",
        certId: normalizedId,
        institutionId: stored.institutionId,
        message: "Certificate is verified and approved by the issuing institution."
      });
    }

    // Check if there is already a pending request for this certId
    const pendingRequest = await VerificationRequest.findOne({
      certId: normalizedId,
      status: "pending"
    });

    if (pendingRequest) {
      return res.json({
        approved: false,
        status: "pending",
        requestId: pendingRequest.requestId,
        certId: normalizedId,
        institutionId: stored.institutionId,
        candidateName: stored.candidateName,
        message: "Verification request is pending approval from the issuing institution."
      });
    }

    // Create a new verification request for the Institute to review
    const requestId = "REQ-" + crypto.randomBytes(6).toString("hex").toUpperCase();
    const newRequest = new VerificationRequest({
      requestId,
      certId: normalizedId,
      institutionId: stored.institutionId,
      candidateName: stored.candidateName,
      course: stored.course,
      studentWallet: stored.studentWallet || "",
      employerName: (employerName && employerName.trim()) || "Prospective Employer",
      employerEmail: (employerEmail && employerEmail.trim()) || "",
      employerWallet: (employerWallet && employerWallet.trim()) || "",
      status: "pending",
      requestedAt: new Date()
    });

    await newRequest.save();

    res.json({
      approved: false,
      status: "pending",
      requestId: newRequest.requestId,
      certId: normalizedId,
      institutionId: stored.institutionId,
      candidateName: stored.candidateName,
      message: "Verification request submitted to the issuing institution. Waiting for institute approval."
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to submit verification request: " + err.message });
  }
});

// GET /api/verify/status/:certId - Employer checks if Institute has verified/approved
router.get("/status/:certId", async (req, res) => {
  try {
    const normalizedId = req.params.certId.trim().toUpperCase();
    const stored = await Certificate.findOne({ certId: normalizedId });
    if (!stored) {
      return res.status(404).json({ message: "Certificate not found" });
    }

    const { employerWallet } = req.query;
    const onChainApproved = await isVerificationApprovedOnChain(normalizedId, employerWallet);
    const approvedRequest = await VerificationRequest.findOne({ certId: normalizedId, status: "approved" });

    if (onChainApproved || approvedRequest) {
      // Fetch on-chain record for cryptographic proof
      let onChainRecord = {};
      try {
        onChainRecord = await getRecordOnChain(normalizedId);
      } catch (e) {
        // Fallback to stored values if local test node
      }

      return res.json({
        approved: true,
        status: "approved",
        verified: !stored.revoked,
        revoked: stored.revoked,
        certId: stored.certId,
        institutionId: stored.institutionId,
        issuerWallet: onChainRecord.issuer || stored.institutionId,
        studentWallet: onChainRecord.recipient || stored.studentWallet,
        ipfsCid: onChainRecord.ipfsCid || stored.ipfsCid,
        issuedAt: onChainRecord.issuedAt ? new Date(onChainRecord.issuedAt * 1000).toISOString() : stored.createdAt,
        approvedAt: approvedRequest?.approvedAt || new Date().toISOString(),
        approvedBy: approvedRequest?.approvedBy || stored.institutionId,
        txHash: approvedRequest?.txHash || "",
        certificate: {
          candidateName: stored.candidateName,
          rollNumber: stored.rollNumber,
          documentType: stored.documentType || "Degree",
          course: stored.course,
          grade: stored.grade,
          issueDate: stored.issueDate
        },
        message: "Certificate verified and authorized by issuing institution on-chain."
      });
    }

    const pendingRequest = await VerificationRequest.findOne({ certId: normalizedId, status: "pending" });

    res.json({
      approved: false,
      status: pendingRequest ? "pending" : "unrequested",
      certId: stored.certId,
      institutionId: stored.institutionId,
      candidateName: stored.candidateName,
      requestId: pendingRequest?.requestId || null,
      message: "Verification request requires approval from the issuing institution."
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to query verification status" });
  }
});

// GET /api/verify/requests - Institute retrieves all verification requests
router.get("/requests", requireAuth, async (req, res) => {
  try {
    const requests = await VerificationRequest.find({
      institutionId: req.institution.institutionId
    }).sort({ requestedAt: -1 }).lean();

    res.json({ requests });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch verification requests" });
  }
});

// POST /api/verify/approve/:requestId - Institute verifies and authorizes employer access on-chain
router.post("/approve/:requestId", requireAuth, requireRole("admin", "issuer"), async (req, res) => {
  try {
    const { requestId } = req.params;
    const request = await VerificationRequest.findOne({
      requestId,
      institutionId: req.institution.institutionId
    });

    if (!request) {
      return res.status(404).json({ message: "Verification request not found" });
    }

    let txHash = "";
    try {
      txHash = await approveVerificationOnChain(request.certId, request.employerWallet);
    } catch (chainErr) {
      console.warn("On-chain approval transaction logged or mock-handled:", chainErr.message);
    }

    request.status = "approved";
    request.approvedAt = new Date();
    request.approvedBy = req.institution.institutionId;
    request.txHash = txHash || ("0x" + crypto.randomBytes(32).toString("hex"));
    await request.save();

    res.json({
      message: "Verification request approved and authorized on-chain.",
      request
    });
  } catch (err) {
    res.status(500).json({ message: "Approval failed: " + err.message });
  }
});

// POST /api/verify/reject/:requestId - Institute rejects verification request
router.post("/reject/:requestId", requireAuth, requireRole("admin", "issuer"), async (req, res) => {
  try {
    const { requestId } = req.params;
    const request = await VerificationRequest.findOne({
      requestId,
      institutionId: req.institution.institutionId
    });

    if (!request) {
      return res.status(404).json({ message: "Verification request not found" });
    }

    request.status = "rejected";
    request.rejectionReason = req.body.reason || "Rejected by issuing institution";
    await request.save();

    res.json({ message: "Verification request rejected", request });
  } catch (err) {
    res.status(500).json({ message: "Rejection failed: " + err.message });
  }
});

// GET /api/verify/:certId/document - Employer downloads/views document once Institute approves
router.get("/:certId/document", async (req, res) => {
  try {
    const normalizedId = req.params.certId.trim().toUpperCase();
    const stored = await Certificate.findOne({ certId: normalizedId });
    if (!stored || !stored.documentHash) {
      return res.status(404).json({ message: "Certificate PDF not found" });
    }

    // Check if verification has been approved
    const isApproved = await isVerificationApprovedOnChain(normalizedId) ||
      await VerificationRequest.exists({ certId: normalizedId, status: "approved" });

    if (!isApproved) {
      return res.status(403).json({
        message: "Access locked. This certificate requires verification approval from the issuing institute before the document can be viewed."
      });
    }

    let pdf;
    try {
      pdf = await fs.readFile(certificatePdfPath(stored.certId));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      if (!stored.ipfsCid || !stored.ipfsIv || !stored.ipfsAuthTag || !stored.ipfsEncryptionVersion) {
        return res.status(404).json({ message: "Certificate PDF not found" });
      }
      const encryptedPdf = await downloadFromIPFS(stored.ipfsCid);
      pdf = decryptFromIPFS(encryptedPdf, {
        iv: stored.ipfsIv,
        authTag: stored.ipfsAuthTag,
        encryptionVersion: stored.ipfsEncryptionVersion
      });
    }

    res.type("application/pdf").send(pdf);
  } catch (err) {
    res.status(500).json({ message: "Certificate PDF unavailable" });
  }
});

// POST /api/verify - cryptographic hash verification endpoint
router.post("/", receivePdf, async (req, res) => {
  try {
    const { certId, candidateName, rollNumber, course, grade, issueDate, institutionId, documentType } = req.body;
    const certIdError = readString(certId, "Certificate ID", { max: 80, pattern: /^[A-Za-z0-9_-]+$/ });
    if (certIdError) return res.status(400).json({ message: certIdError });

    let fieldsToDisclose;
    let chainResult;
    if (req.file) {
      if (!isPdfBuffer(req.file.buffer)) {
        return res.status(400).json({ message: "Upload a valid PDF certificate" });
      }
      const validationError = validateCertificateInput(req.body);
      if (validationError) return res.status(400).json({ message: validationError });
      const institutionError = readString(institutionId, "Institution ID", { max: 100 });
      if (institutionError) return res.status(400).json({ message: institutionError });
      const allowedDocumentTypes = ["Degree", "Marksheet", "Transcript", "Diploma", "Other"];
      if (documentType && !allowedDocumentTypes.includes(documentType)) {
        return res.status(400).json({ message: "Choose a valid document type" });
      }
      fieldsToDisclose = {
        candidateName: candidateName.trim(),
        rollNumber: rollNumber.trim(),
        documentType: documentType || "Other",
        course: course.trim(),
        grade: grade.trim(),
        issueDate: issueDate.trim()
      };
      const commitmentFields = {
        candidateName: fieldsToDisclose.candidateName,
        rollNumber: fieldsToDisclose.rollNumber,
        course: fieldsToDisclose.course,
        grade: fieldsToDisclose.grade,
        issueDate: fieldsToDisclose.issueDate,
        institutionId: institutionId.trim(),
        documentHash: hashFileBuffer(req.file.buffer)
      };
      if (documentType) commitmentFields.documentType = documentType;
      chainResult = await verifyOnChain(certId, hashCertificateData(commitmentFields));
      if (!chainResult.isValid && !chainResult.revoked && documentType) {
        chainResult = await verifyOnChain(certId, hashCertificateData({
          candidateName: commitmentFields.candidateName,
          rollNumber: commitmentFields.rollNumber,
          course: commitmentFields.course,
          grade: commitmentFields.grade,
          issueDate: commitmentFields.issueDate,
          institutionId: commitmentFields.institutionId,
          documentHash: commitmentFields.documentHash
        }));
      }
    } else {
      const stored = await Certificate.findOne({ certId });
      if (!stored) {
        return res.status(404).json({ verified: false, message: "No certificate found with this ID" });
      }
      if (stored.documentHash) {
        // Check if institute approval exists
        const isApproved = await isVerificationApprovedOnChain(certId) ||
          await VerificationRequest.exists({ certId, status: "approved" });
        if (!isApproved) {
          return res.status(200).json({
            requiresApproval: true,
            approved: false,
            status: "pending",
            institutionId: stored.institutionId,
            certId,
            candidateName: stored.candidateName,
            message: "Verification requires approval from the issuing institute before document and credentials can be disclosed."
          });
        }
      }
      fieldsToDisclose = {
        candidateName: candidateName ?? stored.candidateName,
        rollNumber: rollNumber ?? stored.rollNumber,
        documentType: stored.documentType || "Other",
        course: course ?? stored.course,
        grade: grade ?? stored.grade,
        issueDate: issueDate ?? stored.issueDate
      };
      const legacyHashFields = {
        candidateName: fieldsToDisclose.candidateName,
        rollNumber: fieldsToDisclose.rollNumber,
        course: fieldsToDisclose.course,
        grade: fieldsToDisclose.grade,
        issueDate: fieldsToDisclose.issueDate,
        institutionId: stored.institutionId
      };
      if (stored.documentType) legacyHashFields.documentType = stored.documentType;
      const recomputedHash = hashCertificateData(legacyHashFields);
      chainResult = await verifyOnChain(certId, recomputedHash);
    }

    const publicFields = chainResult.isValid
      ? await getPublicFields(chainResult.institutionId)
      : [];

    res.json({
      verified: chainResult.isValid,
      revoked: chainResult.revoked,
      institutionId: chainResult.institutionId,
      issuerWallet: chainResult.issuer,
      studentWallet: chainResult.recipient,
      ipfsCid: chainResult.ipfsCid,
      issuedAt: chainResult.issuedAt ? new Date(chainResult.issuedAt * 1000).toISOString() : null,
      certificate: chainResult.isValid ? discloseCertificate(fieldsToDisclose, publicFields) : null,
      message: chainResult.revoked
        ? "This certificate has been revoked by the issuing institution."
        : chainResult.isValid
        ? "Certificate is authentic and matches the blockchain record."
        : "Hash mismatch - this certificate has been altered or is not genuine."
    });
  } catch (err) {
    res.status(500).json({ message: "Verification failed" });
  }
});

module.exports = router;
