const crypto = require("crypto");
const express = require("express");
const Institution = require("../models/Institution");

const router = express.Router();
const APPROVAL_STATES = ["pending", "approved", "suspended"];
const ROLES = ["admin", "issuer", "reviewer"];

function requirePlatformKey(req, res, next) {
  const configuredKey = process.env.PLATFORM_ADMIN_KEY;
  const suppliedKey = req.get("X-Platform-Admin-Key") || "";
  if (!configuredKey) return res.status(503).json({ message: "Platform administration is not configured" });
  const expected = Buffer.from(configuredKey);
  const supplied = Buffer.from(suppliedKey);
  if (expected.length !== supplied.length || !crypto.timingSafeEqual(expected, supplied)) {
    return res.status(401).json({ message: "Invalid platform administrator key" });
  }
  next();
}

router.use(requirePlatformKey);

router.get("/institutions", async (req, res) => {
  try {
    const institutions = await Institution.find()
      .select("name institutionId email approvalStatus role createdAt")
      .sort({ createdAt: -1 })
      .limit(500)
      .lean();
    res.json({ institutions });
  } catch (error) {
    res.status(500).json({ message: "Institution directory unavailable" });
  }
});

router.patch("/institutions/:institutionMongoId", async (req, res) => {
  const updates = {};
  if (req.body.approvalStatus !== undefined) {
    if (!APPROVAL_STATES.includes(req.body.approvalStatus)) {
      return res.status(400).json({ message: "Invalid institution approval status" });
    }
    updates.approvalStatus = req.body.approvalStatus;
  }
  if (req.body.role !== undefined) {
    if (!ROLES.includes(req.body.role)) return res.status(400).json({ message: "Invalid institution role" });
    updates.role = req.body.role;
  }
  if (!Object.keys(updates).length) return res.status(400).json({ message: "No supported institution changes provided" });

  try {
    const institution = await Institution.findByIdAndUpdate(req.params.institutionMongoId, { $set: updates }, { new: true, runValidators: true })
      .select("name institutionId email approvalStatus role createdAt")
      .lean();
    if (!institution) return res.status(404).json({ message: "Institution not found" });
    res.json({ institution });
  } catch (error) {
    res.status(400).json({ message: "Institution settings could not be updated" });
  }
});

module.exports = router;
