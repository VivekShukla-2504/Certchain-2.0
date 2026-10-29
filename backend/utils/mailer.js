const nodemailer = require("nodemailer");

function getMailTransport() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return null;
  }
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
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
    await transport.sendMail({
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
    console.log(`[CertChain Email Service] Certificate email sent successfully to ${studentEmail}`);
  } catch (err) {
    console.error(`[CertChain Email Service] Failed to send email to ${studentEmail}:`, err.message);
  }
}

module.exports = { getMailTransport, sendCertificateIssuedEmail };

