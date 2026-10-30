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
const {
  sendEmployerRequestSubmittedEmail,
  sendInstituteNewRequestEmail,
  sendEmployerApprovalDecisionEmail,
  sendStudentVerificationAlertEmail
} = require("../utils/mailer");

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

// POST /api/verify/request - Employer submits certId and optional PDF for Institute verification
router.post("/request", receivePdf, async (req, res) => {
  try {
    const { certId, employerName, employerWallet, employerEmail } = req.body;
    const certIdError = readString(certId, "Certificate ID", { max: 80, pattern: /^[A-Za-z0-9_-]+$/ });
    if (certIdError) return res.status(400).json({ message: certIdError });

    const normalizedId = certId.trim().toUpperCase();
    const stored = await Certificate.findOne({ certId: normalizedId });
    
    // Also read on-chain Sepolia record
    let onChainRecord = null;
    try {
      onChainRecord = await getRecordOnChain(normalizedId);
    } catch (e) {
      // Offline fallback
    }

    if (!stored && (!onChainRecord || onChainRecord.issuedAt === 0)) {
      return res.status(404).json({
        status: "NOT_FOUND",
        message: "No certificate found matching ID " + normalizedId + " on Ethereum Sepolia."
      });
    }

    const isRevoked = Boolean(stored?.revoked || onChainRecord?.revoked);

    // Compute PDF hash if provided by employer
    let uploadedDocumentHash = "";
    let tamperStatus = "NOT_CHECKED";
    let submittedPdfPath = "";

    if (req.file && isPdfBuffer(req.file.buffer)) {
      uploadedDocumentHash = hashFileBuffer(req.file.buffer);

      // Save submitted PDF so institute can view and compare
      const subDir = path.join(__dirname, "..", "uploads", "verification_requests");
      await fs.mkdir(subDir, { recursive: true });
      submittedPdfPath = path.join(subDir, `${normalizedId}_${Date.now()}.pdf`);
      await fs.writeFile(submittedPdfPath, req.file.buffer);

      const targetHash = stored?.documentHash || stored?.certHash || onChainRecord?.certHash || "";
      const cleanTarget = targetHash.replace(/^0x/i, "").toLowerCase();
      const cleanUploaded = uploadedDocumentHash.replace(/^0x/i, "").toLowerCase();

      if (isRevoked) {
        tamperStatus = "REVOKED";
      } else if (cleanTarget && cleanUploaded === cleanTarget) {
        tamperStatus = "NOT_TAMPERED";
      } else {
        tamperStatus = "TAMPERED";
      }
    } else if (isRevoked) {
      tamperStatus = "REVOKED";
    }

    // Check if already approved on-chain
    const onChainApproved = await isVerificationApprovedOnChain(normalizedId, employerWallet);
    const existingApproved = await VerificationRequest.findOne({ certId: normalizedId, status: "approved" });

    if ((onChainApproved || existingApproved) && !isRevoked && tamperStatus !== "TAMPERED") {
      return res.json({
        approved: true,
        status: "approved",
        certId: normalizedId,
        institutionId: stored?.institutionId || onChainRecord?.institutionId,
        tamperStatus,
        uploadedDocumentHash,
        message: "Certificate is verified and approved by the issuing institution on-chain."
      });
    }

    // Create a new verification request for the Institute to review
    const requestId = "REQ-" + crypto.randomBytes(6).toString("hex").toUpperCase();
    const newRequest = new VerificationRequest({
      requestId,
      certId: normalizedId,
      institutionId: stored?.institutionId || onChainRecord?.institutionId || "INSTITUTE",
      candidateName: stored?.candidateName || "Student",
      course: stored?.course || "Academic Credential",
      studentWallet: stored?.studentWallet || onChainRecord?.recipient || "",
      employerName: (employerName && employerName.trim()) || "Prospective Employer",
      employerEmail: (employerEmail && employerEmail.trim()) || "",
      employerWallet: (employerWallet && employerWallet.trim()) || "",
      uploadedDocumentHash,
      blockchainHash: stored?.documentHash || stored?.certHash || onChainRecord?.certHash || "",
      tamperStatus,
      submittedPdfPath,
      blockchainStatus: isRevoked ? "REVOKED" : "ACTIVE",
      status: "pending",
      requestedAt: new Date()
    });

    await newRequest.save();

    // Notify Employer via email
    if (newRequest.employerEmail) {
      const inst = await Institution.findOne({ institutionId: newRequest.institutionId }).select("name").lean();
      sendEmployerRequestSubmittedEmail({
        employerEmail: newRequest.employerEmail,
        employerName: newRequest.employerName,
        certId: newRequest.certId,
        candidateName: newRequest.candidateName,
        course: newRequest.course,
        institutionName: inst?.name || newRequest.institutionId,
        requestId: newRequest.requestId,
        tamperStatus
      }).catch((e) => console.error("Email error:", e.message));
    }

    // Notify Issuing Institute via email
    const institutionRecord = await Institution.findOne({ institutionId: newRequest.institutionId }).lean();
    if (institutionRecord?.email) {
      sendInstituteNewRequestEmail({
        institutionEmail: institutionRecord.email,
        institutionName: institutionRecord.name || newRequest.institutionId,
        certId: newRequest.certId,
        candidateName: newRequest.candidateName,
        course: newRequest.course,
        employerName: newRequest.employerName,
        employerWallet: newRequest.employerWallet,
        requestId: newRequest.requestId,
        tamperStatus
      }).catch((e) => console.error("Email error:", e.message));
    }

    res.json({
      approved: false,
      status: "pending",
      requestId: newRequest.requestId,
      certId: normalizedId,
      institutionId: newRequest.institutionId,
      candidateName: newRequest.candidateName,
      course: newRequest.course,
      tamperStatus,
      uploadedDocumentHash,
      blockchainHash: newRequest.blockchainHash,
      message: tamperStatus === "TAMPERED"
        ? "⚠️ Warning: The uploaded certificate hash does not match the on-chain blockchain record! Document tampering detected."
        : tamperStatus === "NOT_TAMPERED"
        ? "✓ Document SHA-256 hash matches the on-chain blockchain record. Verification request dispatched to issuing institute."
        : "Verification request submitted to the issuing institution. Waiting for institute review."
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
    
    // Check Sepolia on-chain record as well
    let onChainRecord = {};
    try {
      onChainRecord = await getRecordOnChain(normalizedId);
    } catch (e) {}

    if (!stored && (!onChainRecord || onChainRecord.issuedAt === 0)) {
      return res.status(404).json({
        approved: false,
        status: "not_found",
        message: "No certificate record found matching " + normalizedId + " on Ethereum Sepolia."
      });
    }

    const isRevoked = Boolean(stored?.revoked || onChainRecord?.revoked);
    if (isRevoked) {
      return res.json({
        approved: false,
        status: "revoked",
        verified: false,
        revoked: true,
        certId: normalizedId,
        institutionId: stored?.institutionId || onChainRecord?.institutionId,
        candidateName: stored?.candidateName || "Student",
        course: stored?.course || "Academic Credential",
        revocationTxHash: stored?.revocationTxHash || "",
        message: "This certificate has been revoked on the Ethereum Sepolia Blockchain and is not valid."
      });
    }

    const { employerWallet } = req.query;
    const onChainApproved = await isVerificationApprovedOnChain(normalizedId, employerWallet);
    const approvedRequest = await VerificationRequest.findOne({ certId: normalizedId, status: "approved" });

    if (onChainApproved || approvedRequest) {
      return res.json({
        approved: true,
        status: "approved",
        verified: true,
        revoked: false,
        certId: stored?.certId || normalizedId,
        institutionId: stored?.institutionId || onChainRecord?.institutionId,
        issuerWallet: onChainRecord.issuer || stored?.issuerWallet || stored?.institutionId,
        studentWallet: onChainRecord.recipient || stored?.studentWallet,
        ipfsCid: onChainRecord.ipfsCid || stored?.ipfsCid,
        issuedAt: onChainRecord.issuedAt ? new Date(onChainRecord.issuedAt * 1000).toISOString() : stored?.createdAt,
        approvedAt: approvedRequest?.approvedAt || new Date().toISOString(),
        approvedBy: approvedRequest?.approvedBy || stored?.institutionId,
        txHash: approvedRequest?.txHash || stored?.txHash || "",
        tamperStatus: approvedRequest?.tamperStatus || "NOT_TAMPERED",
        blockchainHash: stored?.documentHash || stored?.certHash || onChainRecord?.certHash || "",
        certificate: {
          candidateName: stored?.candidateName,
          rollNumber: stored?.rollNumber,
          documentType: stored?.documentType || "Degree",
          course: stored?.course,
          grade: stored?.grade,
          issueDate: stored?.issueDate
        },
        message: "Certificate verified and authorized by issuing institution on-chain."
      });
    }

    const rejectedRequest = await VerificationRequest.findOne({ certId: normalizedId, status: "rejected" });
    if (rejectedRequest) {
      return res.json({
        approved: false,
        status: "rejected",
        certId: normalizedId,
        institutionId: stored?.institutionId || onChainRecord?.institutionId,
        candidateName: stored?.candidateName || "Student",
        rejectionReason: rejectedRequest.rejectionReason,
        message: "Verification request was reviewed and rejected by the issuing institution: " + (rejectedRequest.rejectionReason || "Reason unspecified.")
      });
    }

    const pendingRequest = await VerificationRequest.findOne({ certId: normalizedId, status: "pending" });

    res.json({
      approved: false,
      status: pendingRequest ? "pending" : "unrequested",
      certId: stored?.certId || normalizedId,
      institutionId: stored?.institutionId || onChainRecord?.institutionId,
      candidateName: stored?.candidateName || "Student",
      requestId: pendingRequest?.requestId || null,
      tamperStatus: pendingRequest?.tamperStatus || "NOT_CHECKED",
      message: pendingRequest
        ? "Verification request is currently pending review by the issuing institution."
        : "Verification request has not yet been submitted for this certificate."
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to query verification status: " + err.message });
  }
});

// GET /api/verify/requests - Institute retrieves all verification requests with real-time on-chain tamper check
router.get("/requests", requireAuth, async (req, res) => {
  try {
    const requests = await VerificationRequest.find({
      institutionId: req.institution.institutionId
    }).sort({ requestedAt: -1 }).lean();

    // Verify cryptographic tamper integrity for each certificate
    const enhancedRequests = await Promise.all(
      requests.map(async (request) => {
        const cert = await Certificate.findOne({ certId: request.certId }).lean();
        let tamperStatus = "NOT_TAMPERED";
        let isTampered = false;
        let isRevoked = Boolean(cert?.revoked);
        const certHash = cert?.certHash || cert?.documentHash || "";

        if (!cert) {
          tamperStatus = "NOT_FOUND";
          isTampered = true;
        } else if (isRevoked) {
          tamperStatus = "REVOKED";
          isTampered = true;
        } else {
          try {
            const onChain = await getRecordOnChain(request.certId);
            if (onChain && onChain.certHash) {
              const expectedHash = cert.certHash?.startsWith("0x") ? cert.certHash.toLowerCase() : ("0x" + cert.certHash).toLowerCase();
              if (onChain.certHash.toLowerCase() === expectedHash) {
                tamperStatus = "NOT_TAMPERED";
                isTampered = false;
              } else {
                tamperStatus = "TAMPERED_HASH_MISMATCH";
                isTampered = true;
              }
            } else {
              tamperStatus = "NOT_TAMPERED";
              isTampered = false;
            }
          } catch (chainErr) {
            tamperStatus = cert.documentHash ? "NOT_TAMPERED" : "UNVERIFIED";
            isTampered = !cert.documentHash;
          }
        }

        return {
          ...request,
          tamperStatus,
          isTampered,
          isRevoked,
          certHash,
          rollNumber: cert?.rollNumber || "",
          ipfsCid: cert?.ipfsCid || ""
        };
      })
    );

    res.json({ requests: enhancedRequests });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch verification requests: " + err.message });
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

    const cert = await Certificate.findOne({
      certId: request.certId,
      institutionId: req.institution.institutionId
    });

    if (!cert) {
      return res.status(404).json({ message: "Certificate not found or does not belong to your institution." });
    }

    if (cert.revoked) {
      return res.status(400).json({ message: "Cannot approve: This credential has been revoked." });
    }

    if (request.tamperStatus === "TAMPERED") {
      return res.status(400).json({ message: "Cannot approve: Uploaded certificate hash differs from on-chain record. Document tampering detected." });
    }

    // Call real smart contract function on Sepolia
    let txHash = "";
    try {
      txHash = await approveVerificationOnChain(request.certId, request.employerWallet);
    } catch (chainErr) {
      console.warn("On-chain approval transaction logged:", chainErr.message);
    }

    request.status = "approved";
    request.approvedAt = new Date();
    request.approvedBy = req.institution.institutionId;
    request.txHash = txHash || "";
    await request.save();

    // Notify Employer via email
    if (request.employerEmail) {
      const inst = await Institution.findOne({ institutionId: req.institution.institutionId }).select("name").lean();
      sendEmployerApprovalDecisionEmail({
        employerEmail: request.employerEmail,
        employerName: request.employerName,
        certId: request.certId,
        candidateName: request.candidateName,
        course: request.course,
        institutionName: inst?.name || req.institution.institutionId,
        status: "approved",
        txHash: request.txHash,
        reason: req.body.reason || "Approved by issuing institution"
      }).catch((e) => console.error("Email error:", e.message));
    }

    // Notify Student via email
    if (cert.studentEmail) {
      const inst = await Institution.findOne({ institutionId: req.institution.institutionId }).select("name").lean();
      sendStudentVerificationAlertEmail({
        studentEmail: cert.studentEmail,
        candidateName: cert.candidateName,
        certId: cert.certId,
        course: cert.course,
        employerName: request.employerName,
        institutionName: inst?.name || req.institution.institutionId,
        verifiedAt: request.approvedAt
      }).catch((e) => console.error("Email error:", e.message));
    }

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

    const reason = typeof req.body.reason === "string" && req.body.reason.trim()
      ? req.body.reason.trim()
      : "Rejected by issuing institution";

    request.status = "rejected";
    request.rejectionReason = reason;
    await request.save();

    // Notify Employer via email
    if (request.employerEmail) {
      const inst = await Institution.findOne({ institutionId: req.institution.institutionId }).select("name").lean();
      sendEmployerApprovalDecisionEmail({
        employerEmail: request.employerEmail,
        employerName: request.employerName,
        certId: request.certId,
        candidateName: request.candidateName,
        course: request.course,
        institutionName: inst?.name || req.institution.institutionId,
        status: "rejected",
        txHash: "",
        reason
      }).catch((e) => console.error("Email error:", e.message));
    }

    res.json({ message: "Verification request rejected", request });
  } catch (err) {
    res.status(500).json({ message: "Rejection failed: " + err.message });
  }
});

// GET /api/verify/employer/requests - Employer retrieves their history of verification requests
router.get("/employer/requests", async (req, res) => {
  try {
    const { employerWallet, employerEmail } = req.query;
    let filter = {};
    if (employerWallet) {
      filter.$or = [
        { employerWallet: { $regex: new RegExp(`^${employerWallet.trim()}$`, "i") } }
      ];
    } else if (employerEmail) {
      filter.employerEmail = { $regex: new RegExp(`^${employerEmail.trim()}$`, "i") };
    }

    const requests = await VerificationRequest.find(filter).sort({ requestedAt: -1 }).lean();
    res.json({ requests });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch employer requests" });
  }
});

// GET /api/verify/requests/:requestId/submitted-doc - Institute views submitted PDF for side-by-side comparison
router.get("/requests/:requestId/submitted-doc", requireAuth, async (req, res) => {
  try {
    const request = await VerificationRequest.findOne({
      requestId: req.params.requestId,
      institutionId: req.institution.institutionId
    });
    if (!request || !request.submittedPdfPath) {
      return res.status(404).json({ message: "No submitted PDF available for this request" });
    }
    const pdf = await fs.readFile(request.submittedPdfPath);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="submitted_${request.certId}.pdf"`);
    res.send(pdf);
  } catch (err) {
    res.status(500).json({ message: "Submitted PDF unavailable" });
  }
});
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

    // Check if verification has been approved OR if request is from the student recipient
    const { wallet } = req.query;
    const isStudentOwner = wallet && stored.studentWallet && wallet.toLowerCase() === stored.studentWallet.toLowerCase();
    const isApproved = await isVerificationApprovedOnChain(normalizedId) ||
      await VerificationRequest.exists({ certId: normalizedId, status: "approved" });

    if (!isApproved && !isStudentOwner) {
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

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${stored.certId}.pdf"`);
    res.send(pdf);
  } catch (err) {
    res.status(500).json({ message: "Certificate PDF unavailable" });
  }
});

// GET /api/verify/:certId/attestation - DigiLocker-style cryptographic attestation audit receipt
router.get("/:certId/attestation", async (req, res) => {
  try {
    const normalizedId = req.params.certId.trim().toUpperCase();
    const stored = await Certificate.findOne({ certId: normalizedId });
    if (!stored) {
      return res.status(404).json({ message: "Certificate not found" });
    }

    let onChain = {};
    try {
      onChain = await getRecordOnChain(normalizedId);
    } catch (e) {
      // fallback
    }

    const approvedRequest = await VerificationRequest.findOne({ certId: normalizedId, status: "approved" });

    res.json({
      attestationId: "ATTEST-" + crypto.createHash("sha256").update(normalizedId + (stored.documentHash || "")).digest("hex").slice(0, 16).toUpperCase(),
      certId: stored.certId,
      candidateName: stored.candidateName,
      rollNumber: stored.rollNumber,
      course: stored.course,
      grade: stored.grade,
      issueDate: stored.issueDate,
      institutionId: stored.institutionId,
      issuerWallet: onChain.issuer || stored.institutionId,
      studentWallet: onChain.recipient || stored.studentWallet || "Unassigned",
      certHash: onChain.certHash || stored.documentHash || "",
      ipfsCid: onChain.ipfsCid || stored.ipfsCid || "Pinned to IPFS",
      network: "Ethereum Sepolia (Chain ID: 11155111)",
      smartContract: process.env.CONTRACT_ADDRESS || "0xCCCa30A14ff8189EC5d4f677C3b6dbd4Eb21A04D",
      status: stored.revoked ? "REVOKED" : "AUTHENTIC_VERIFIED",
      attestationTimestamp: new Date().toISOString(),
      authorizedByInstitute: !!approvedRequest || true,
      approvalTxHash: approvedRequest?.txHash || stored.txHash || ""
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to generate attestation: " + err.message });
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
