const nodemailer = require("nodemailer");

function getMailTransport() {
  const user = (process.env.SMTP_USER || "").trim();
  const rawPass = (process.env.SMTP_PASS || "").trim();
  if (!user || !rawPass) {
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
      connectionTimeout: 8000,
      greetingTimeout: 8000,
      socketTimeout: 10000
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
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 10000
  });
}

/**
 * Sends email via Resend HTTPS REST API (Port 443).
 * Never blocked by cloud providers like Render Free Tier.
 */
async function sendViaResend({ to, subject, text, attachments = [] }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;

  const fromEmail = process.env.MAIL_FROM || "onboarding@resend.dev";
  const formattedFrom = fromEmail.includes("<") ? fromEmail : `CertChain <${fromEmail}>`;

  const payload = {
    from: formattedFrom,
    to: Array.isArray(to) ? to : [to],
    subject,
    text
  };

  if (attachments && attachments.length > 0) {
    payload.attachments = attachments.map((att) => ({
      filename: att.filename,
      content: Buffer.isBuffer(att.content) ? att.content.toString("base64") : Buffer.from(att.content).toString("base64")
    }));
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || `Resend error: ${res.status}`);
  }
  return { messageId: data.id, provider: "resend" };
}

/**
 * Unified resilient email sender:
 * 1. Attempts Resend HTTPS API (Port 443) if configured
 * 2. Falls back to Nodemailer SMTP
 */
async function sendEmailMessage({ to, subject, text, attachments = [] }) {
  // 1. Check Resend HTTPS API (works everywhere, including Render free tier)
  if (process.env.RESEND_API_KEY) {
    try {
      console.log(`[CertChain Mailer] Dispatching via Resend HTTPS to ${to}...`);
      const result = await sendViaResend({ to, subject, text, attachments });
      console.log(`[CertChain Mailer] Delivered via Resend to ${to} (ID: ${result.messageId})`);
      return result;
    } catch (resendErr) {
      console.warn(`[CertChain Mailer] Resend HTTPS failed (${resendErr.message}), falling back to SMTP...`);
    }
  }

  // 2. Check SMTP transport
  const transport = getMailTransport();
  if (!transport) {
    console.warn(`[CertChain Mailer] No email credentials configured. Simulated email to: ${to}`);
    return null;
  }

  try {
    console.log(`[CertChain Mailer] Dispatching via SMTP to ${to}...`);
    const info = await transport.sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER,
      to,
      subject,
      text,
      attachments: attachments ? attachments.map((att) => ({
        filename: att.filename,
        content: att.content,
        contentType: att.contentType || "application/octet-stream"
      })) : []
    });
    console.log(`[CertChain Mailer] Delivered via SMTP to ${to} (MessageId: ${info.messageId})`);
    return info;
  } catch (err) {
    console.error(`[CertChain Mailer] SMTP delivery failed to ${to}: ${err.message}`);
    if (err.message && (err.message.includes("ETIMEDOUT") || err.message.includes("timeout"))) {
      console.warn("[CertChain Mailer] Note: Render Free Tier firewalls block raw outbound SMTP ports 25, 465, and 587. Configure RESEND_API_KEY for HTTPS delivery.");
    }
    throw err;
  }
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

  const subject = `🎓 Official Academic Certificate Issued: ${course} [ID: ${certId}]`;
  const textContent = `Dear ${candidateName},

Congratulations! Your academic certificate for "${course}" (Grade: ${grade}) has been officially issued by ${institutionId} and permanently anchored to the Ethereum Blockchain.

Your Unique Certificate ID: ${certId}

You can share this Certificate ID with employers or recruiters for instant on-chain verification.
Direct Verification Link: ${verifyUrl}

The official PDF document with verification QR code is attached to this email.

Best regards,
${institutionId} Credential Registry (Powered by CertChain)`;

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

module.exports = { getMailTransport, sendEmailMessage, sendCertificateIssuedEmail };


