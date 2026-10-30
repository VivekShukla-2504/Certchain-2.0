const express = require("express");
const { ethers } = require("ethers");
const Student = require("../models/Student");
const Certificate = require("../models/Certificate");
const { requireAuth, requireRole, verifyToken } = require("../middleware/auth");
const { recordAuditEvent } = require("../utils/audit");

const router = express.Router();

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * POST /api/students
 * Register a new student under the authenticated institution.
 */
router.post("/", requireAuth, requireRole("admin", "issuer"), async (req, res) => {
  try {
    const {
      fullName,
      username,
      email,
      phone,
      enrollmentNumber,
      department,
      course,
      academicSession,
      walletAddress
    } = req.body;

    // 1. Validation
    if (!fullName || typeof fullName !== "string" || fullName.trim().length < 2) {
      return res.status(400).json({ message: "Full name is required (at least 2 characters)" });
    }
    if (!username || typeof username !== "string" || !/^[a-zA-Z0-9._-]{3,30}$/.test(username.trim())) {
      return res.status(400).json({ message: "Username must be 3-30 characters (letters, numbers, dot, underscore, dash)" });
    }
    if (!email || typeof email !== "string" || !/^\S+@\S+\.\S+$/.test(email.trim())) {
      return res.status(400).json({ message: "A valid email address is required" });
    }
    if (!phone || typeof phone !== "string" || phone.trim().length < 6) {
      return res.status(400).json({ message: "Phone number is required" });
    }
    if (!enrollmentNumber || typeof enrollmentNumber !== "string" || enrollmentNumber.trim().length < 2) {
      return res.status(400).json({ message: "Enrollment / Student number is required" });
    }
    if (!department || typeof department !== "string" || department.trim().length < 2) {
      return res.status(400).json({ message: "Department is required" });
    }
    if (!course || typeof course !== "string" || course.trim().length < 2) {
      return res.status(400).json({ message: "Course / Degree is required" });
    }
    if (!academicSession || typeof academicSession !== "string" || academicSession.trim().length < 4) {
      return res.status(400).json({ message: "Academic session is required (e.g. 2022-2026)" });
    }
    if (!walletAddress || typeof walletAddress !== "string" || !ethers.isAddress(walletAddress.trim())) {
      return res.status(400).json({ message: "Valid Ethereum wallet address is required (0x... format)" });
    }

    const cleanUsername = username.trim().toLowerCase();
    const cleanEmail = email.trim().toLowerCase();
    const cleanEnrollment = enrollmentNumber.trim();
    const cleanWallet = walletAddress.trim().toLowerCase();

    // 2. Uniqueness Checks
    const existing = await Student.findOne({
      $or: [
        { username: cleanUsername },
        { email: cleanEmail },
        { enrollmentNumber: cleanEnrollment }
      ]
    });

    if (existing) {
      if (existing.username === cleanUsername) {
        return res.status(409).json({ message: `Username "${username}" is already registered` });
      }
      if (existing.email === cleanEmail) {
        return res.status(409).json({ message: `Email "${email}" is already registered` });
      }
      if (existing.enrollmentNumber === cleanEnrollment) {
        return res.status(409).json({ message: `Enrollment number "${enrollmentNumber}" is already registered` });
      }
    }

    // 3. Create Student
    const student = await Student.create({
      fullName: fullName.trim(),
      username: cleanUsername,
      email: cleanEmail,
      phone: phone.trim(),
      enrollmentNumber: cleanEnrollment,
      department: department.trim(),
      course: course.trim(),
      academicSession: academicSession.trim(),
      walletAddress: cleanWallet,
      institutionId: req.institution.institutionId,
      registeredBy: req.institution.id
    });

    await recordAuditEvent({
      action: "student_registered",
      institutionId: req.institution.institutionId,
      actorUserId: req.institution.id,
      certId: student.enrollmentNumber,
      documentType: "StudentProfile"
    });

    return res.status(201).json({
      message: "Student registered successfully",
      student: {
        id: student._id,
        fullName: student.fullName,
        username: student.username,
        email: student.email,
        phone: student.phone,
        enrollmentNumber: student.enrollmentNumber,
        department: student.department,
        course: student.course,
        academicSession: student.academicSession,
        walletAddress: student.walletAddress,
        createdAt: student.createdAt
      }
    });
  } catch (err) {
    console.error(`[CertChain Students] Registration error:`, err);
    res.status(500).json({ message: "Failed to register student: " + err.message });
  }
});

/**
 * GET /api/students
 * List registered students for the authenticated institution with search & pagination.
 */
router.get("/", requireAuth, async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";

    const filter = { institutionId: req.institution.institutionId };
    if (search) {
      const rx = new RegExp(escapeRegex(search), "i");
      filter.$or = [
        { fullName: rx },
        { username: rx },
        { email: rx },
        { enrollmentNumber: rx },
        { course: rx },
        { department: rx },
        { walletAddress: rx }
      ];
    }

    const [students, total] = await Promise.all([
      Student.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Student.countDocuments(filter)
    ]);

    // Attach count of issued certificates for each student
    const enrollments = students.map((s) => s.enrollmentNumber);
    const certCounts = await Certificate.aggregate([
      { $match: { institutionId: req.institution.institutionId, rollNumber: { $in: enrollments } } },
      { $group: { _id: "$rollNumber", count: { $sum: 1 } } }
    ]);
    const certMap = Object.fromEntries(certCounts.map((c) => [c._id, c.count]));

    const enriched = students.map((s) => ({
      ...s,
      id: s._id,
      certificatesCount: certMap[s.enrollmentNumber] || 0
    }));

    res.json({
      students: enriched,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to load students: " + err.message });
  }
});

/**
 * GET /api/students/search
 * Fast search query for autocompleting student selection during certificate issuance.
 */
router.get("/search", requireAuth, async (req, res) => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    if (!q) return res.json({ students: [] });

    const rx = new RegExp(escapeRegex(q), "i");
    const filter = {
      institutionId: req.institution.institutionId,
      $or: [
        { fullName: rx },
        { username: rx },
        { enrollmentNumber: rx },
        { email: rx },
        { walletAddress: rx }
      ]
    };

    const students = await Student.find(filter).limit(10).lean();
    res.json({
      students: students.map((s) => ({
        id: s._id,
        fullName: s.fullName,
        username: s.username,
        email: s.email,
        phone: s.phone,
        enrollmentNumber: s.enrollmentNumber,
        department: s.department,
        course: s.course,
        academicSession: s.academicSession,
        walletAddress: s.walletAddress
      }))
    });
  } catch (err) {
    res.status(500).json({ message: "Search failed" });
  }
});

/**
 * GET /api/students/:id
 * Retrieve student details with their credential records.
 */
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const student = await Student.findOne({
      _id: req.params.id,
      institutionId: req.institution.institutionId
    }).lean();

    if (!student) return res.status(404).json({ message: "Student record not found" });

    const credentials = await Certificate.find({
      institutionId: req.institution.institutionId,
      $or: [
        { rollNumber: student.enrollmentNumber },
        { studentWallet: student.walletAddress.toLowerCase() },
        { studentEmail: student.email.toLowerCase() }
      ]
    }).sort({ createdAt: -1 }).lean();

    res.json({
      student: { ...student, id: student._id },
      credentials
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to load student details" });
  }
});

module.exports = router;

