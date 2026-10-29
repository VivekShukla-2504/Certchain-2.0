const jwt = require("jsonwebtoken");
const Institution = require("../models/Institution");

async function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Missing or invalid authorization header" });
  }
  const token = header.split(" ")[1];
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
  try {
    const account = await Institution.findOne({ institutionId: decoded.institutionId })
      .select("approvalStatus role")
      .lean();
    if (!account) return res.status(401).json({ message: "Institution account no longer exists" });
    if (account.approvalStatus === "pending") return res.status(403).json({ message: "Institution registration is awaiting approval" });
    if (account.approvalStatus === "suspended") return res.status(403).json({ message: "Institution access has been suspended" });
    req.institution = { ...decoded, role: account.role || decoded.role || "admin" };
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

module.exports = { requireAuth, requireRole };
