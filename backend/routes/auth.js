const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const Institution = require("../models/Institution");
const { readString } = require("../utils/validation");

const router = express.Router();

function getMailTransport() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
}

// POST /api/auth/signup - register a new institution admin
router.post("/signup", async (req, res) => {
  try {
    const { name, institutionId, email, password, walletAddress } = req.body;
    const values = { name, institutionId, email, password, walletAddress };
    for (const [field, value] of Object.entries(values)) {
      const error = readString(value, field === "walletAddress" ? "Wallet address" : field, { max: field === "password" ? 128 : 160 });
      if (error) return res.status(400).json({ message: error });
    }
    if (password.length < 8) return res.status(400).json({ message: "Password must be at least 8 characters" });
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return res.status(400).json({ message: "Email has an invalid format" });

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedInstitutionId = institutionId.trim();
    const existing = await Institution.findOne({ $or: [{ email: normalizedEmail }, { institutionId: normalizedInstitutionId }] });
    if (existing) {
      return res.status(409).json({ message: "Institution already registered" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const institution = await Institution.create({
      name: name.trim(),
      institutionId: normalizedInstitutionId,
      email: normalizedEmail,
      passwordHash,
      walletAddress: walletAddress.trim(),
      approvalStatus: process.env.INSTITUTION_APPROVAL_REQUIRED === "true" ? "pending" : "approved",
      role: "admin"
    });

    res.status(201).json({
      message: institution.approvalStatus === "pending" ? "Institution registered and awaiting approval" : "Institution registered",
      institution: { id: institution._id, name: institution.name, institutionId: institution.institutionId }
    });
  } catch (err) {
    res.status(500).json({ message: "Signup failed" });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (typeof email !== "string" || typeof password !== "string" || !email.trim() || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }
    const institution = await Institution.findOne({ email: email.trim().toLowerCase() });
    if (!institution) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
    if (institution.approvalStatus === "pending") {
      return res.status(403).json({ message: "Institution registration is awaiting approval" });
    }
    if (institution.approvalStatus === "suspended") {
      return res.status(403).json({ message: "Institution access has been suspended" });
    }

    const match = await bcrypt.compare(password, institution.passwordHash);
    if (!match) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      {
        id: institution._id,
        institutionId: institution.institutionId,
        walletAddress: institution.walletAddress,
        role: institution.role || "admin"
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
    );

    res.json({
      token,
      institution: { id: institution._id, name: institution.name, institutionId: institution.institutionId, role: institution.role || "admin" }
    });
  } catch (err) {
    res.status(500).json({ message: "Login failed" });
  }
});

// POST /api/auth/forgot-password
router.post("/forgot-password", async (req, res) => {
  const genericResponse = { message: "If an account exists, a password reset code has been sent." };
  try {
    const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ message: "Enter a valid email address" });
    const institution = await Institution.findOne({ email });
    if (!institution) return res.json(genericResponse);
    const transport = getMailTransport();
    if (!transport) return res.json(genericResponse);

    const otp = crypto.randomInt(100000, 1000000).toString();
    institution.passwordResetOtpHash = crypto.createHash("sha256").update(otp).digest("hex");
    institution.passwordResetExpiresAt = new Date(Date.now() + Number(process.env.PASSWORD_RESET_OTP_TTL_MINUTES || 10) * 60 * 1000);
    institution.passwordResetAttempts = 0;
    await institution.save();

    await transport.sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER,
      to: institution.email,
      subject: "CertChain password reset code",
      text: `Your CertChain password reset code is ${otp}. It expires soon. If you did not request this, ignore this email.`
    });
    return res.json(genericResponse);
  } catch (err) {
    return res.json(genericResponse);
  }
});

// POST /api/auth/reset-password
router.post("/reset-password", async (req, res) => {
  try {
    const { email, otp, password } = req.body;
    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    if (!normalizedEmail || typeof otp !== "string" || !/^\d{6}$/.test(otp)) return res.status(400).json({ message: "Email and a valid 6-digit code are required" });
    if (typeof password !== "string" || password.length < 8) return res.status(400).json({ message: "Password must be at least 8 characters" });
    const institution = await Institution.findOne({ email: normalizedEmail });
    const expired = !institution?.passwordResetExpiresAt || institution.passwordResetExpiresAt.getTime() < Date.now();
    if (!institution || expired || institution.passwordResetAttempts >= 5) return res.status(400).json({ message: "Invalid or expired reset code" });
    const otpHash = crypto.createHash("sha256").update(otp).digest("hex");
    if (otpHash !== institution.passwordResetOtpHash) {
      institution.passwordResetAttempts += 1;
      await institution.save();
      return res.status(400).json({ message: "Invalid or expired reset code" });
    }
    institution.passwordHash = await bcrypt.hash(password, 10);
    institution.passwordResetOtpHash = undefined;
    institution.passwordResetExpiresAt = undefined;
    institution.passwordResetAttempts = 0;
    await institution.save();
    return res.json({ message: "Password reset successfully" });
  } catch (err) {
    return res.status(500).json({ message: "Password reset failed" });
  }
});

module.exports = router;
