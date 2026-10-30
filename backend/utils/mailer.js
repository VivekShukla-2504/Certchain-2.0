const nodemailer = require("nodemailer");

function getMailTransport() {
  const user = (process.env.SMTP_USER || "").trim();
  const rawPass = (process.env.SMTP_PASS || "").trim();
  if (!user || !rawPass) {
    console.warn("[CertChain Mailer] SMTP_USER or SMTP_PASS is missing in environment variables. Email service is running in simulated mode.");
    return null;
  }

  // Remove spaces from Google App Password (e.g. "vydc ubkd dmwq jgea" -> "vydcubkddmwqjgea")
  const cleanPass = rawPass.replace(/\s+/g, "");
  const host = (process.env.SMTP_HOST || "").toLowerCase().trim();
  const isGmail = host === "smtp.gmail.com" || user.toLowerCase().endsWith("@gmail.com") || (!host && user.includes("@"));

  if (isGmail) {
    return nodemailer.createTransport({
      service: "gmail",
      auth: {
        user,
        pass: cleanPass
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000
    });
  }

  const port = Number(process.env.SMTP_PORT || 465);
  const secure = process.env.SMTP_SECURE === "true" || port === 465;

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port,
    secure,
    auth: {
      user,
      pass: cleanPass
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000
  });
}

/**
 * Automatically sends the issued certificate details & PDF to the student's email.
 */
async function sendCertificateIssuedEmail({
  studentEmail,
  candidateName,
  certId,
  course,
  grade,
  institutionId,
  verifyUrl,
  pdfBuffer
}) {
  if (!studentEmail) return;

  const transport = getMailTransport();
  const subject = `🎓 Official Academic Certificate Issued: ${course} [ID: ${certId}]`;
  const textContent = `Dear ${candidateName},

Congratulations! Your academic certificate for "${course}" (Grade: ${grade}) has been officially issued by ${institutionId} and permanently anchored to the Ethereum Blockchain.

Your Unique Certificate ID: ${certId}

You can share this Certificate ID with employers or recruiters for instant on-chain verification.
Direct Verification Link: ${verifyUrl}

The official PDF document with verification QR code is attached to this email.

Best regards,
${institutionId} Credential Registry (Powered by CertChain)`;

  if (!transport) {
    console.log(`[CertChain Email Service] Simulated email dispatched to ${studentEmail} for Certificate ID: ${certId}`);
    return;
  }

  try {
    console.log(`[CertChain Email Service] Dispatching certificate email to student: ${studentEmail} (Cert ID: ${certId})...`);
    const info = await transport.sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER,
      to: studentEmail,
      subject,
      text: textContent,
      attachments: pdfBuffer ? [
        {
          filename: `${certId}.pdf`,
          content: pdfBuffer,
          contentType: "application/pdf"
        }
      ] : []
    });
    console.log(`[CertChain Email Service] Certificate email sent successfully to ${studentEmail} (MessageId: ${info.messageId})`);
    return info;
  } catch (err) {
    console.error(`[CertChain Email Service] Failed to send email to ${studentEmail}:`, err.message);
  }
}

module.exports = { getMailTransport, sendCertificateIssuedEmail };


