const jwt = require("jsonwebtoken");
const Institution = require("../models/Institution");
const TokenBlacklist = require("../models/TokenBlacklist");

async function isTokenBlacklisted(token) {
  if (!token) return false;
  const found = await TokenBlacklist.findOne({ token }).lean();
  return Boolean(found);
}

async function blacklistToken(token, expiresAt, reason = "logout") {
  if (!token) throw new Error("An authorization token is required");
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  if (!Number.isFinite(decoded.exp)) throw new Error("Token must have an expiration time");
  const expDate = expiresAt ? new Date(expiresAt) : new Date(decoded.exp * 1000);
  if (!Number.isFinite(expDate.getTime()) || expDate.getTime() <= Date.now()) {
    throw new Error("Token has expired");
  }
  await TokenBlacklist.findOneAndUpdate(
    { token },
    { token, expiresAt: expDate, reason },
    { upsert: true, new: true }
  );
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

  try {
    if (await isTokenBlacklisted(token)) {
      return res.status(401).json({ message: "Session token has been revoked or logged out. Please sign in again." });
    }
  } catch (err) {
    return res.status(503).json({ message: "Session access could not be checked" });
  }

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

function requireStakeholderAuth(...allowedRoles) {
  return async (req, res, next) => {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Missing or invalid authorization header" });
    }
    const token = header.slice("Bearer ".length).trim();
    if (!token) {
      return res.status(401).json({ message: "Missing authorization token" });
    }

    try {
      if (await isTokenBlacklisted(token)) {
        return res.status(401).json({ message: "Session token has been revoked or logged out. Please sign in again." });
      }
    } catch (err) {
      return res.status(503).json({ message: "Session access could not be checked" });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }

    if (
      !decoded.verifiedBySignature ||
      !allowedRoles.includes(decoded.role) ||
      typeof decoded.walletAddress !== "string" ||
      !/^0x[a-fA-F0-9]{40}$/.test(decoded.walletAddress)
    ) {
      return res.status(403).json({ message: "Your authenticated wallet does not have permission for this action" });
    }

    req.stakeholder = decoded;
    req.authToken = token;
    return next();
  };
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
  requireStakeholderAuth,
  requireRole,
  verifyToken: requireAuth,
  blacklistToken,
  isTokenBlacklisted
};
