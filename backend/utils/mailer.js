require("dotenv").config();
const nodemailer = require("nodemailer");

function getMailTransport(preferredPort = 587) {
  const user = (process.env.SMTP_USER || "").trim();
  const rawPass = (process.env.SMTP_PASS || "").trim();
  if (!user || !rawPass) {
    return null;
  }

  // Remove spaces from Google App Password (e.g. "vydc ubkd dmwq jgea" -> "vydcubkddmwqjgea")
  const cleanPass = rawPass.replace(/\s+/g, "");
  const host = (process.env.SMTP_HOST || "smtp.gmail.com").toLowerCase().trim();
  const port = preferredPort || Number(process.env.SMTP_PORT || 587);
  const secure = port === 465;

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass: cleanPass
    },
    tls: {
      rejectUnauthorized: false
    },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000
  });
}

/**
 * Unified resilient email sender:
 * 1. Dispatches directly via SMTP Port 587 (Standard cloud submission port, works on Render / AWS / GCP)
 * 2. Falls back to Port 465 (SSL)
 * Completely eliminates Resend free-tier domain restrictions!
 */
async function sendEmailMessage({ to, subject, text, attachments = [] }) {
  const user = (process.env.SMTP_USER || "").trim();
  const rawPass = (process.env.SMTP_PASS || "").trim();

  if (!user || !rawPass) {
    console.warn(`[CertChain Mailer] No email credentials configured. Simulated email to: ${to}`);
    return null;
  }

  const mailOptions = {
    from: process.env.MAIL_FROM || user,
    to,
    subject,
    text,
    attachments: attachments ? attachments.map((att) => ({
      filename: att.filename,
      content: att.content,
      contentType: att.contentType || "application/octet-stream"
    })) : []
  };

  // 1. Try Port 587 first (Standard cloud submission port with STARTTLS)
  try {
    console.log(`[CertChain Mailer] Dispatching email to ${to} via SMTP (Port 587)...`);
    const transport587 = getMailTransport(587);
    const info = await transport587.sendMail(mailOptions);
    console.log(`[CertChain Mailer] Delivered via SMTP Port 587 to ${to} (MessageId: ${info.messageId})`);
    return info;
  } catch (err587) {
    console.warn(`[CertChain Mailer] Port 587 attempt failed (${err587.message}), trying Port 465...`);
  }

  // 2. Fallback to Port 465 (Direct SSL)
  try {
    console.log(`[CertChain Mailer] Dispatching email to ${to} via SMTP (Port 465)...`);
    const transport465 = getMailTransport(465);
    const info = await transport465.sendMail(mailOptions);
    console.log(`[CertChain Mailer] Delivered via SMTP Port 465 to ${to} (MessageId: ${info.messageId})`);
    return info;
  } catch (err465) {
    console.error(`[CertChain Mailer] All SMTP delivery attempts failed to ${to}: ${err465.message}`);
    throw err465;
  }
}

/**
 * Automatically sends the issued certificate details & PDF to the student's email.
 */
async function sendCertificateIssuedEmail({
  studentEmail,
  candidateName,
  username,
  certId,
  certificateTitle,
  course,
  department,
  grade,
  issueDate,
  studentWallet,
  issuerWallet,
  txHash,
  blockNumber,
  institutionName,
  institutionId,
  verifyUrl,
  studentDashboardUrl,
  pdfBuffer
}) {
  if (!studentEmail) return;

  const displayTitle = certificateTitle || course || "Academic Credential";
  const displayInst = institutionName || institutionId || "Institution";
  const displayDept = department ? `Department: ${department}\n` : "";
  const displayUsername = username ? `Username: ${username}\n` : "";
  const displayBlock = blockNumber ? `Block Number: ${blockNumber}\n` : "";
  const etherscanLink = txHash ? `https://sepolia.etherscan.io/tx/${txHash}` : "Pending on Sepolia";
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
  const studentPortalUrl = studentDashboardUrl || `${frontendUrl.replace(/\/$/, "")}/student`;
  const verificationLink = verifyUrl || `${frontendUrl.replace(/\/$/, "")}/verify/${certId}`;

  const subject = `🎓 Official Academic Certificate Issued: ${displayTitle} [ID: ${certId}]`;
  const textContent = `Dear ${candidateName},

Congratulations! Your academic certificate for "${displayTitle}" has been officially issued by ${displayInst} and permanently recorded on the Ethereum Sepolia Blockchain.

============================================================
CREDENTIAL & BLOCKCHAIN DETAILS
============================================================
Student Full Name:        ${candidateName}
${displayUsername}Certificate ID:           ${certId}
Certificate Title:        ${displayTitle}
Course / Degree:          ${course || "-"}
${displayDept}Grade / Classification:   ${grade || "-"}
Issuing Institution:      ${displayInst}
Issue Date:               ${issueDate ? new Date(issueDate).toLocaleDateString() : new Date().toLocaleDateString()}
Student Wallet Address:   ${studentWallet || "Self-Sovereign Identity"}
Institution Wallet:       ${issuerWallet || "Authorized Signer"}
Blockchain Network:       Ethereum Sepolia Testnet (Chain ID: 11155111)
Transaction Hash:         ${txHash || "Confirmed"}
${displayBlock}Sepolia Etherscan:         ${etherscanLink}

============================================================
HOW TO ACCESS & VERIFY YOUR CREDENTIAL
============================================================
1. View & Download from Student Dashboard:
   ${studentPortalUrl}
   (Connect your MetaMask wallet or search using your Student Wallet/ID)

2. Instant Employer Verification:
   Share your Certificate ID (${certId}) with prospective employers or recruiters.
   They can independently verify document authenticity on the blockchain here:
   ${verificationLink}

The official cryptographically hashed PDF with QR code is attached to this email.

Best regards,
${displayInst} Academic Registry
(Powered by CertChain Web3 Credential Architecture)`;

  const attachments = pdfBuffer ? [{ filename: `${certId}.pdf`, content: pdfBuffer, contentType: "application/pdf" }] : [];

  try {
    return await sendEmailMessage({
      to: studentEmail,
      subject,
      text: textContent,
      attachments
    });
  } catch (err) {
    console.error(`[CertChain Email Service] Failed to send certificate email to ${studentEmail}:`, err.message);
  }
}

