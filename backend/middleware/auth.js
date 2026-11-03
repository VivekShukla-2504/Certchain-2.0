const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const Institution = require("../models/Institution");
const TokenBlacklist = require("../models/TokenBlacklist");

// High performance in-memory blacklist cache for sub-millisecond lookup
const blacklistedTokensCache = new Set();

async function isTokenBlacklisted(token) {
  if (!token) return false;
  if (blacklistedTokensCache.has(token)) return true;
  if (mongoose.connection.readyState !== 1) {
    return false;
  }
  try {
    const found = await TokenBlacklist.findOne({ token }).lean();
    if (found) {
      blacklistedTokensCache.add(token);
      return true;
    }
  } catch (err) {
    // If DB check fails, rely on memory cache
  }
  return false;
}

async function blacklistToken(token, expiresAt, reason = "logout") {
  if (!token) return;
  blacklistedTokensCache.add(token);
  if (mongoose.connection.readyState !== 1) {
    return;
  }
  try {
    let expDate = expiresAt;
    if (!expDate) {
      const decoded = jwt.decode(token);
      expDate = decoded?.exp ? new Date(decoded.exp * 1000) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    }
    await TokenBlacklist.findOneAndUpdate(
      { token },
      { token, expiresAt: expDate, reason },
      { upsert: true, new: true }
    );
  } catch (err) {
    console.warn("[CertChain Security] Failed to persist blacklisted token:", err.message);
  }
}

async function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Missing or invalid authorization header" });
  }
  const token = header.split(" ")[1];
  if (!token) {
    return res.status(401).json({ message: "Missing authorization token" });
  }

  // 1. Strict Token Blacklist Check (revocation upon logout or administrative action)
  if (await isTokenBlacklisted(token)) {
    return res.status(401).json({ message: "Session token has been revoked or logged out. Please sign in again." });
  }

  // 2. Cryptographic JWT Verification
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }

  // 3. Institution Account Status Check
  try {
    const query = decoded.institutionId ? { institutionId: decoded.institutionId } : { _id: decoded.id };
    const account = await Institution.findOne(query)
      .select("approvalStatus role")
      .lean();
    if (!account) return res.status(401).json({ message: "Institution account no longer exists" });
    if (account.approvalStatus === "pending") return res.status(403).json({ message: "Institution registration is awaiting approval" });
    if (account.approvalStatus === "suspended") return res.status(403).json({ message: "Institution access has been suspended" });
    req.institution = { ...decoded, role: account.role || decoded.role || "admin" };
    req.authToken = token;
    next();
  } catch (err) {
    return res.status(503).json({ message: "Institution access could not be checked" });
  }
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.institution || !allowedRoles.includes(req.institution.role)) {
      return res.status(403).json({ message: "Your account does not have permission for this action" });
    }
    next();
  };
}

module.exports = {
  requireAuth,
  requireRole,
  verifyToken: requireAuth,
  blacklistToken,
  isTokenBlacklisted
};