/**
 * Notifies a student when a certificate has been revoked on Ethereum Sepolia.
 */
async function sendCertificateRevokedEmail({
  studentEmail,
  candidateName,
  certId,
  course,
  institutionName,
  institutionId,
  revocationTxHash,
  revokedAt,
  reason
}) {
  if (!studentEmail) return;

  const displayInst = institutionName || institutionId || "Institution";
  const etherscanLink = revocationTxHash ? `https://sepolia.etherscan.io/tx/${revocationTxHash}` : "Confirmed on Sepolia";
  const subject = `⚠️ Important Notice: Academic Certificate Revoked [ID: ${certId}]`;

  const textContent = `Dear ${candidateName},

This is an official notification that your academic credential "${course || "Certificate"}" [ID: ${certId}] issued by ${displayInst} has been REVOKED on the Ethereum Sepolia Blockchain.

============================================================
REVOCATION DETAILS
============================================================
Certificate ID:           ${certId}
Student Full Name:        ${candidateName}
Issuing Institution:      ${displayInst}
Revocation Date:          ${revokedAt ? new Date(revokedAt).toLocaleString() : new Date().toLocaleString()}
Reason:                   ${reason || "Administrative update / Revoked by issuing authority"}
Revocation Tx Hash:       ${revocationTxHash || "Confirmed"}
Sepolia Etherscan Link:   ${etherscanLink}

The credential record remains immutably recorded in the blockchain history for auditability, but its status is now marked as REVOKED and it will fail verification.

For inquiries regarding this action, please contact the administrative office at ${displayInst}.

Best regards,
${displayInst} Academic Registry`;

  try {
    return await sendEmailMessage({
      to: studentEmail,
      subject,
      text: textContent
    });
  } catch (err) {
    console.error(`[CertChain Email Service] Failed to send revocation email to ${studentEmail}:`, err.message);
  }
}

/**
 * Notifies employer that their verification request has been received and queued for institute review.
 */
async function sendEmployerRequestSubmittedEmail({
  employerEmail,
  employerName,
  certId,
  candidateName,
  course,
  institutionName,
  requestId,
  tamperStatus
}) {
  if (!employerEmail) return;

  const subject = `📋 Verification Request Submitted: ${candidateName} [${certId}]`;
  const textContent = `Dear ${employerName || "Employer"},

Your verification request for candidate "${candidateName || "Student"}" (${course || "Academic Credential"}) has been submitted to ${institutionName || "the issuing institution"}.

============================================================
REQUEST DETAILS
============================================================
Request ID:           ${requestId}
Certificate ID:       ${certId}
Candidate:            ${candidateName || "Student"}
Document Integrity:   ${tamperStatus === "NOT_TAMPERED" ? "🟢 SHA-256 MATCHES ON-CHAIN RECORD" : tamperStatus === "TAMPERED" ? "🔴 HASH MISMATCH / TAMPER DETECTED" : "⚪ NO PDF SUPPLIED"}
Current Status:       ⏳ PENDING INSTITUTE REVIEW

The issuing institution has been notified to review and authorize the disclosure of academic records. You will receive an email as soon as a decision is confirmed on Ethereum Sepolia.

Best regards,
CertChain Verification Network`;

  try {
    return await sendEmailMessage({ to: employerEmail, subject, text: textContent });
  } catch (e) {
    console.warn("Failed to dispatch employer request email:", e.message);
  }
}

/**
 * Alerts the issuing institute that an employer has requested certificate verification.
 */
async function sendInstituteNewRequestEmail({
  institutionEmail,
  institutionName,
  certId,
  candidateName,
  course,
  employerName,
  employerWallet,
  requestId,
  tamperStatus
}) {
  if (!institutionEmail) return;

  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
  const dashboardUrl = `${frontendUrl.replace(/\/$/, "")}/dashboard?tab=verifications`;

  const subject = `🔔 Action Required: New Employer Verification Request [${certId}]`;
  const textContent = `Attention: ${institutionName || "Academic Registry"},

An employer has submitted a verification request for an academic certificate issued by your institution.

============================================================
VERIFICATION REQUEST DETAILS
============================================================
Request ID:           ${requestId}
Certificate ID:       ${certId}
Candidate:            ${candidateName || "Student"} (${course || "Degree"})
Employer Name:        ${employerName || "Prospective Employer"}
Employer Wallet:      ${employerWallet || "Standard Web3 Identity"}
Document Integrity:   ${tamperStatus === "NOT_TAMPERED" ? "🟢 NOT TAMPERED (SHA-256 matches blockchain record)" : tamperStatus === "TAMPERED" ? "🔴 TAMPER DETECTED (SHA-256 differs from blockchain)" : "⚪ INTEGRITY NOT CHECKED (No PDF provided)"}

To review the candidate records, compare submitted files, and authorize or reject on Ethereum Sepolia, visit your Institute Dashboard:
${dashboardUrl}

Best regards,
CertChain Decentralized Verification Architecture`;

  try {
    return await sendEmailMessage({ to: institutionEmail, subject, text: textContent });
  } catch (e) {
    console.warn("Failed to dispatch institute alert email:", e.message);
  }
}

/**
 * Notifies employer of the institute's approval or rejection decision.
 */
async function sendEmployerApprovalDecisionEmail({
  employerEmail,
  employerName,
  certId,
  candidateName,
  course,
  institutionName,
  status,
  txHash,
  reason
}) {
  if (!employerEmail) return;

  const isApproved = status === "approved";
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
  const verifyLink = `${frontendUrl.replace(/\/$/, "")}/verify/${certId}`;

  const subject = isApproved
    ? `✅ Verification Approved: ${candidateName} [${certId}]`
    : `❌ Verification Rejected: ${candidateName} [${certId}]`;

  const textContent = `Dear ${employerName || "Employer"},

${institutionName || "The issuing institution"} has reviewed your certificate verification request for "${candidateName}" (${course}).

============================================================
DECISION & BLOCKCHAIN EVIDENCE
============================================================
Certificate ID:       ${certId}
Candidate Name:       ${candidateName}
Decision:             ${isApproved ? "✅ VERIFIED & AUTHORIZED" : "❌ REJECTED"}
${txHash ? `Sepolia Tx Hash:       ${txHash}\nSepolia Explorer:      https://sepolia.etherscan.io/tx/${txHash}\n` : ""}${reason ? `Reason / Notes:        ${reason}\n` : ""}
${isApproved ? `You can now view the verified candidate details and original document here:\n${verifyLink}` : "This verification request has been closed."}

Best regards,
CertChain Academic Registry`;

  try {
    return await sendEmailMessage({ to: employerEmail, subject, text: textContent });
  } catch (e) {
    console.warn("Failed to dispatch employer decision email:", e.message);
  }
}

/**
 * Notifies student that an employer has completed verification of their credential.
 */
async function sendStudentVerificationAlertEmail({
  studentEmail,
  candidateName,
  certId,
  course,
  employerName,
  institutionName,
  verifiedAt
}) {
  if (!studentEmail) return;

  const subject = `👁️ Verification Alert: Your Academic Credential Was Verified [${certId}]`;
  const textContent = `Dear ${candidateName},

Your academic certificate for "${course}" [ID: ${certId}] was verified by employer "${employerName || "Prospective Employer"}" through ${institutionName || "your institution"} on Ethereum Sepolia at ${new Date(verifiedAt).toLocaleString()}.

Your credential was confirmed authentic and tamper-free.

Best regards,
CertChain Credential Registry`;

  try {
    return await sendEmailMessage({ to: studentEmail, subject, text: textContent });
  } catch (e) {
    console.warn("Failed to dispatch student alert email:", e.message);
  }
}

module.exports = {
  getMailTransport,
  sendEmailMessage,
  sendCertificateIssuedEmail,
  sendCertificateRevokedEmail,
  sendEmployerRequestSubmittedEmail,
  sendInstituteNewRequestEmail,
  sendEmployerApprovalDecisionEmail,
  sendStudentVerificationAlertEmail
};


